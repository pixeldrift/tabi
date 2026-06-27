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
  LineChart,
} from "lucide-react";
import { useSession, type SaveStatus, type SessionStatus } from "./SessionContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
    startFresh,
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
  const [previousSessionEndedAt, setPreviousSessionEndedAt] = useState<Date | null>(null);
  useEffect(() => {
    setPreviousSessionMs(Math.floor((1 + Math.random() * 4) * 3600 * 1000));
    // Random end time: somewhere between 1 minute and 3 days ago.
    const minMs = 60 * 1000;
    const maxMs = 3 * 24 * 3600 * 1000;
    setPreviousSessionEndedAt(new Date(Date.now() - (minMs + Math.random() * (maxMs - minMs))));
  }, []);

  const isRunning = status === "running";
  const [discardOpen, setDiscardOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  // While `pendingStart` is set, the collapse animation runs but the session
  // timer hasn't started yet — gives a smooth, jank-free transition.
  const [pendingStart, setPendingStart] = useState<null | "resume" | "previous" | "new">(null);
  const collapsed = isRunning || pendingStart !== null;
  const TRANSITION_MS = 700;

  const requestPlay = () => {
    if (pendingStart) return;
    if (status === "paused") {
      setPendingStart("resume");
      window.setTimeout(() => {
        resume();
        setPendingStart(null);
      }, TRANSITION_MS);
    } else {
      setPendingStart("previous");
      window.setTimeout(() => {
        start(previousSessionMs);
        setPendingStart(null);
      }, TRANSITION_MS);
    }
  };

  const requestStartNew = () => {
    if (pendingStart) return;
    setPendingStart("new");
    window.setTimeout(() => {
      startFresh();
      setPendingStart(null);
    }, TRANSITION_MS);
  };

  // What time to show inside the pill during the morph: keep continuity so
  // the big pill and mini pill display the same value while animating.
  const pillElapsed = isRunning
    ? elapsedMs
    : status === "paused"
      ? elapsedMs
      : pendingStart === "new"
        ? 0
        : previousSessionMs;


  return (
    <>
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200">
        <div className={cn("max-w-5xl mx-auto px-4", isRunning ? "pt-1" : "pt-2")}>
          {/* Title row — static, never scales or layout-animates */}
          <div className="flex items-start justify-between gap-3">
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
            </div>
          </div>

          <LayoutGroup id="session-bar">
            {/* Session box area — always rendered; height animates symmetrically both ways.
                The pill inside is hidden when running so only the mini pill carries the
                shared layoutId, letting motion morph cleanly between the two positions. */}
            <motion.div
              initial={false}
              animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
              transition={
                collapsed
                  ? {
                      height: { duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: TRANSITION_MS / 1000 },
                      opacity: { duration: 0.2, delay: TRANSITION_MS / 1000 },
                    }
                  : {
                      height: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.3, delay: 0.3 },
                    }
              }
              className="flex justify-center overflow-hidden"
            >
              <ExpandedSessionBox
                status={status}
                elapsedMs={pillElapsed}
                contextTime={status === "paused" ? null : previousSessionEndedAt}
                showPill={!collapsed}
                dimmed={pendingStart !== null}
                onPlay={requestPlay}
                onStartNew={requestStartNew}
                onEnd={() => setEndOpen(true)}
                onRequestDiscard={() => setDiscardOpen(true)}
              />
            </motion.div>



            {/* Tabs row + mini session (when running) */}
            <nav
              className={cn("flex items-end justify-between gap-2 -mb-px", collapsed ? "mt-1" : "mt-2")}
              role="tablist"
              aria-label="Session sections"
            >
              <div className="flex items-end gap-1">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = t.id === activeTab;
                  const isDataFaded = t.id === "data" && !isRunning;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onTabChange(t.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-lg border border-b-0 transition-[color,background-color,opacity] duration-300",
                        isActive
                          ? "bg-background text-foreground border-stone-200 font-medium"
                          : "bg-stone-200/70 text-stone-600 border-transparent hover:text-foreground hover:bg-stone-200",
                        isDataFaded && "opacity-50",
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

              {collapsed && (
                <div className="pb-1.5 sm:pb-2 pr-1">
                  <MiniSession elapsedMs={pillElapsed} onPause={pause} disabled={!isRunning} />
                </div>
              )}
            </nav>


          </LayoutGroup>
        </div>
      </div>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-red-500 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle className="text-red-600">Warning!</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure? This will end the current session and discard any data collected during the session so far!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
            <DiscardAction
              onConfirm={() => {
                clearAndDiscard();
                setDiscardOpen(false);
              }}
            />
            <span className="text-xs text-muted-foreground text-center">Or</span>
            <button
              onClick={() => setDiscardOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              Continue Session Safely
              <Play className="size-4" fill="currentColor" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-green-500 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle className="text-green-600">End Session & Graph Data</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure? This will end the current session and submit collected data for graphing? Targets that have not met their minimums will not be graphed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
            <button
              onClick={() => {
                endAndSubmit();
                setEndOpen(false);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              End & Submit Data
              <LineChart className="size-4" strokeWidth={2.5} />
            </button>
            <span className="text-xs text-muted-foreground text-center">Or</span>
            <button
              onClick={() => setEndOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              Return to Session
              <Play className="size-4" fill="currentColor" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

  const label = isSaving ? "Saving" : isDirty ? "Unsaved" : "Saved";
  const labelColor = isSaving || isDirty ? "text-blue-600" : "text-stone-700";

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center text-right hover:opacity-80 transition-opacity h-8"
          >
            <span className={cn("text-[11px] font-medium leading-none", labelColor)}>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="relative w-72 rounded-xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          {/* Arrow — right-aligned to point at the cloud icon */}
          <span
            aria-hidden
            className="absolute -top-[7px] right-4 size-3 rotate-45 border-l-2 border-t-2 border-blue-400 bg-white"
          />
          <PopoverPrimitive.Close
            aria-label="Close"
            className="absolute top-2 right-2 grid place-items-center size-7 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors z-10"
          >
            <X className="size-4" />
          </PopoverPrimitive.Close>
          <div className="relative px-5 pt-4 pb-2 border-b border-stone-200 bg-white rounded-t-xl">
            <h3 className="font-display text-lg leading-tight pr-8">Session Data Status</h3>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <span className="relative grid place-items-center size-6 text-stone-400 shrink-0">
                  <CloudShape className="absolute inset-0 size-6" />
                  <SymbolIcon
                    className={cn("relative text-white", isSaving ? "size-2" : "size-2.5")}
                    strokeWidth={3.5}
                    style={{ transform: isSaving ? "translateY(-0.5px)" : "translateY(1px)" }}
                  />
                </span>
                <span className="font-medium">
                  {status === "saving"
                    ? "Saving changes…"
                    : status === "dirty"
                      ? "Unsaved changes"
                      : "All changes saved"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Saved</div>
              <div className="tabular-nums leading-tight">
                <div>{formatFullDate(lastSavedAt)}</div>
                <div>{formatFullTime(lastSavedAt)}</div>
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
          className={cn("relative text-white", isSaving ? "size-2.5" : "size-3")}
          strokeWidth={3.5}
          style={{ transform: isSaving ? "translateY(0px)" : "translateY(1.5px)" }}
        />
      </button>
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

function formatSavedLabel(status: SaveStatus, d: Date | null) {
  if (status === "dirty") return "Unsaved";
  if (!d) return "Never saved";
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diffDays === 0) return "Data Saved";
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

function formatRelativeFromNow(d: Date) {
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "One minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = diff / 3600000;
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    if (rounded === 1) return "One hour ago";
    return `${rounded} hours ago`;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today.getTime() - that.getTime()) / 86400000);
  const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
  if (days === 1) return `Yesterday at ${timeStr}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${timeStr}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
}

function ExpandedSessionBox({
  status,
  elapsedMs,
  contextTime,
  showPill = true,
  dimmed = false,
  onPlay,
  onStartNew,
  onEnd,
  onRequestDiscard,
}: {
  status: SessionStatus;
  elapsedMs: number;
  contextTime: Date | null;
  showPill?: boolean;
  dimmed?: boolean;
  onPlay: () => void;
  onStartNew: () => void;
  onEnd: () => void;
  onRequestDiscard: () => void;
}) {
  const isPaused = status === "paused";
  const label = isPaused ? "Session Paused" : "Previous Session";
  const ease = [0.4, 0, 0.2, 1] as const;

  // Re-render to refresh "x ago" string.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!contextTime) return;
    const i = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, [contextTime]);




  return (
    <div className="shrink-0 px-3 py-1.5 w-[280px] flex flex-col items-stretch gap-2">
      <div className="flex flex-col items-center gap-1">
        <motion.span
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={false}
          transition={{ duration: 0.2 }}
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </motion.span>

        {showPill && (
          <motion.div
            layoutId="session-pill"
            transition={{ duration: 0.7, ease, layout: { duration: 0.7, ease } }}
            className="flex items-stretch rounded-full overflow-hidden border-2 border-stone-300 bg-white w-full h-12"
          >
            <motion.span
              layoutId="session-pill-time"
              transition={{ duration: 0.7, ease }}
              className="flex-1 flex items-center justify-center text-3xl tabular-nums leading-none text-stone-800 font-medium px-3"
            >
              {formatTime(elapsedMs)}
            </motion.span>
            <motion.button
              layoutId="session-pill-toggle"
              onClick={onPlay}
              whileTap={{ scale: 0.95, filter: "brightness(0.9)" }}
              transition={{ duration: 0.7, ease, layout: { duration: 0.7, ease } }}
              aria-label={isPaused ? "Resume session" : "Continue session"}
              className="grid place-items-center w-14 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0"
            >
              <motion.span layoutId="session-pill-icon" className="grid place-items-center">
                <Play className="size-5" fill="currentColor" strokeWidth={0} />
              </motion.span>
            </motion.button>
          </motion.div>
        )}

        <motion.div
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={false}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-0.5 mt-0.5 leading-tight"
        >
          {contextTime && (
            <>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatRelativeFromNow(contextTime)} ({formatMDY(contextTime)})
              </span>
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                Last saved by:
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 text-[10px]">
                  <User className="size-2.5" fill="currentColor" strokeWidth={0} />
                  <span>Perry Plat</span>
                </span>
              </span>
            </>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {!dimmed && (
          <motion.div
            key="actions"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25, ease }}
            className="flex flex-col gap-1"
          >
            {isPaused ? (
              <button
                onClick={onEnd}
                className="flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
              >
                End & Submit Data
                <LineChart className="size-3.5" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                onClick={onStartNew}
                className="flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
              >
                Start New Session
                <RefreshCw className="size-3.5" strokeWidth={2.5} />
              </button>
            )}
            {isPaused && (
              <button
                onClick={onRequestDiscard}
                className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors active:scale-95"
              >
                End & Discard Session!
                <Trash2 className="size-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
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
              className="absolute inset-0 grid place-items-center px-14 text-white text-xs font-medium whitespace-nowrap pointer-events-none"
            >
              Drag to trash to confirm
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


function MiniSession({ elapsedMs, onPause, disabled = false }: { elapsedMs: number; onPause: () => void; disabled?: boolean }) {
  const ease = [0.4, 0, 0.2, 1] as const;
  return (
    <motion.div
      layoutId="session-pill"
      transition={{ duration: 0.7, ease, layout: { duration: 0.7, ease } }}
      className="flex items-stretch rounded-full overflow-hidden border-2 border-blue-500 bg-white h-7"
    >
      <motion.span
        layoutId="session-pill-time"
        transition={{ duration: 0.7, ease }}
        className="flex items-center px-2.5 text-sm tabular-nums leading-none text-blue-700 font-medium"
      >
        {formatTime(elapsedMs)}
      </motion.span>
      <motion.button
        layoutId="session-pill-toggle"
        onClick={disabled ? undefined : onPause}

        whileTap={{ scale: 0.95, filter: "brightness(0.9)" }}
        transition={{ duration: 0.7, ease, layout: { duration: 0.7, ease } }}
        aria-label="Pause session"
        title="Pause session"
        className="grid place-items-center w-8 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0"
      >
        <motion.span layoutId="session-pill-icon" className="grid place-items-center">
          <Pause className="size-3" fill="currentColor" strokeWidth={0} />
        </motion.span>
      </motion.button>
    </motion.div>
  );
}

function formatMDY(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}




function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
