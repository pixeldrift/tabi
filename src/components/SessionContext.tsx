import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
export const CARD_ENTER_MS = 350;

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
export const DIGIT_SETTLE_MS = 300;
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

  const sessionRunning = status === "running";

  const value = useMemo(
    () => ({
      status,
      elapsedMs,
      lastUpdated,
      pause,
      endAndSubmit,
      transitionStage,
      transitionKind,
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
      transitionStage, transitionKind, requestStartNew, requestContinuePrevious, requestResume, requestDiscard,
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
  useEffect(() => {
    if (!active) {
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
  }, [active, id, label, elementRef, source, registerActiveTimer, unregisterActiveTimer]);
}
