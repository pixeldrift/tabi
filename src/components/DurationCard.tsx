import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp, ChevronDown, Pause, Play, Plus } from "lucide-react";
import { CardShell } from "./CardShell";
import { cn } from "@/lib/utils";

export interface DurationCardProps {
  title: string;
  phase?: string;
  description?: string;
  /** Minimum cumulative duration, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

export function DurationCard({
  title,
  phase = "Intervention",
  description,
  minDurationSec = 30,
  isActive = true,
  onActivate,
}: DurationCardProps) {
  // Each instance has a stored (paused) accumulated ms.
  const [instances, setInstances] = useState<number[]>([]);
  // Index of the instance currently being viewed.
  const [viewIdx, setViewIdx] = useState(0);
  // Live ms accumulated since the current run started (only meaningful when running).
  const [liveMs, setLiveMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  // Which instance the timer belongs to (always the latest when running).
  const runningIdxRef = useRef<number | null>(null);
  const [bumpKey, setBumpKey] = useState(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (startRef.current !== null) {
        setLiveMs(performance.now() - startRef.current);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const isViewingRunning =
    running && runningIdxRef.current === viewIdx;

  const currentInstanceMs = (idx: number) => {
    if (idx < 0 || idx >= instances.length) return 0;
    if (running && runningIdxRef.current === idx) {
      return instances[idx] + liveMs;
    }
    return instances[idx];
  };

  const totalMs =
    instances.reduce((a, b) => a + b, 0) + (running ? liveMs : 0);
  const totalSec = totalMs / 1000;
  const isComplete = totalSec >= minDurationSec;
  const remaining = Math.max(0, Math.ceil(minDurationSec - totalSec));

  // Commit live ms into stored instance.
  const flushLive = () => {
    if (running && runningIdxRef.current !== null) {
      const idx = runningIdxRef.current;
      setInstances((arr) => {
        const next = arr.slice();
        next[idx] = (next[idx] ?? 0) + liveMs;
        return next;
      });
    }
    setLiveMs(0);
    startRef.current = null;
  };

  const addInstance = () => {
    // Pause and bank any in-progress time first.
    if (running) {
      flushLive();
    }
    setInstances((arr) => [...arr, 0]);
    const newIdx = instances.length; // before update
    runningIdxRef.current = newIdx;
    setViewIdx(newIdx);
    setBumpKey((k) => k + 1);
    setRunning(true);
  };

  const togglePause = () => {
    if (instances.length === 0) {
      addInstance();
      return;
    }
    if (running) {
      flushLive();
      setRunning(false);
    } else {
      // Resume the currently viewed instance.
      runningIdxRef.current = viewIdx;
      setRunning(true);
    }
  };

  const navigate = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(instances.length - 1, viewIdx + delta));
    if (next !== viewIdx) {
      setViewIdx(next);
      setBumpKey((k) => k + 1);
    }
  };

  const displayInstanceMs = currentInstanceMs(viewIdx);
  const hasInstances = instances.length > 0;
  const instanceLabel = hasInstances ? `${viewIdx + 1} of ${instances.length}` : "—";
  const canPrev = viewIdx > 0;
  const canNext = viewIdx < instances.length - 1;

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Frequency / Duration"
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      isComplete={isComplete}
      helperText={
        isComplete ? (
          "Minimum duration reached. This data can now be graphed."
        ) : (
          <span>
            Record at least <strong className="font-semibold">{remaining}s more</strong>.
          </span>
        )
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Frequency / Duration" />
          <Row label="Minimum" value={`${minDurationSec}s`} />
          <Row label="Instances" value={String(instances.length)} />
          <Row label="Total" value={formatTime(totalMs)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        {/* Left: instance navigation */}
        <div className="flex flex-col items-center justify-center gap-1">
          <button
            onClick={() => navigate(-1)}
            disabled={!canPrev}
            aria-label="Previous instance"
            className="size-7 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
          >
            <ChevronUp className="size-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => navigate(1)}
            disabled={!canNext}
            aria-label="Next instance"
            className="size-7 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
          >
            <ChevronDown className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Center: total time + this-instance pill */}
        <div className="flex flex-col items-center justify-center min-w-[8rem] px-2">
          <div className="flex items-baseline gap-2">
            <motion.span
              animate={running ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
              transition={{ duration: 1.2, repeat: running ? Infinity : 0 }}
              className={cn(
                "size-2 rounded-full self-center",
                running ? "bg-red-500" : "bg-stone-300",
              )}
              aria-hidden
            />
            <span className="font-display text-4xl leading-none tabular-nums text-foreground">
              {formatTime(totalMs)}
            </span>
          </div>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Total time
          </span>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Instance {instanceLabel}</span>
            <span className="inline-flex items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`pill-${bumpKey}-${viewIdx}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "inline-flex items-center border border-blue-500 bg-white pl-1.5 pr-1 py-0.5 h-5 font-mono text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full",
                    isViewingRunning ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatTime(displayInstanceMs)}
                </motion.span>
              </AnimatePresence>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePause();
                }}
                disabled={!hasInstances}
                aria-label={isViewingRunning ? "Pause this instance" : "Resume this instance"}
                className="grid size-5 place-items-center rounded-r-full bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {isViewingRunning ? (
                  <Pause className="size-3" fill="currentColor" />
                ) : (
                  <Play className="size-3" fill="currentColor" />
                )}
              </button>
            </span>
          </div>
        </div>

        {/* Right: Add Instance */}
        <motion.button
          onClick={addInstance}
          whileTap={{ scale: 0.94 }}
          aria-label="Add instance"
          className={cn(
            "size-16 rounded-full grid place-items-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-7" strokeWidth={3} />
        </motion.button>
      </div>
    </CardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
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
