import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Pause, Play, Plus } from "lucide-react";
import { CardShell } from "./CardShell";
import { NumberKeypad } from "./NumberKeypad";
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
  const [bumpKey, setBumpKey] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(true);
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
    setBumpKey((k) => k + 1);
  };

  const triggerFlash = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 450);
  };

  const inc = () => {
    setDir(1);
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
    triggerFlash();
  };
  const dec = () => {
    setDir(-1);
    setCount((c) => Math.max(0, c - 1));
    setBumpKey((k) => k + 1);
    triggerFlash();
  };

  const commit = (next: number) => {
    setDir(next >= count ? 1 : -1);
    setCount(next);
    setBumpKey((k) => k + 1);
    triggerFlash();
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
      editing={editing}
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
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={dec}
          disabled={count === 0}
          aria-label="Decrement"
          className="size-12 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
        >
          <Minus className="size-5" strokeWidth={2.5} />
        </button>

        <NumberKeypad
          value={count}
          onReplace={(v) => commit(v)}
          onAdd={(delta) => commit(count + delta)}
          onOpenChange={setEditing}
        >
          {({ isEditing, open }) => (
            <button
              type="button"
              onClick={open}
              className="flex flex-col items-center justify-center min-w-[6rem] cursor-text rounded-lg px-3 py-1 transition-colors"
              aria-label={`Current tally is ${count}. Tap to edit.`}
            >
              <div className="relative overflow-hidden rounded-lg px-2 py-0.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={bumpKey}
                    initial={{ y: dir > 0 ? "100%" : "-100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: dir > 0 ? "-100%" : "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
                    className={cn(
                      "block font-display text-5xl leading-none tabular-nums transition-colors",
                      isEditing ? "text-blue-600" : "text-foreground",
                      flash && "text-blue-600",
                    )}
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
                {isEditing && (
                  <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-blue-400/80" aria-hidden />
                )}
              </div>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors",
                  isEditing ? "text-blue-500" : "text-muted-foreground",
                )}
              >
                <span>Times per</span>
                <span className="inline-flex items-center rounded border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums normal-case tracking-normal text-foreground">
                  {formatTime(elapsed)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  aria-label={running ? "Pause timer" : "Resume timer"}
                  className="grid size-5 place-items-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  {running ? <Pause className="size-3" /> : <Play className="size-3" />}
                </button>
                {(count > 0 || elapsed > 0) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    aria-label="Reset"
                    className="grid size-4 place-items-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                )}
              </div>
            </button>
          )}
        </NumberKeypad>

        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
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
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
