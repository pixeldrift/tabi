import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pause, Play, Plus } from "lucide-react";
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

const BUBBLE = 22;
const CENTER_W = 210;
const CENTER_H = 52;
const GAP = 8;

export function DurationCard({
  title,
  phase = "Intervention",
  description,
  minDurationSec = 30,
  isActive = true,
  onActivate,
}: DurationCardProps) {
  // Always start with instance 1 visible, paused at 0.
  const [instances, setInstances] = useState<number[]>([0]);
  const [viewIdx, setViewIdx] = useState(0);
  const [liveMs, setLiveMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const runningIdxRef = useRef<number | null>(null);

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

  const instanceMs = (idx: number) => {
    if (idx < 0 || idx >= instances.length) return 0;
    if (running && runningIdxRef.current === idx) {
      return instances[idx] + liveMs;
    }
    return instances[idx];
  };

  const totalMs = instances.reduce((a, b) => a + b, 0) + (running ? liveMs : 0);
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

  const togglePause = () => {
    if (running && runningIdxRef.current === viewIdx) {
      flushLive();
      setRunning(false);
      runningIdxRef.current = null;
    } else {
      if (running) flushLive();
      runningIdxRef.current = viewIdx;
      setRunning(true);
    }
  };

  const addInstance = () => {
    if (running) flushLive();
    const newIdx = instances.length;
    setInstances((arr) => [...arr, 0]);
    runningIdxRef.current = newIdx;
    setViewIdx(newIdx);
    setRunning(true);
  };

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(instances.length - 1, idx));
    setViewIdx(clamped);
  };

  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(
    () => -(viewIdx * stepWidth + CENTER_W / 2),
    [viewIdx, stepWidth],
  );

  const isViewingRunning = running && runningIdxRef.current === viewIdx;
  const isViewedRunning = (i: number) => running && runningIdxRef.current === i;

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
      {/* Bubble row */}
      <div className="relative px-2 pt-2">
        <div className="relative h-[68px]">
          <TriangleNav
            direction="left"
            onClick={() => goTo(viewIdx - 1)}
            disabled={viewIdx === 0}
          />
          <TriangleNav
            direction="right"
            onClick={() => goTo(viewIdx + 1)}
            disabled={viewIdx >= instances.length - 1}
          />

          <div
            className="relative h-full overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
            }}
          >
            <motion.div
              className="absolute top-1/2 left-1/2 flex items-center"
              style={{ gap: GAP, translateY: "-50%" }}
              animate={{ x: trackOffset }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              {instances.map((_, i) => {
                const isCenter = i === viewIdx;
                const centerRunning = isCenter && isViewingRunning;
                const itemRunning = isViewedRunning(i);
                return (
                  <motion.button
                    key={i}
                    onClick={() => (isCenter ? togglePause() : goTo(i))}
                    className="relative shrink-0 grid place-items-center rounded-full select-none"
                    animate={{
                      width: isCenter ? CENTER_W : BUBBLE,
                      height: isCenter ? CENTER_H : BUBBLE,
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  >
                    {isCenter ? (
                      <CenterPill
                        index={i}
                        ms={instanceMs(i)}
                        running={centerRunning}
                        onToggle={togglePause}
                      />
                    ) : (
                      <SideBubble index={i} running={itemRunning} />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </div>

        {/* Caption */}
        <div className="mt-1 flex items-center justify-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground h-4">
          <span>
            Instance{" "}
            <span className="font-mono normal-case tracking-normal tabular-nums text-foreground">
              {viewIdx + 1}
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
      </div>

      {/* Add Instance action */}
      <div className="mt-3 mb-4 flex justify-center">
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
    </CardShell>
  );
}

function CenterPill({
  index,
  ms,
  running,
  onToggle,
}: {
  index: number;
  ms: number;
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-stretch">
      <div className="flex-1 flex items-center gap-2 rounded-l-2xl border-2 border-r-0 border-blue-500 bg-white pl-3 pr-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500 text-white text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="flex-1 flex flex-col items-center justify-center leading-none">
          <AnimatePresence mode="wait">
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="font-display text-2xl tabular-nums text-foreground"
            >
              {formatTime(ms)}
            </motion.span>
          </AnimatePresence>
          {running && (
            <motion.span
              animate={{ opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="mt-1 size-1.5 rounded-full bg-blue-500"
              aria-hidden
            />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={running ? "Pause this instance" : "Start this instance"}
        className="grid w-12 place-items-center rounded-r-2xl text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
      >
        {running ? (
          <Pause className="size-5" fill="currentColor" />
        ) : (
          <Play className="size-5" fill="currentColor" />
        )}
      </button>
    </div>
  );
}

function SideBubble({ index, running }: { index: number; running: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-0 grid place-items-center rounded-full border text-[9px] font-medium tabular-nums",
        running
          ? "bg-blue-100 border-blue-300 text-blue-600"
          : "bg-stone-100 border-stone-200 text-stone-400",
      )}
    >
      {index + 1}
    </span>
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
  return (
    <motion.button
      aria-label={isLeft ? "Previous instance" : "Next instance"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-500/5 active:bg-blue-500/10 transition-colors disabled:text-foreground/30 disabled:pointer-events-none",
        isLeft ? "left-0" : "right-0",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-9" fill="currentColor" aria-hidden>
        {isLeft ? (
          <path d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z" />
        ) : (
          <path d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z" />
        )}
      </svg>
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
