import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Play, Pause, Plus, RotateCcw } from "lucide-react";
import { CardShell } from "./CardShell";
import { cn } from "@/lib/utils";

export interface RateCardProps {
  title: string;
  phase?: string;
  description?: string;
  /** Required observation window, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

export function RateCard({
  title,
  phase = "Intervention",
  description,
  minDurationSec = 60,
  isActive = true,
  onActivate,
}: RateCardProps) {
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(baseRef.current + (performance.now() - startRef.current));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      baseRef.current = elapsed;
      setRunning(false);
    } else {
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setCount(0);
    setElapsed(0);
    baseRef.current = 0;
    startRef.current = null;
  };

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Rate / min"
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Rate (per minute)" />
          <Row label="Required window" value={`${minDurationSec}s`} />
          <Row label="Count" value={String(count)} />
          <Row label="Elapsed" value={formatTime(elapsed)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4">
        <div className="flex flex-col items-center">
          <span className="font-display text-5xl leading-none tabular-nums">
            {count}
          </span>
          <span className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            tally
          </span>
          <span className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">
            {formatTime(elapsed)}
          </span>
        </div>


        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={toggle}
            className={cn(
              "h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-medium border-2 transition-colors",
              running
                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
            )}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
          </button>
          <motion.button
            onClick={() => setCount((c) => c + 1)}
            disabled={!running}
            whileTap={{ scale: 0.94 }}
            className="h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="size-4" strokeWidth={3} /> Tally
          </motion.button>
          <button
            onClick={reset}
            disabled={count === 0 && elapsed === 0}
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
