import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
} from "lucide-react";
import { useSession, type SaveStatus } from "./SessionContext";
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

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 pt-2">
        {/* Top row: title + save status | session box */}
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
        </div>

        {/* Tabs row — connected directly to the pane below */}
        <nav className="flex items-end gap-1 mt-2 -mb-px" role="tablist" aria-label="Session sections">
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
        </nav>
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
  const [open, setOpen] = useState(false);
  const isDirty = status === "dirty";
  const isSaving = status === "saving";

  const Icon = isDirty ? CloudUpload : isSaving ? Cloud : CloudCheck;
  const iconColorClass = isDirty
    ? "text-blue-600 hover:bg-blue-50"
    : isSaving
      ? "text-blue-600"
      : "text-stone-400 hover:bg-stone-100";

  const justSaved = status === "clean" && lastSavedAt
    ? Date.now() - lastSavedAt.getTime() < 2500
    : false;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={isDirty ? onSync : undefined}
          aria-label={isDirty ? "Save now" : isSaving ? "Saving" : "All changes saved"}
          title={isDirty ? "Save now" : isSaving ? "Saving…" : "All changes saved"}
          className={cn(
            "relative grid place-items-center size-9 rounded-md transition-colors",
            iconColorClass,
          )}
        >
          <Icon className="size-7" strokeWidth={1.75} />
          {isSaving && (
            <Loader2
              className="absolute size-3 animate-spin"
              style={{ top: "calc(50% + 3px)", left: "50%", transform: "translate(-50%, -50%)" }}
              strokeWidth={2.5}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
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
                  "text-[11px] font-mono tabular-nums transition-colors",
                  justSaved ? "text-blue-600" : "text-stone-500",
                )}
              >
                {formatTimeOfDay(lastSavedAt)}
              </span>
            </>
          )}
        </button>
      </div>
      <SaveDetailsDialog
        open={open}
        onOpenChange={setOpen}
        lastSavedAt={lastSavedAt}
        status={status}
      />
    </>
  );
}

function SaveDetailsDialog({
  open,
  onOpenChange,
  lastSavedAt,
  status,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lastSavedAt: Date | null;
  status: SaveStatus;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-2 border-stone-300 bg-white p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-stone-200">
          <DialogTitle className="font-display text-lg">Data Last Saved</DialogTitle>
        </DialogHeader>
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
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</div>
            <div className="font-mono tabular-nums">{formatFullDate(lastSavedAt)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</div>
            <div className="font-mono tabular-nums">{formatFullTime(lastSavedAt)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved by</div>
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 text-sm">
              Perry Plat
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
