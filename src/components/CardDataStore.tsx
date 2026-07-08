import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Store = Map<string, unknown>;

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
 *  survive. */
export function CardDataStoreProvider({ children }: { children: ReactNode }) {
  const store = useRef<Store>(new Map()).current;
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
  const [value, setValue] = useState<T>(() => {
    if (store.has(key)) return store.get(key) as T;
    const v = typeof initial === "function" ? (initial as () => T)() : initial;
    store.set(key, v);
    return v;
  });
  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        store.set(key, resolved);
        return resolved;
      });
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
