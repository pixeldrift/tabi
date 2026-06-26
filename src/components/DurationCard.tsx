import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from "lucide-react";
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
  const [instances, setInstances] = useState<number[]>([]);
  const [viewIdx, setViewIdx] = useState(0);
  const [liveMs, setLiveMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const runningIdxRef = useRef<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

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

  const isViewingRunning = running && runningIdxRef.current === viewIdx;

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
    if (running) flushLive();
    const newIdx = instances.length;
    setInstances((arr) => [...arr, 0]);
    runningIdxRef.current = newIdx;
    setDirection(1);
    setViewIdx(newIdx);
    setRunning(true);
  };

  const togglePause = () => {
    if (instances.length === 0) {
      addInstance();
      return;
    }
    if (isViewingRunning) {
      flushLive();
      setRunning(false);
    } else {
      if (running) flushLive();
      runningIdxRef.current = viewIdx;
      setRunning(true);
    }
  };

  const navigate = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(instances.length - 1, viewIdx + delta));
    if (next !== viewIdx) {
      setDirection(delta);
      setViewIdx(next);
    }
  };

  const hasInstances = instances.length > 0;
  const canPrev = viewIdx > 0;
  const canNext = viewIdx < instances.length - 1;
  const displayInstanceMs = currentInstanceMs(viewIdx);

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
      <div className="px-5 pt-3 pb-4">
        {/* Main row: nav < [ timer box ] nav > */}
        <div className="flex items-center justify-center gap-2">
          <TriangleNav
            direction="left"
            onClick={() => navigate(-1)}
            disabled={!canPrev}
          />

          <div className="relative flex-1 h-20 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              {hasInstances ? (
                <motion.div
                  key={viewIdx}
                  custom={direction}
                  initial={(d: 1 | -1) => ({ x: d > 0 ? "110%" : "-110%", opacity: 0, scale: 0.9 })}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={(d: 1 | -1) => ({ x: d > 0 ? "-110%" : "110%", opacity: 0, scale: 0.85 })}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="absolute inset-0 flex items-stretch justify-center"
                >
                  <TimerBox
                    ms={displayInstanceMs}
                    running={isViewingRunning}
                    onToggle={togglePause}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
                >
                  Press <Plus className="inline size-4 mx-1" /> to start the first instance
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <TriangleNav
            direction="right"
            onClick={() => navigate(1)}
            disabled={!canNext}
          />
        </div>

        {/* Caption: instance counter + total */}
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>
            Instance{" "}
            <span className="font-mono normal-case tracking-normal tabular-nums text-foreground">
              {hasInstances ? viewIdx + 1 : 0}
            </span>{" "}
            of{" "}
            <span className="font-mono normal-case tracking-normal tabular-nums text-foreground">
              {instances.length}
            </span>
          </span>
          <span className="size-1 rounded-full bg-stone-300" aria-hidden />
          <span>
            Total{" "}
            <span className="font-mono normal-case tracking-normal tabular-nums text-foreground">
              {formatTime(totalMs)}
            </span>
          </span>
        </div>

        {/* Add Instance action */}
        <div className="mt-3 flex justify-center">
          <motion.button
            onClick={addInstance}
            whileTap={{ scale: 0.96 }}
            aria-label="Add instance"
            className={cn(
              "inline-flex items-center gap-2 rounded-full pl-3 pr-5 py-2 text-white text-sm font-medium shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
              "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
            )}
          >
            <span className="grid size-7 place-items-center rounded-full bg-white/20">
              <Plus className="size-5" strokeWidth={3} />
            </span>
            Add instance
          </motion.button>
        </div>
      </div>
    </CardShell>
  );
}

function TimerBox({
  ms,
  running,
  onToggle,
}: {
  ms: number;
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-stretch w-full max-w-[18rem]">
      <div
        className={cn(
          "flex-1 flex items-center justify-center gap-2 rounded-l-2xl border-2 border-r-0 border-blue-500 bg-white px-4",
        )}
      >
        <motion.span
          animate={running ? { opacity: [1, 0.4, 1], scale: [1, 1.15, 1] } : { opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, repeat: running ? Infinity : 0 }}
          className={cn(
            "size-2.5 rounded-full",
            running ? "bg-blue-500" : "bg-stone-300",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "font-display text-4xl leading-none tabular-nums transition-colors",
            running ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {formatTime(ms)}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={running ? "Pause this instance" : "Resume this instance"}
        className={cn(
          "grid w-14 place-items-center rounded-r-2xl text-white transition-colors",
          "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
        )}
      >
        {running ? (
          <Pause className="size-6" fill="currentColor" />
        ) : (
          <Play className="size-6" fill="currentColor" />
        )}
      </button>
    </div>
  );
}

function TriangleNav({
  direction,
  onClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
}) {
  const isLeft = direction === "left";
  const Icon = isLeft ? ChevronLeft : ChevronRight;
  return (
    <motion.button
      aria-label={isLeft ? "Previous instance" : "Next instance"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "size-9 shrink-0 grid place-items-center rounded-full border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 transition disabled:opacity-30",
      )}
    >
      <Icon className="size-5" strokeWidth={2.5} />
    </motion.button>
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
