import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, animate } from "motion/react";
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
  ArrowLeft,
  RefreshCw,
  User,
  ArrowRight,
  X,
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
  const [previousSessionMs, setPreviousSessionMs] = useState(2 * 3600 * 1000);
  useEffect(() => {
    setPreviousSessionMs(Math.floor((1 + Math.random() * 4) * 3600 * 1000));
  }, []);

  const isRunning = status === "running";

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 pt-2">
        <LayoutGroup id="session-bar">
          {/* Top row: back + title | save status + session box */}
          <div className={cn(
            "flex items-start justify-between gap-3",
            !isRunning && "min-h-[120px]",
          )}>
            <div className="flex items-center gap-2 min-w-0 pt-1">
              <button
                type="button"
                aria-label="Back to sessions"
                title="Back to sessions"
                className="grid place-items-center size-8 -ml-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h1 className="font-display text-base sm:text-lg leading-tight truncate">{title}</h1>
            </div>

            <div className="flex items-start gap-3 shrink-0">
              <div className="pt-1">
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onSync={forceSync} />
              </div>

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
  const [discardOpen, setDiscardOpen] = useState(false);
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
          className="flex items-center justify-center gap-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2 py-1.5"
        >
          <motion.span
            layoutId="session-toggle-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isPaused ? "Resume Session" : "Resume Session"}
          </motion.span>
          <motion.span layoutId="session-toggle-icon" className="grid place-items-center">
            <Play className="size-3" fill="currentColor" />
          </motion.span>
        </motion.button>

        {!isPaused && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={onStartNew}
            className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-2 py-1.5"
          >
            Start New Session
            <RefreshCw className="size-3" strokeWidth={2.5} />
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
              End & Submit Data
              <Check className="size-3" strokeWidth={3} />
            </motion.button>
            <button
              onClick={() => setDiscardOpen(true)}
              className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors"
            >
              End & Discard Session!
              <Trash2 className="size-3" />
            </button>

            <AnimatePresence>
              {discardOpen && (
                <motion.div
                  key="discard-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                  onClick={() => setDiscardOpen(false)}
                >
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-sm mx-4 my-4 border-2 border-red-500 rounded-xl bg-background p-6 shadow-lg"
                  >
                    <div className="flex flex-col space-y-2 text-left">
                      <h2 className="text-lg font-semibold text-red-600">Warning!</h2>
                      <p className="text-sm text-muted-foreground text-left">
                        Are you sure? This will end the current session and discard any data collected during the session so far!
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 mt-6 items-stretch">
                      <DiscardAction
                        onConfirm={() => {
                          onDiscard();
                          setDiscardOpen(false);
                        }}
                      />
                      <span className="text-xs text-muted-foreground text-center">Or:</span>
                      <button
                        onClick={() => setDiscardOpen(false)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
                      >
                        Continue Session Safely
                        <Play className="size-4" fill="currentColor" />
                      </button>
                    </div>
                    <button
                      onClick={() => setDiscardOpen(false)}
                      className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function DiscardAction({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [maxX, setMaxX] = useState(0);

  const handleSize = 36; // size-9
  const sidePad = 8;

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setMaxX(Math.max(0, el.clientWidth - handleSize - sidePad));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [armed]);

  const labelOpacity = useTransform(x, [0, Math.max(1, maxX * 0.7)], [1, 0]);

  return (
    <div
      ref={trackRef}
      onClick={!armed ? () => setArmed(true) : undefined}
      className={cn(
        "relative h-11 w-full rounded-full bg-red-500 overflow-hidden select-none transition-colors",
        !armed && "cursor-pointer hover:bg-red-600",
      )}
    >
      {/* Label + trash crossfade between tap and drag states */}
      <AnimatePresence mode="wait" initial={false}>
        {!armed ? (
          <motion.span
            key="tap-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center gap-2 text-white text-sm font-medium pointer-events-none"
          >
            <span>End &amp; Discard Session!</span>
            <motion.span layoutId="discard-trash">
              <Trash2 className="size-4" />
            </motion.span>
          </motion.span>
        ) : (
          <>
            <motion.span
              key="drag-label"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              style={{ opacity: labelOpacity }}
              className="absolute inset-0 grid place-items-center px-14 text-white text-sm font-medium text-center pointer-events-none"
            >
              Drag the circle to the trash to confirm
            </motion.span>
            <motion.span
              layoutId="discard-trash"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
            >
              <Trash2 className="size-4" />
            </motion.span>
          </>
        )}
      </AnimatePresence>


      {/* Drag handle: scales up from 0 when armed */}
      <motion.button
        type="button"
        aria-label="Drag to confirm discard"
        initial={false}
        animate={{ scale: armed ? 1 : 0, opacity: armed ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 22, delay: armed ? 0.05 : 0 }}
        drag={armed && !confirmed ? "x" : false}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() >= maxX - 4) {
            setConfirmed(true);
            animate(x, maxX, { duration: 0.15 });
            setTimeout(onConfirm, 150);
          } else {
            animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
            setTimeout(() => setArmed(false), 250);
          }
        }}
        className="absolute left-1 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-white text-red-600 shadow-md cursor-grab active:cursor-grabbing"
      >
        <ArrowRight className="size-4" strokeWidth={2.75} />
      </motion.button>
    </div>
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
