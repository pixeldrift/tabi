import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIsPresent } from "motion/react";

export type SessionStatus = "idle" | "running" | "paused";
export type SaveStatus = "clean" | "dirty" | "saving";
export type TransitionKind = "start-new" | "start-previous" | "resume" | "discard" | null;

// Shared 3-stage session-transition timing (ms) — CARD_EXIT_MS is stage 1's
// dwell (below), which also drives the header's own dimming (StatusBar).
// The card list's own slide animation is intentionally SLOWER than this
// (see routes/index.tsx's CARD_SLIDE_EXIT_MS) — new cards start entering
// the instant stage 2 commits (fresh data is ready), which lands partway
// through the old cards' own slide-out, so the two overlap into one
// continuous relay instead of "exit, dead pause, enter." HEADER_MORPH_MS
// matches the notification area's own transition elsewhere in the app.
export const CARD_EXIT_MS = 350;
export const HEADER_MORPH_MS = 350;

// The session box itself waits for the pill's HEADER_MORPH_MS morph to land
// in the mini slot before it collapses (see StatusBar's boxCollapsed state),
// so "clock moves, then box closes" reads as two beats instead of one. This
// extra collapse time is tacked onto stage 2's dwell (below) — but only for
// kinds that actually collapse the box (not discard) — so `dimmed`/
// transitionStage don't reset (and card content reappear) before that
// second beat has actually finished playing out.
export const BOX_COLLAPSE_MS = 200;

// The pill's own big<->mini morph (StatusBar's manual FLIP), broken into its
// three beats: for a fresh start, the odometer visibly rolls down to zero
// while the pill is still big and stationary (DIGIT_SETTLE_MS) before it
// starts shrinking/traveling (PILL_TRAVEL_MS), then crossfades into the
// real, correctly-positioned destination pill (PILL_CROSSFADE_MS). Cards
// use PILL_LAND_MS to know when the pill has fully landed, so the new set
// only enters once the clock has actually arrived, not the instant the old
// set starts leaving.
// 3x the plain per-tick digit roll (see OdometerDigits' `slow` prop) so the
// reset-to-zero spin is actually watchable instead of a quick snap, with a
// matching hold here so the pill doesn't start traveling mid-spin.
export const DIGIT_SETTLE_MS = 900;
export const PILL_TRAVEL_MS = HEADER_MORPH_MS;
export const PILL_CROSSFADE_MS = 150;
export const PILL_LAND_MS = DIGIT_SETTLE_MS + PILL_TRAVEL_MS + PILL_CROSSFADE_MS;

export interface ActiveTimer {
  id: string;
  label: string;
  scrollTo: () => void;
  activate?: () => void;
  source?: string;
}

