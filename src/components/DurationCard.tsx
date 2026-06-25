import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Play, Square, RotateCcw } from "lucide-react";
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
  const [bouts, setBouts] = useState<number[]>([]); // each in ms
  const [activeMs, setActiveMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (startRef.current !== null) {
        setActiveMs(performance.now() - startRef.current);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const totalMs = bouts.reduce((a, b) => a + b, 0) + activeMs;
  const totalSec = totalMs / 1000;
  const progress = Math.min(100, Math.round((totalSec / minDurationSec) * 100));
  const isComplete = totalSec >= minDurationSec;
  const remaining = Math.max(0, Math.ceil(minDurationSec - totalSec));

  const start = () => {
    setRunning(true);
  };
  const stop = () => {
    if (startRef.current !== null) {
      const d = performance.now() - startRef.current;
      setBouts((b) => [...b, d]);
    }
    startRef.current = null;
    setActiveMs(0);
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setBouts([]);
    setActiveMs(0);
    startRef.current = null;
  };

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Duration"
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
          <Row label="Data type" value="Duration" />
          <Row label="Minimum" value={`${minDurationSec}s`} />
          <Row label="Bouts" value={String(bouts.length + (running ? 1 : 0))} />
          <Row label="Total" value={formatTime(totalMs)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4 flex flex-col items-center">
        <div className="flex items-baseline gap-1">
          <motion.span
            animate={running ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
            transition={{ duration: 1.2, repeat: running ? Infinity : 0 }}
            className={cn(
              "size-2 rounded-full mr-2 self-center",
              running ? "bg-red-500" : "bg-stone-300",
            )}
            aria-hidden
          />
          <span className="font-display text-5xl leading-none tabular-nums">
            {formatTime(totalMs)}
          </span>
        </div>
        <span className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {bouts.length === 0 && !running
            ? "no bouts yet"
            : `${bouts.length + (running ? 1 : 0)} ${bouts.length + (running ? 1 : 0) === 1 ? "bout" : "bouts"}`}
        </span>

        <div className="mt-4 flex items-center justify-center gap-3">
          {!running ? (
            <motion.button
              onClick={start}
              whileTap={{ scale: 0.94 }}
              className="h-10 px-6 rounded-lg flex items-center gap-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
            >
              <Play className="size-4" strokeWidth={3} /> Start
            </motion.button>
          ) : (
            <motion.button
              onClick={stop}
              whileTap={{ scale: 0.94 }}
              className="h-10 px-6 rounded-lg flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600"
            >
              <Square className="size-4" strokeWidth={3} /> Stop
            </motion.button>
          )}
          <button
            onClick={reset}
            disabled={bouts.length === 0 && !running}
            aria-label="Reset"
            className="size-10 rounded-lg grid place-items-center border border-stone-200 text-muted-foreground hover:text-foreground hover:bg-stone-50 disabled:opacity-30"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
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
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
