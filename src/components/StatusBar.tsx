import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  User,
  Timer,
  Info,
  ClipboardList,
  CalendarDays,
  Bell,
  Check,
  Trash2,
} from "lucide-react";
import { useSession } from "./SessionContext";
import { cn } from "@/lib/utils";

export type StatusTab = "info" | "data" | "schedule" | "notifications";

interface StatusBarProps {
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
  sessionName?: string;
  forName?: string;
  byName?: string;
  lastUpdatedBy?: string;
}

const TABS: { id: StatusTab; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Info", icon: Info },
  { id: "data", label: "Data", icon: ClipboardList },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "notifications", label: "Alerts", icon: Bell },
];

export function StatusBar({
  activeTab,
  onTabChange,
  sessionName = "Phineas Flynn's Data Sheet",
  forName = "Phineas Flynn",
  byName = "Heinz Doofenshmirtz",
  lastUpdatedBy = "Perry Plat",
}: StatusBarProps) {
  const { status, elapsedMs, lastUpdated, start, pause, resume, endAndSubmit, clearAndDiscard, activeTimers } = useSession();

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="max-w-5xl mx-auto px-4 pt-2">
        {/* Top row: title + active timers + session box */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg sm:text-xl leading-tight truncate">
              {sessionName}
            </h1>
            <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <span>For</span>
              <PersonLink name={forName} />
              <span>by</span>
              <PersonLink name={byName} />
              <span className="mx-1 text-stone-300">·</span>
              <span>
                Last updated{" "}
                <span className="text-foreground/80">{formatUpdated(lastUpdated)}</span>{" "}
                by
              </span>
              <PersonLink name={lastUpdatedBy} />
            </div>
          </div>

          {/* Active timers area */}
          <div className="hidden sm:flex items-center gap-1 max-w-[180px] flex-wrap justify-end">
            <AnimatePresence>
              {activeTimers.map((t) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  onClick={t.scrollTo}
                  aria-label={`Jump to running timer: ${t.label}`}
                  title={`Running: ${t.label}`}
                  className="relative grid place-items-center size-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <Timer className="size-4" />
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"
                    aria-hidden
                  />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Session timer box */}
          <SessionBox
            status={status}
            elapsedMs={elapsedMs}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onEnd={endAndSubmit}
            onDiscard={clearAndDiscard}
          />
        </div>

        {/* Tabs */}
        <nav className="mt-2 flex items-end gap-1" role="tablist" aria-label="Session sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(t.id)}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-lg border border-b-0 transition-colors",
                  isActive
                    ? "bg-background text-foreground border-stone-200 font-medium"
                    : "bg-stone-100/60 text-muted-foreground border-transparent hover:text-foreground hover:bg-stone-100",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
                {isActive && (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-background" aria-hidden />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function PersonLink({ name }: { name: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-foreground/80 hover:text-foreground transition-colors text-[11px] sm:text-xs"
    >
      <User className="size-3" />
      <span>{name}</span>
    </button>
  );
}

function SessionBox({
  status,
  elapsedMs,
  onStart,
  onPause,
  onResume,
  onEnd,
  onDiscard,
}: {
  status: "idle" | "running" | "paused";
  elapsedMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onDiscard: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border-2 px-3 py-1.5 min-w-[180px] flex flex-col items-stretch gap-1 transition-colors",
        status === "running"
          ? "border-blue-500 bg-blue-50/40"
          : status === "paused"
            ? "border-stone-300 bg-stone-50/60"
            : "border-stone-300 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Session
        </span>
        <span
          className={cn(
            "font-mono text-lg tabular-nums leading-none",
            status === "idle" && "text-stone-400",
          )}
        >
          {formatTime(elapsedMs)}
        </span>
      </div>

      {status === "idle" && (
        <div className="flex flex-col gap-1">
          <button
            onClick={onStart}
            className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-2 py-1.5 transition-colors"
          >
            <Play className="size-3" fill="currentColor" />
            Start New Session
          </button>
          <button
            onClick={onStart}
            className="flex items-center justify-center gap-1.5 rounded-md bg-white hover:bg-stone-50 border border-stone-300 text-foreground text-[11px] px-2 py-1 transition-colors"
          >
            Resume Paused Session
          </button>
        </div>
      )}

      {status === "running" && (
        <button
          onClick={onPause}
          className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-2 py-1.5 transition-colors"
        >
          <Pause className="size-3" fill="currentColor" />
          Pause Session
        </button>
      )}

      {status === "paused" && (
        <div className="flex flex-col gap-1">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-2 py-1.5 transition-colors"
          >
            <Play className="size-3" fill="currentColor" />
            Resume
          </button>
          <button
            onClick={onEnd}
            className="flex items-center justify-center gap-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2 py-1.5 transition-colors"
          >
            <Check className="size-3" strokeWidth={3} />
            End & Submit Data
          </button>
          {confirmDiscard ? (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onDiscard();
                  setConfirmDiscard(false);
                }}
                className="flex-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium px-1.5 py-1 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 rounded-md bg-stone-100 hover:bg-stone-200 text-foreground text-[10px] px-1.5 py-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDiscard(true)}
              className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors"
            >
              <Trash2 className="size-3" />
              Clear & Discard
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatUpdated(d: Date | null) {
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today at ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}
