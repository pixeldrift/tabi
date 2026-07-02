import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SessionStatus = "idle" | "running" | "paused";
export type SaveStatus = "clean" | "dirty" | "saving";

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
  start: (initialMs?: number) => void;
  startFresh: () => void;
  pause: () => void;
  resume: () => void;
  endAndSubmit: () => void;
  clearAndDiscard: () => void;
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
      start,
      pause,
      resume,
      endAndSubmit,
      clearAndDiscard,
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
      startFresh,
      resetSignal,
    }),
    [status, elapsedMs, lastUpdated, start, pause, resume, endAndSubmit, clearAndDiscard, sessionRunning, subscribeTick, getElapsedMsNow, activeTimers, registerActiveTimer, unregisterActiveTimer, saveStatus, lastSavedAt, markDirty, forceSync, startFresh, resetSignal],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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
