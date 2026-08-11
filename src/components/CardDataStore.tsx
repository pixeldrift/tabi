import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface Store {
  values: Map<string, unknown>;
  // Per-key subscriber sets — a write to one key only wakes components
  // actually reading that key, not every card on the page.
  listeners: Map<string, Set<() => void>>;
}

const CardDataStoreContext = createContext<Store | null>(null);

/** Backs every card kind's actual recorded data (trial results, tallies,
 *  elapsed timers, ratings, task-analysis step statuses) in a single Map that
 *  outlives any individual card component instance. Card components remount
 *  on every display-mode switch — MorphContent's crossfade (see index.tsx)
 *  keys its content on `displayMode`, and List mode renders a genuinely
 *  different component (DataListRow) than Card/Large Grid/Small Grid do —
 *  so local `useState` alone would silently wipe recorded data every time the
 *  toolbar's view toggle is pressed. `useCardState` below reads from this
 *  store on mount instead of always starting fresh, and writes through to it
 *  on every update, so a freshly-mounted component instance picks up exactly
 *  where the last one left off. Mounted once, above the whole card list, so
 *  the Map itself is never recreated by the same remounts it exists to
 *  survive.
 *
 *  Built on useSyncExternalStore (not plain useState mirroring a Map) since
 *  the bookmark bar means a card's data can now have TWO concurrently
 *  mounted readers at once — the real card (possibly just scrolled
 *  off-screen, since the list isn't virtualized) and its bookmark-bar chip.
 *  A bare useState only reads the Map once at its own mount, so the two
 *  would silently drift out of sync with each other until one happened to
 *  re-render for an unrelated reason; a real subscription keeps every
 *  concurrent reader of the same key live. */
export function CardDataStoreProvider({ children }: { children: ReactNode }) {
  const store = useRef<Store>({ values: new Map(), listeners: new Map() }).current;
  return <CardDataStoreContext.Provider value={store}>{children}</CardDataStoreContext.Provider>;
}

function useStore(): Store {
  const store = useContext(CardDataStoreContext);
  if (!store) throw new Error("useCardState must be used inside CardDataStoreProvider");
  return store;
}

/** Drop-in `useState` replacement for a single piece of a card's own
 *  recorded data — same `[value, setValue]` shape (including the functional-
 *  update form), so swapping a `useState` call for this one is the only
 *  change needed anywhere else in a card component. The value itself is read
 *  from (and written through to) the shared store above, keyed by
 *  `${cardId}:${slot}`, rather than living only in this component instance's
 *  own fiber — `cardId` and `slot` are expected to stay fixed for the
 *  lifetime of a given mounted instance (true for every real call site — a
 *  card's own id and each state slot's name are both static), so there's no
 *  need to re-sync if either were to change after mount. */
export function useCardState<T>(
  cardId: string,
  slot: string,
  initial: T | (() => T),
): [T, (next: T | ((prev: T) => T)) => void] {
  const store = useStore();
  const key = `${cardId}:${slot}`;

  // Seeds on first read for this key, same as the old lazy useState
  // initializer — idempotent, so re-running this check on later renders
  // (unlike a true lazy initializer) is harmless.
  if (!store.values.has(key)) {
    const v = typeof initial === "function" ? (initial as () => T)() : initial;
    store.values.set(key, v);
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let set = store.listeners.get(key);
      if (!set) {
        set = new Set();
        store.listeners.set(key, set);
      }
      set.add(onStoreChange);
      return () => {
        set.delete(onStoreChange);
        if (set.size === 0) store.listeners.delete(key);
      };
    },
    [store, key],
  );
  const getSnapshot = useCallback(() => store.values.get(key) as T, [store, key]);
  // getServerSnapshot === getSnapshot: the same Map, seeded synchronously
  // above before this call regardless of client vs. server, so there's
  // nothing server-specific to special-case — omitting this third argument
  // entirely made React fall back to full client rendering on every SSR
  // pass (see the "Missing getServerSnapshot" warning it throws otherwise).
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = store.values.get(key) as T;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      store.values.set(key, resolved);
      store.listeners.get(key)?.forEach((listener) => listener());
    },
    [store, key],
  );
  return [value, setAndPersist];
}

/** Guards a card's own "reset on new session" effect against re-firing on
 *  every remount now that its actual data survives one (see useCardState
 *  above) — each card kind's reset effect used to gate on `resetSignal === 0`
 *  (skip on first mount, act on any later value), which relied on a fresh
 *  mount always meaning "nothing to reset yet." That's no longer true: once
 *  a card's data is persisted, a display-mode switch remounts it with
 *  `resetSignal` already at whatever non-zero value the last session start
 *  left it at, so the old guard would immediately re-run the reset and wipe
 *  the very data this store exists to preserve. This tracks which
 *  `resetSignal` value has already been applied (itself persisted, so it
 *  survives the same remounts) and only reports a reset as pending when
 *  `resetSignal` has moved past it — a genuine new "start new session",
 *  not just a fresh mount. Must be consulted synchronously inside the
 *  caller's own reset effect (see each card's `useEffect` for
 *  `resetSignal`) rather than applying the reset here itself, since every
 *  card kind's actual reset logic is different. */
export function useResetGuard(cardId: string, resetSignal: number): [boolean, () => void] {
  const [lastHandled, setLastHandled] = useCardState(cardId, "lastHandledReset", 0);
  const shouldReset = resetSignal !== lastHandled;
  return [shouldReset, () => setLastHandled(resetSignal)];
}
