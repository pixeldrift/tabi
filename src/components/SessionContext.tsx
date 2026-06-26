import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SessionStatus = "idle" | "running" | "paused";

export interface ActiveTimer {
  id: string;
  label: string;
  scrollTo: () => void;
}

interface SessionContextValue {
  // session
  status: SessionStatus;
  elapsedMs: number;
  lastUpdated: Date | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  endAndSubmit: () => void;
  clearAndDiscard: () => void;
  // active timer registry
  activeTimers: ActiveTimer[];
  registerActiveTimer: (t: ActiveTimer) => void;
  unregisterActiveTimer: (id: string) => void;
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

  useEffect(() => {
    if (status !== "running") return;
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(baseRef.current + (performance.now() - startRef.current));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  const start = useCallback(() => {
    baseRef.current = 0;
    setElapsedMs(0);
    setStatus("running");
    setLastUpdated(new Date());
  }, []);
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

  // Active timer registry
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
      activeTimers,
      registerActiveTimer,
      unregisterActiveTimer,
    }),
    [status, elapsedMs, lastUpdated, start, pause, resume, endAndSubmit, clearAndDiscard, activeTimers, registerActiveTimer, unregisterActiveTimer],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useRegisterActiveTimer(args: { id: string; label: string; active: boolean; elementRef: React.RefObject<HTMLElement | null> }) {
  const { registerActiveTimer, unregisterActiveTimer } = useSession();
  const { id, label, active, elementRef } = args;
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
    });
    return () => unregisterActiveTimer(id);
  }, [active, id, label, elementRef, registerActiveTimer, unregisterActiveTimer]);
}