interface SessionContextValue {
  // session
  status: SessionStatus;
  elapsedMs: number;
  lastUpdated: Date | null;
  pause: () => void;
  endAndSubmit: () => void;
  // Shared 3-stage transition orchestration — see CARD_EXIT_MS et al above.
  // `transitionStage` is 0 outside of a transition, 1 while old stuff is
  // exiting, 2 while the timer/header is morphing (this is also when the
  // real status change actually commits).
  transitionStage: 0 | 1 | 2;
  transitionKind: TransitionKind;
  // The session box's own render target and its delayed, real-CSS-height
  // counterpart — see their shared comment on the SessionProvider below.
  // StatusBar's box reads both directly; the pill-travel landing-prediction
  // logic there also needs `collapsed` itself, not just `boxCollapsed`.
  collapsed: boolean;
  boxCollapsed: boolean;
  // True while the mini-session pill is actually traveling between its big
  // and mini positions (see its own comment below) — StatusBar's visual
  // travel overlay is driven directly off this shared clock.
  pillTraveling: boolean;
  // The single, unified "a real reflow is happening in the header right
  // now" signal — see its own comment on the SessionProvider below. Every
  // layout-tracked sibling (tab nav, content pane) reads this to give up
  // its own `layout="position"` FLIP for that window, since native reflow
  // already tracks the real, continuous motion without it.
  headerReflowActive: boolean;
  requestStartNew: () => void;
  requestContinuePrevious: (initialMs: number) => void;
  requestResume: () => void;
  requestDiscard: () => void;
  // shared tick (so all timers stay in unison with the session timer)
  sessionRunning: boolean;
  subscribeTick: (cb: (deltaMs: number) => void) => () => void;
  /** Precise elapsed time right now, not the last-tick snapshot (which is up
   * to 250ms stale) — for one-time phase calculations like syncing a new
   * animation to the exact current beat. */
  getElapsedMsNow: () => number;
  // active timer registry
  activeTimers: ActiveTimer[];
  registerActiveTimer: (t: ActiveTimer) => void;
  unregisterActiveTimer: (id: string) => void;
  // save status
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  markDirty: () => void;
  forceSync: () => void;
  // increments whenever a fresh session is started — cards listen and reset.
  resetSignal: number;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

// Split out from SessionContextValue: most data cards only need `markDirty`
// and `resetSignal`, neither of which changes on every tick or transition
// stage. Reading them through the main context would re-render every card
// (and its whole subtree, e.g. TrialCard's keypads) on every 250ms timer
// tick and every stage of a start/pause/resume transition — that render
// storm was landing right at click time and stealing the frame budget the
// collapse animation needed to look smooth. Cards that also need live
// timer state (RateCard, DurationCard) just read both contexts.
interface CardSessionValue {
  markDirty: () => void;
  resetSignal: number;
  // Cards gate their own recording controls on this (disabled while idle or
  // paused) — split off from the main context same as markDirty/resetSignal
  // above: it only flips on start/pause/resume/discard, not every tick, so
  // reading it here doesn't cost cards the render-storm subscribing to the
  // full context (with its every-250ms elapsedMs) would.
  sessionRunning: boolean;
}

const CardSessionContext = createContext<CardSessionValue | null>(null);

export function useCardSession() {
  const ctx = useContext(CardSessionContext);
  if (!ctx) throw new Error("useCardSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  // Shared tick driver — when the session is running, a single interval
  // updates the session's elapsed AND notifies all subscribed timers with
  // the delta in ms, so every timer ticks in unison.
  const tickListenersRef = useRef<Set<(deltaMs: number) => void>>(new Set());
  const subscribeTick = useCallback((cb: (deltaMs: number) => void) => {
    tickListenersRef.current.add(cb);
    return () => {
      tickListenersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    startRef.current = performance.now();
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (startRef.current !== null) {
        setElapsedMs(baseRef.current + (now - startRef.current));
      }
      tickListenersRef.current.forEach((cb) => cb(delta));
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  const getElapsedMsNow = useCallback(() => {
    if (status !== "running" || startRef.current === null) return elapsedMs;
    return baseRef.current + (performance.now() - startRef.current);
  }, [status, elapsedMs]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    // Set on the client only to avoid SSR hydration mismatches on time formatting.
    setLastSavedAt((d) => d ?? new Date());
  }, []);


  const markDirty = useCallback(() => {
    setSaveStatus((s) => (s === "saving" ? s : "dirty"));
  }, []);

  const performSave = useCallback(() => {
    setSaveStatus("saving");
    window.setTimeout(() => {
      setSaveStatus("clean");
      setLastSavedAt(new Date());
    }, 2200);
  }, []);

  const forceSync = useCallback(() => {
    setSaveStatus((s) => {
      if (s === "saving") return s;
      // trigger save
      window.setTimeout(() => performSave(), 0);
      return s;
    });
  }, [performSave]);

  const start = useCallback((initialMs = 0) => {
    baseRef.current = initialMs;
    setElapsedMs(initialMs);
    setStatus("running");
    const now = new Date();
    setLastUpdated(now);
    // Starting a session resets the saved baseline — no unsaved data yet.
    setLastSavedAt(now);
    setSaveStatus("clean");
  }, []);

  // Bumped whenever a brand-new (empty) session is started, so every card
  // can subscribe and reset its local state.
  const [resetSignal, setResetSignal] = useState(0);
  const startFresh = useCallback(() => {
    setResetSignal((n) => n + 1);
    start(0);
  }, [start]);


  const pause = useCallback(() => {
    baseRef.current = elapsedMs;
    setStatus("paused");
    setLastUpdated(new Date());
  }, [elapsedMs]);
  const resume = useCallback(() => {
    setStatus("running");
    setLastUpdated(new Date());
  }, []);
  const endAndSubmit = useCallback(() => {
    setStatus("idle");
    setElapsedMs(0);
    baseRef.current = 0;
    setLastUpdated(new Date());
  }, []);
  const clearAndDiscard = useCallback(() => {
    setStatus("idle");
    setElapsedMs(0);
    baseRef.current = 0;
  }, []);

  // Shared 3-stage transition orchestration (see CARD_EXIT_MS et al. above).
  // Stage 1: old stuff exits. Stage 2: the real state change commits (timer
  // rolls/header morphs). Back to 0: new stuff can enter. A ref-based busy
  // flag (not state) guards re-entrancy without needing transitionStage as a
  // callback dependency.
  const [transitionStage, setTransitionStage] = useState<0 | 1 | 2>(0);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>(null);
  const transitionBusyRef = useRef(false);
  const transitionTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => transitionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const runStagedTransition = useCallback((kind: Exclude<TransitionKind, null>, commit: () => void) => {
    if (transitionBusyRef.current) return;
    transitionBusyRef.current = true;
    setTransitionKind(kind);
    setTransitionStage(1);
    const t1 = window.setTimeout(() => {
      setTransitionStage(2);
      commit();
      // start-new's own pill travel doesn't begin until DIGIT_SETTLE_MS
      // after this commits (the odometer settles to zero first — see
      // DIGIT_SETTLE_MS's own comment), and StatusBar's box-collapse now
      // waits that same extra beat to avoid overlapping its own "pull nav
      // up" with the mini-session slot's "push nav down" (which read as a
      // bounce). This dwell has to stay in step with that or `dimmed`
      // resets — and stage-2 content reappears — before the box has
      // actually finished closing.
      const dwellMs =
        kind === "discard"
          ? 0
          : kind === "start-new"
            ? DIGIT_SETTLE_MS + HEADER_MORPH_MS + BOX_COLLAPSE_MS
            : HEADER_MORPH_MS + BOX_COLLAPSE_MS;
      const t2 = window.setTimeout(() => {
        setTransitionStage(0);
        setTransitionKind(null);
        transitionBusyRef.current = false;
      }, dwellMs);
      transitionTimeoutsRef.current.push(t2);
    }, CARD_EXIT_MS);
    transitionTimeoutsRef.current.push(t1);
  }, []);

  const requestStartNew = useCallback(
    () => runStagedTransition("start-new", startFresh),
    [runStagedTransition, startFresh],
  );
  const requestContinuePrevious = useCallback(
    (initialMs: number) => runStagedTransition("start-previous", () => start(initialMs)),
    [runStagedTransition, start],
  );
  const requestResume = useCallback(
    () => runStagedTransition("resume", resume),
    [runStagedTransition, resume],
  );
  const requestDiscard = useCallback(
    () => runStagedTransition("discard", clearAndDiscard),
    [runStagedTransition, clearAndDiscard],
  );

  const isRunning = status === "running";

  // The session box's own render target: collapsed into the mini pill slot
  // once genuinely running, or once a staged transition's real commit has
  // landed (except discard, whose box was already open and stays that way
  // — only its displayed value swaps). Centralized here — not derived
  // separately in StatusBar and mirrored out to everything else — so the
  // box's own real height `animate()`, the tab nav, and the content pane
  // all read the exact same value on the exact same render, with nothing
  // to mirror or fall a tick behind.
  const collapsed = isRunning || (transitionStage === 2 && transitionKind !== "discard");

  // Delays `collapsed`'s effect on the box's own real CSS height into a
  // separate beat ("clock moves, then box closes" — see StatusBar's own
  // render for the actual `animate={{height}}`) — a fresh start gets an
  // extra DIGIT_SETTLE_MS head start so the odometer's reset-to-zero spin
  // is visibly readable before anything starts shrinking. `collapseKindRef`
  // captures `transitionKind` at the moment collapse begins (not read
  // directly from `transitionKind` in the timeout below) so a later reset
  // of `transitionKind` can't retroactively change an already-scheduled
  // delay.
  const collapseKindRef = useRef<TransitionKind>(null);
  const prevCollapsedRef = useRef(collapsed);
  if (collapsed !== prevCollapsedRef.current) {
    prevCollapsedRef.current = collapsed;
    if (collapsed) collapseKindRef.current = transitionKind;
  }
  const [boxCollapsed, setBoxCollapsed] = useState(collapsed);
  useEffect(() => {
    if (collapsed) {
      const delay =
        collapseKindRef.current === "start-new" ? DIGIT_SETTLE_MS + HEADER_MORPH_MS : HEADER_MORPH_MS;
      const id = window.setTimeout(() => setBoxCollapsed(true), delay);
      return () => window.clearTimeout(id);
    }
    setBoxCollapsed(false);
  }, [collapsed]);

  // True while the mini-session pill is actually traveling between its big
  // and mini positions — starts the instant `isRunning` flips (after the
  // same DIGIT_SETTLE_MS head start as the box's own collapse, for a fresh
  // start), lasts exactly PILL_TRAVEL_MS. Purely timed rather than tied to
  // the travel overlay's own animation-complete callback, so StatusBar's
  // visual travel and every consumer's layout suppression read the same
  // clock instead of two that could drift apart.
  const prevIsRunningForPillRef = useRef(isRunning);
  // Captured once via a ref (not read from `transitionKind` in the
  // dependency array below) so SessionContext's own later reset of
  // transitionKind can't cancel an in-progress travel — same reasoning as
  // `collapseKindRef` above. Without this, `transitionKind` resetting to
  // null (via `runStagedTransition`'s own dwell timeout) while this travel
  // timer is still pending re-ran this effect, whose cleanup canceled the
  // pending "set false" timeout without ever setting `pillTraveling` false
  // itself — leaving it stuck true forever whenever the dwell timer's own
  // (single, flat) delay happened to fire before this one's (chained,
  // settle-then-travel) delay actually finished, which real-world timer
  // jitter made possible even though the nominal durations left margin.
  const pillTransitionKindRef = useRef<TransitionKind>(null);
  const [pillTraveling, setPillTraveling] = useState(false);
  useEffect(() => {
    if (isRunning === prevIsRunningForPillRef.current) return;
    prevIsRunningForPillRef.current = isRunning;
    pillTransitionKindRef.current = transitionKind;
    const startingFresh = isRunning && pillTransitionKindRef.current === "start-new";
    let travelTimeoutId: number | undefined;
    const beginTravel = () => {
      setPillTraveling(true);
      travelTimeoutId = window.setTimeout(() => setPillTraveling(false), PILL_TRAVEL_MS);
    };
    if (startingFresh) {
      const settleId = window.setTimeout(beginTravel, DIGIT_SETTLE_MS);
      return () => {
        window.clearTimeout(settleId);
        if (travelTimeoutId !== undefined) window.clearTimeout(travelTimeoutId);
      };
    }
    beginTravel();
    return () => {
      if (travelTimeoutId !== undefined) window.clearTimeout(travelTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // True for exactly as long as the box's own real CSS height `animate()`
  // is mid-transition (collapsing into the mini pill slot, or expanding
  // back out). The "turn on" edge is set during render (the same
  // same-component pattern as `prevCollapsedRef` above), not in an effect —
  // an effect would only fire after this render has already committed,
  // which is one render too late for a sibling like the tab nav whose own
  // margin swaps in the very same render `boxCollapsed` changes in (a
  // `layout="position"` FLIP would snapshot the stale, unsuppressed value
  // and visibly animate to catch up — this was the actual cause of a
  // small, separately-timed "hop"/"bounce" on resume and pause, distinct
  // from the box's own real motion). Setting it here means React bails out
  // and re-renders with the new flag before anything paints.
  const prevBoxCollapsedForAnimatingRef = useRef(boxCollapsed);
  const [boxHeightAnimating, setBoxHeightAnimating] = useState(false);
  if (boxCollapsed !== prevBoxCollapsedForAnimatingRef.current) {
    prevBoxCollapsedForAnimatingRef.current = boxCollapsed;
    setBoxHeightAnimating(true);
  }
  useEffect(() => {
    const duration = boxCollapsed ? BOX_COLLAPSE_MS : HEADER_MORPH_MS;
    const id = window.setTimeout(() => setBoxHeightAnimating(false), duration);
    return () => window.clearTimeout(id);
  }, [boxCollapsed]);

  // The single, unified signal every layout-tracked sibling below the
  // header (the tab nav, the content pane) reads to give up its own
  // `layout="position"` FLIP: while any of these is true, the header area
  // is genuinely reflowing on its own real clock, and a FLIP layered on
  // top of that can only fall behind, never match it.
  //   - `collapsed !== boxCollapsed`: the dwell between `collapsed` first
  //     changing (which is also the exact render `isRunning`-derived
  //     classes like the tab nav's own margin swap) and the box's real
  //     height actually starting to move — a pure per-render comparison,
  //     so it's already true on that very first render, with no effect
  //     lag at all. This is what closes the resume "hop"/pause "bounce":
  //     the previous approximation only started suppressing once the box's
  //     real transition began, missing this earlier dwell entirely.
  //   - `boxHeightAnimating`: the box's own real transition itself.
  //   - `pillTraveling`: the mini-session slot's own real height animation
  //     growing/shrinking directly inside the tab nav, on a separate clock
  //     from the box (driven by `isRunning`, not by `collapsed`/
  //     `boxCollapsed`'s own timing).
  // Covers a plain, unstaged `pause()` click too — that never touches
  // transitionStage/transitionKind at all, so an approximation gated on
  // those alone always missed it.
  const headerReflowActive = collapsed !== boxCollapsed || boxHeightAnimating || pillTraveling;

  // Active timer registry (registration is internal bookkeeping; do NOT mark dirty here).
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const registerActiveTimer = useCallback((t: ActiveTimer) => {
    setActiveTimers((arr) => {
      if (arr.some((x) => x.id === t.id)) return arr.map((x) => (x.id === t.id ? t : x));
      return [...arr, t];
    });
  }, []);
  const unregisterActiveTimer = useCallback((id: string) => {
    setActiveTimers((arr) => arr.filter((x) => x.id !== id));
  }, []);

  // Autosave: if dirty for 20s, automatically perform a save.
  useEffect(() => {
    if (saveStatus !== "dirty") return;
    const id = window.setTimeout(() => performSave(), 10000);
    return () => window.clearTimeout(id);
  }, [saveStatus, performSave]);

  const sessionRunning = isRunning;

  const value = useMemo(
    () => ({
      status,
      elapsedMs,
      lastUpdated,
      pause,
      endAndSubmit,
      transitionStage,
      transitionKind,
      collapsed,
      boxCollapsed,
      pillTraveling,
      headerReflowActive,
      requestStartNew,
      requestContinuePrevious,
      requestResume,
      requestDiscard,
      sessionRunning,
      subscribeTick,
      getElapsedMsNow,
      activeTimers,
      registerActiveTimer,
      unregisterActiveTimer,
      saveStatus,
      lastSavedAt,
      markDirty,
      forceSync,
      resetSignal,
    }),
    [
      status, elapsedMs, lastUpdated, pause, endAndSubmit,
      transitionStage, transitionKind, collapsed, boxCollapsed,
      pillTraveling, headerReflowActive,
      requestStartNew, requestContinuePrevious, requestResume, requestDiscard,
      sessionRunning, subscribeTick, getElapsedMsNow, activeTimers, registerActiveTimer, unregisterActiveTimer,
      saveStatus, lastSavedAt, markDirty, forceSync, resetSignal,
    ],
  );

  const cardValue = useMemo(
    () => ({ markDirty, resetSignal, sessionRunning }),
    [markDirty, resetSignal, sessionRunning],
  );

  return (
    <SessionContext.Provider value={value}>
      <CardSessionContext.Provider value={cardValue}>{children}</CardSessionContext.Provider>
    </SessionContext.Provider>
  );
}

export function useRegisterActiveTimer(args: {
  id: string;
  label: string;
  active: boolean;
  elementRef: React.RefObject<HTMLElement | null>;
  source?: string;
  onActivate?: () => void;
}) {
  const { registerActiveTimer, unregisterActiveTimer } = useSession();
  const { id, label, active, elementRef, source, onActivate } = args;
  // Keep latest onActivate in a ref so we don't re-register on every render.
  const activateRef = useRef(onActivate);
  useEffect(() => {
    activateRef.current = onActivate;
  }, [onActivate]);
  // MorphContent's own display-mode crossfade (routes/index.tsx) keeps the
  // OLD card instance mounted for a brief exit fade via AnimatePresence
  // mode="popLayout" while the NEW instance for the same logical card
  // mounts immediately — so for that ~120ms window, two instances sharing
  // the same registry `id` coexist. Each reads its own `active` from a
  // local, mount-time-only snapshot (see useCardState's own comment on why
  // it doesn't resubscribe to a sibling's later writes), so the exiting
  // instance's `active` can be stale — and if it re-registers AFTER the
  // entering instance's correct unregister (ordering between the two
  // isn't guaranteed), a phantom "running" entry is left behind until the
  // exiting fiber finally unmounts. useIsPresent() distinguishes the two:
  // false exactly while AnimatePresence is playing this instance's exit,
  // so treating a non-present instance as inactive regardless of its own
  // (possibly stale) `active` value keeps the exiting instance from ever
  // contesting the registry entry the entering one owns. Safe to call
  // unconditionally — it defaults to true for any instance not nested in
  // an AnimatePresence at all.
  const isPresent = useIsPresent();
  const effectiveActive = active && isPresent;
  useEffect(() => {
    if (!effectiveActive) {
      unregisterActiveTimer(id);
      return;
    }
    registerActiveTimer({
      id,
      label,
      scrollTo: () => {
        elementRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      activate: () => activateRef.current?.(),
      source,
    });
    return () => unregisterActiveTimer(id);
  }, [effectiveActive, id, label, elementRef, source, registerActiveTimer, unregisterActiveTimer]);
}
