import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SessionStatus = "idle" | "running" | "paused";
export type SaveStatus = "clean" | "dirty" | "saving";

export interface ActiveTimer {
  id: string;
  label: string;
  scrollTo: () => void;
  source?: string;
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
  // save status
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  markDirty: () => void;
  forceSync: () => void;
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

  const start = useCallback(() => {
    baseRef.current = 0;
    setElapsedMs(0);
    setStatus("running");
    setLastUpdated(new Date());
    setSaveStatus("dirty");
  }, []);
  const pause = useCallback(() => {
    baseRef.current = elapsedMs;
    setStatus("paused");
    setLastUpdated(new Date());
    setSaveStatus("dirty");
  }, [elapsedMs]);
  const resume = useCallback(() => {
    setStatus("running");
    setLastUpdated(new Date());
    setSaveStatus("dirty");
  }, []);
  const endAndSubmit = useCallback(() => {
    setStatus("idle");
    setElapsedMs(0);
    baseRef.current = 0;
    setLastUpdated(new Date());
    setSaveStatus("dirty");
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
    setSaveStatus((s) => (s === "saving" ? s : "dirty"));
  }, []);
  const unregisterActiveTimer = useCallback((id: string) => {
    setActiveTimers((arr) => arr.filter((x) => x.id !== id));
    setSaveStatus((s) => (s === "saving" ? s : "dirty"));
  }, []);

  // Manual save only — no autosave. Dirty stays dirty until the user clicks the cloud.




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
      saveStatus,
      lastSavedAt,
      markDirty,
      forceSync,
    }),
    [status, elapsedMs, lastUpdated, start, pause, resume, endAndSubmit, clearAndDiscard, activeTimers, registerActiveTimer, unregisterActiveTimer, saveStatus, lastSavedAt, markDirty, forceSync],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useRegisterActiveTimer(args: {
  id: string;
  label: string;
  active: boolean;
  elementRef: React.RefObject<HTMLElement | null>;
  source?: string;
}) {
  const { registerActiveTimer, unregisterActiveTimer } = useSession();
  const { id, label, active, elementRef, source } = args;
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
      source,
    });
    return () => unregisterActiveTimer(id);
  }, [active, id, label, elementRef, source, registerActiveTimer, unregisterActiveTimer]);
}
