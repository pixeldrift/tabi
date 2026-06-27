import { useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  Play,
  Pause,
  Timer,
  Info,
  ClipboardList,
  CalendarDays,
  Bell,
  Check,
  Trash2,
  ArrowUp,
  RefreshCw,
  User,
  CornerDownLeft,
} from "lucide-react";
import { useSession, type SaveStatus, type SessionStatus } from "./SessionContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


export type StatusTab = "info" | "data" | "schedule" | "notifications";

interface StatusBarProps {
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
  title?: string;
}

const TABS: { id: StatusTab; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Info", icon: Info },
  { id: "data", label: "Data", icon: ClipboardList },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "notifications", label: "Alerts", icon: Bell },
];

export function StatusBar({ activeTab, onTabChange, title = "Phineas Flynn's Data Sheet" }: StatusBarProps) {
  const {
    status,
    elapsedMs,
    start,
    pause,
    resume,
    endAndSubmit,
    clearAndDiscard,
    activeTimers,
    saveStatus,
    lastSavedAt,
    forceSync,
  } = useSession();

  const durationTimers = activeTimers.filter((t) => t.source === "duration");

  // Random previous session length between 1-5 hours, generated once on the client.
  const previousSessionMsRef = useRef<number | null>(null);
  if (previousSessionMsRef.current === null && typeof window !== "undefined") {
    previousSessionMsRef.current = Math.floor((1 + Math.random() * 4) * 3600 * 1000);
  }
  const previousSessionMs = previousSessionMsRef.current ?? 2 * 3600 * 1000;

  const isRunning = status === "running";

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 pt-2">
        <LayoutGroup id="session-bar">
          {/* Top row: title + save status | (expanded session box when not running) */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="font-display text-base sm:text-lg leading-tight truncate">{title}</h1>
              <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onSync={forceSync} />
            </div>

            <div className="flex items-start gap-2">
              <div className="hidden sm:flex items-center gap-1 pt-1">
                <AnimatePresence>
                  {durationTimers.map((t) => (
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

              {!isRunning && (
                <ExpandedSessionBox
                  status={status}
                  elapsedMs={status === "paused" ? elapsedMs : previousSessionMs}
                  onResumePrevious={() => start(previousSessionMs)}
                  onStartNew={() => start(0)}
                  onResume={resume}
                  onPause={pause}
                  onEnd={endAndSubmit}
                  onDiscard={clearAndDiscard}
                />
              )}
            </div>
          </div>

          {/* Tabs row + mini session (when running) */}
          <nav
            className="flex items-end justify-between gap-2 mt-2 -mb-px"
            role="tablist"
            aria-label="Session sections"
          >
            <div className="flex items-end gap-1">
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
                      "relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-lg border border-b-0 transition-colors",
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
            </div>

            {isRunning && (
              <MiniSession elapsedMs={elapsedMs} onPause={pause} />
            )}
          </nav>
        </LayoutGroup>
      </div>
    </div>
  );
}


function SaveIndicator({
  status,
  lastSavedAt,
  onSync,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onSync: () => void;
}) {
  const isDirty = status === "dirty";
  const isSaving = status === "saving";

  const cloudColorClass = isDirty || isSaving ? "text-blue-500" : "text-stone-400";
  const SymbolIcon = isDirty ? ArrowUp : isSaving ? RefreshCw : Check;

  const justSaved = status === "clean" && lastSavedAt
    ? Date.now() - lastSavedAt.getTime() < 2500
    : false;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={isDirty ? onSync : undefined}
        aria-label={isDirty ? "Save now" : isSaving ? "Saving" : "All changes saved"}
        title={isDirty ? "Save now" : isSaving ? "Saving…" : "All changes saved"}
        className={cn(
          "relative grid place-items-center size-8 transition-colors",
          isDirty ? "cursor-pointer" : "cursor-default",
        )}
      >
        <CloudShape className={cn("absolute inset-0 size-8", cloudColorClass, isDirty && "hover:text-blue-600")} />
        <SymbolIcon
          className="relative size-3 text-white"
          strokeWidth={3.5}
          style={{ transform: "translateY(1.5px)" }}
        />
      </button>


      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex flex-col leading-tight text-left hover:opacity-80 transition-opacity"
          >
            {isSaving ? (
              <>
                <span className="text-[11px] font-medium text-blue-600">Saving</span>
                <span className="text-[11px] text-blue-600">Changes</span>
              </>
            ) : (
              <>
                <span className="text-[11px] font-medium text-stone-700">
                  {formatRelativeDay(lastSavedAt)}
                </span>
                <span
                  className={cn(
                    "text-[11px] tabular-nums transition-colors",
                    justSaved ? "text-blue-600" : "text-stone-500",
                  )}
                >
                  {formatTimeOfDay(lastSavedAt)}
                </span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="relative w-72 rounded-xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          {/* Arrow — centered, offset so its outer border aligns with the popover's top border */}
          <span
            aria-hidden
            className="absolute -top-[7px] left-1/2 -translate-x-1/2 size-3 rotate-45 border-l-2 border-t-2 border-blue-400 bg-white"
          />
          <div className="relative px-5 pt-4 pb-2 border-b border-stone-200 bg-white rounded-t-xl">
            <h3 className="font-display text-lg leading-tight">Session Data Status</h3>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="font-medium">
                {status === "saving"
                  ? "Saving changes…"
                  : status === "dirty"
                    ? "Unsaved changes"
                    : "All changes saved"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Saved</div>
              <div className="tabular-nums">
                {formatFullDate(lastSavedAt)} · {formatFullTime(lastSavedAt)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved by</div>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm"
              >
                <User className="size-3" fill="currentColor" strokeWidth={0} />
                <span>Perry Plat</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}


function CloudShape({ className }: { className?: string }) {
  // Filled cloud silhouette so the badge reads as a "cloud" with a symbol on top.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M7 18a5 5 0 0 1-.5-9.97A6 6 0 0 1 18 9.08 4.5 4.5 0 0 1 17.5 18H7Z"
      />
    </svg>
  );
}


function formatRelativeDay(d: Date | null) {
  if (!d) return "Never";
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeOfDay(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatFullDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatFullTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function ExpandedSessionBox({
  status,
  elapsedMs,
  onResumePrevious,
  onStartNew,
  onResume,
  onPause: _onPause,
  onEnd,
  onDiscard,
}: {
  status: SessionStatus;
  elapsedMs: number;
  onResumePrevious: () => void;
  onStartNew: () => void;
  onResume: () => void;
  onPause: () => void;
  onEnd: () => void;
  onDiscard: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isPaused = status === "paused";
  const label = isPaused ? "Paused Session" : "Previous Session";

  return (
    <motion.div
      layout
      className={cn(
        "shrink-0 rounded-xl border-2 px-3 py-1.5 min-w-[200px] flex flex-col items-stretch gap-1",
        isPaused ? "border-stone-300 bg-stone-50/60" : "border-stone-300 bg-white",
      )}
    >
      <motion.div layout className="flex items-center justify-between gap-2">
        <motion.span
          layout
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </motion.span>
        <motion.span
          layoutId="session-timer"
          className="text-lg tabular-nums leading-none text-stone-700"
        >
          {formatTime(elapsedMs)}
        </motion.span>
      </motion.div>

      <motion.div layout className="flex flex-col gap-1">
        <motion.button
          layoutId="session-toggle"
          onClick={isPaused ? onResume : onResumePrevious}
          className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-2 py-1.5"
        >
          <motion.span layoutId="session-toggle-icon" className="grid place-items-center">
            <Play className="size-3" fill="currentColor" />
          </motion.span>
          <motion.span
            layoutId="session-toggle-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isPaused ? "Resume Session" : "Resume Session"}
          </motion.span>
        </motion.button>

        {!isPaused && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={onStartNew}
            className="flex items-center justify-center gap-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2 py-1.5"
          >
            <CornerDownLeft className="size-3" strokeWidth={2.5} />
            Start New Session
          </motion.button>
        )}

        {isPaused && (
          <>
            <motion.button
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onClick={onEnd}
              className="flex items-center justify-center gap-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2 py-1.5"
            >
              <Check className="size-3" strokeWidth={3} />
              End & Submit Data
            </motion.button>
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
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function MiniSession({ elapsedMs, onPause }: { elapsedMs: number; onPause: () => void }) {
  return (
    <motion.div layout className="flex items-center gap-2 pb-1.5 pr-1">
      <motion.span
        layoutId="session-timer"
        className="text-base sm:text-lg tabular-nums leading-none text-blue-700 font-medium"
      >
        {formatTime(elapsedMs)}
      </motion.span>
      <motion.button
        layoutId="session-toggle"
        onClick={onPause}
        aria-label="Pause session"
        title="Pause session"
        className="grid place-items-center size-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
      >
        <motion.span layoutId="session-toggle-icon" className="grid place-items-center">
          <Pause className="size-3" fill="currentColor" />
        </motion.span>
      </motion.button>
    </motion.div>
  );
}



function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
