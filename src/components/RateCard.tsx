import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Minus, Pause, Play, Plus } from "lucide-react";
import { CardShell } from "./CardShell";
import { NumberKeypad } from "./NumberKeypad";
import { TimeKeypad } from "./TimeKeypad";
import { useRegisterActiveTimer, useSession } from "./SessionContext";
import { cn } from "@/lib/utils";

export interface RateCardProps {
  title: string;
  phase?: string;
  description?: string;
  /** Required observation window, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
  /** When true, the timer is linked to the session timer: no play/pause, lock icon, gray display. */
  locked?: boolean;
}

export function RateCard({
  title,
  phase = "Intervention",
  description,
  minDurationSec = 60,
  isActive = true,
  onActivate,
  locked = false,
}: RateCardProps) {
  const [count, setCount] = useState(0);
  const [bumpKey, setBumpKey] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { sessionRunning, subscribeTick, markDirty, resetSignal } = useSession();

  useEffect(() => {
    if (resetSignal === 0) return;
    setCount(0);
    setElapsed(0);
    setRunning(true);
    setFlash(false);
    setBumpKey((k) => k + 1);
  }, [resetSignal]);
  // Locked timers always follow the session. Unlocked timers tick only when
  // BOTH the session is running and the card timer is running.
  const ticking = locked ? sessionRunning : sessionRunning && running;
  useRegisterActiveTimer({
    id: `rate:${title}`,
    label: title,
    active: ticking && !locked,
    elementRef: cardRef,
    source: "rate",
  });

  useEffect(() => {
    if (!ticking) return;
    return subscribeTick((d) => setElapsed((e) => e + d));
  }, [ticking, subscribeTick]);

  // When the session pauses, pause the (unlocked) card timer too so the user
  // must explicitly resume it. Locked timers ignore `running` entirely.
  useEffect(() => {
    if (!sessionRunning && running) setRunning(false);
  }, [sessionRunning, running]);

  const toggle = () => {
    setRunning((r) => !r);
    markDirty();
  };

  const setElapsedMs = (ms: number) => {
    setElapsed(ms);
    markDirty();
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
    markDirty();
  };
  const dec = () => {
    setDir(-1);
    setCount((c) => Math.max(0, c - 1));
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };

  const commit = (next: number) => {
    setDir(next >= count ? 1 : -1);
    setCount(next);
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };

  return (
    <div ref={cardRef} className="w-full max-w-md scroll-mt-32">
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
          className="size-12 shrink-0 aspect-square rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
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
            <div className="flex flex-col items-center justify-center min-w-[6rem] px-3 py-1">
              <button
                type="button"
                onClick={open}
                className="relative overflow-hidden rounded-lg px-2 py-0.5 cursor-text"
                aria-label={`Current tally is ${count}. Tap to edit.`}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={bumpKey}
                    initial={{ y: dir > 0 ? "100%" : "-100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: dir > 0 ? "-100%" : "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
                    style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                    className={cn(
                      "block font-display text-4xl leading-none tabular-nums",
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
              </button>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors",
                  isEditing ? "text-blue-500" : "text-muted-foreground",
                )}
              >
                <span>{count === 1 ? "Time in" : "Times in"}</span>
                <span className="inline-flex items-center">
                  {locked ? (
                    <>
                      <span
                        aria-label="Elapsed time (linked to session)"
                        className="inline-flex items-center border border-stone-300 bg-stone-100 pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full text-muted-foreground"
                      >
                        {formatTime(elapsed)}
                      </span>
                      <span
                        aria-label="Timer is linked to session"
                        className="grid size-5 place-items-center rounded-r-full bg-stone-300 text-stone-600"
                      >
                        <Lock className="size-3" strokeWidth={2.5} />
                      </span>
                    </>
                  ) : (
                    <>
                      <TimeKeypad
                        valueMs={elapsed}
                        onReplace={(ms) => setElapsedMs(ms)}
                        onAdd={(ms) => setElapsedMs(elapsed + ms)}
                      >
                        {({ open: openTime }) => (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTime();
                            }}
                            aria-label="Edit elapsed time"
                            className={cn(
                              "inline-flex items-center border border-blue-500 bg-white pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full cursor-text hover:bg-blue-50 transition-colors",
                              running ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {formatTime(elapsed)}
                          </button>
                        )}
                      </TimeKeypad>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle();
                        }}
                        aria-label={running ? "Pause timer" : "Resume timer"}
                        className="grid size-5 place-items-center rounded-r-full bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors"
                      >
                        {running ? <Pause className="size-3" fill="currentColor" /> : <Play className="size-3" fill="currentColor" />}
                      </button>
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
        </NumberKeypad>


        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "size-16 shrink-0 aspect-square rounded-full grid place-items-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-7" strokeWidth={3} />
        </motion.button>
      </div>
    </CardShell>
    </div>
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
