import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Check, X, ChevronLeft, ChevronRight, Info, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type TrialResult = "correct" | "incorrect" | null;

export interface TrialCardProps {
  title: string;
  phase?: string;
  dataType?: string;
  description?: string;
  minTrials?: number;
  maxTrials?: number;
  initialTrialCount?: number;
}

const BUBBLE = 28; // small bubble diameter
const BUBBLE_CENTER = 64; // center bubble diameter
const GAP = 12;

export function TrialCard({
  title,
  phase = "Intervention",
  dataType = "% correct",
  description = "Record whether the learner performed the target behavior independently during this trial.",
  minTrials = 10,
  maxTrials,
  initialTrialCount = 20,
}: TrialCardProps) {
  const initial = maxTrials ?? Math.max(initialTrialCount, minTrials + 5);
  const [trials, setTrials] = useState<TrialResult[]>(() =>
    Array.from({ length: initial }, () => null),
  );
  const [current, setCurrent] = useState(0);
  const [lastAction, setLastAction] = useState<{ id: number; value: TrialResult }>({
    id: 0,
    value: null,
  });

  const dragX = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const completedCount = trials.filter((t) => t !== null).length;
  const correctCount = trials.filter((t) => t === "correct").length;
  const target = maxTrials ?? minTrials;
  const progress = Math.min(100, Math.round((completedCount / target) * 100));
  const isComplete = completedCount >= target;
  const isMaxReached = maxTrials !== undefined && completedCount >= maxTrials;

  const setResult = (value: Exclude<TrialResult, null>) => {
    if (isMaxReached) return;
    setTrials((prev) => {
      const next = [...prev];
      // Ensure capacity if no max
      if (current >= next.length - 2 && maxTrials === undefined) {
        next.push(null, null, null);
      }
      next[current] = value;
      return next;
    });
    setLastAction({ id: Date.now(), value });
    setTimeout(() => {
      setCurrent((c) => {
        const max = maxTrials ? maxTrials - 1 : Number.POSITIVE_INFINITY;
        return Math.min(c + 1, max);
      });
    }, 280);
  };

  const goTo = (idx: number) => {
    const max = maxTrials ? maxTrials - 1 : trials.length - 1;
    setCurrent(Math.max(0, Math.min(idx, max)));
  };

  // Bubble track offset — center bubble stays centered
  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(() => -current * stepWidth, [current, stepWidth]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const totalOffset = trackOffset + info.offset.x + dragX.get() - dragX.get();
    const targetIdx = Math.round(-(trackOffset + info.offset.x) / stepWidth);
    const max = maxTrials ? maxTrials - 1 : trials.length - 1;
    const clamped = Math.max(0, Math.min(targetIdx, max));
    setCurrent(clamped);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
    void totalOffset;
  };

  return (
    <article className="relative w-full max-w-md rounded-3xl bg-card text-card-foreground shadow-lift overflow-hidden border border-border/60">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-display text-xl leading-tight flex-1">{title}</h2>
        <div className="flex items-start gap-2">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium text-foreground/80">{phase}</div>
            <div className="text-[11px] text-muted-foreground">{dataType}</div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                aria-label="Trial details"
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Info className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88%] sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-display">{title}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </SheetHeader>
              <dl className="mt-6 space-y-3 px-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phase</dt>
                  <dd className="font-medium">{phase}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Data type</dt>
                  <dd className="font-medium">{dataType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Minimum trials</dt>
                  <dd className="font-medium">{minTrials}</dd>
                </div>
                {maxTrials && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Maximum trials</dt>
                    <dd className="font-medium">{maxTrials}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Correct so far</dt>
                  <dd className="font-medium">
                    {correctCount} / {completedCount || 0}
                  </dd>
                </div>
              </dl>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Trial subtitle */}
      <div className="px-5 pt-2 text-center">
        <div className="inline-flex items-baseline gap-1.5">
          <span className="font-display text-3xl tracking-tight">
            Trial {current + 1}
          </span>
          <span className="text-xs text-muted-foreground">
            of {target} {maxTrials ? "max" : "required"}
          </span>
        </div>
      </div>

      {/* Bubble row */}
      <div className="relative mt-4 px-2">
        {/* Side nav */}
        <button
          aria-label="Previous trial"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-8 rounded-full bg-background/80 backdrop-blur border border-border text-foreground/70 disabled:opacity-30 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="Next trial"
          onClick={() => goTo(current + 1)}
          disabled={maxTrials ? current >= maxTrials - 1 : false}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-8 rounded-full bg-background/80 backdrop-blur border border-border text-foreground/70 disabled:opacity-30 hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>

        {/* Edge fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-card to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-card to-transparent z-10" />

        <div ref={containerRef} className="relative h-20 overflow-hidden">
          {/* Center reference */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-16" />
          </div>

          <motion.div
            className="absolute top-1/2 left-1/2 flex items-center"
            style={{
              gap: GAP,
              x: dragX,
              translateY: "-50%",
            }}
            animate={{ x: trackOffset }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="x"
            dragConstraints={{ left: -((trials.length - 1) * stepWidth) - 200, right: 200 }}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
          >
            {trials.map((t, i) => {
              const isCenter = i === current;
              const isRequired = i < minTrials;
              const bg =
                t === "correct"
                  ? "bg-green-200/80 border-green-400"
                  : t === "incorrect"
                    ? "bg-red-200/80 border-red-400"
                    : "bg-muted border-border";
              const centerBg =
                lastAction.value === "correct" && i === current - 1
                  ? "bg-green-400 border-green-500 text-white"
                  : lastAction.value === "incorrect" && i === current - 1
                    ? "bg-red-400 border-red-500 text-white"
                    : "";
              return (
                <motion.button
                  key={i}
                  onClick={() => goTo(i)}
                  className="relative shrink-0 grid place-items-center rounded-full border-2 font-medium select-none"
                  animate={{
                    width: isCenter ? BUBBLE_CENTER : BUBBLE,
                    height: isCenter ? BUBBLE_CENTER : BUBBLE,
                    marginLeft: isCenter ? (BUBBLE_CENTER - BUBBLE) / 2 : 0,
                    marginRight: isCenter ? (BUBBLE_CENTER - BUBBLE) / 2 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                >
                  <motion.div
                    key={`${i}-${t ?? "none"}`}
                    initial={isCenter && t ? { scale: 0.6 } : false}
                    animate={isCenter && t ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                    transition={{ duration: 0.45 }}
                    className={cn(
                      "absolute inset-0 rounded-full border-2 flex items-center justify-center",
                      bg,
                      isCenter && !t && "bg-card border-foreground/30 shadow-soft",
                      isCenter && centerBg,
                    )}
                  >
                    {isCenter ? (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.25 }}
                          className="font-display text-xl text-foreground"
                        >
                          {i + 1}
                        </motion.span>
                      </AnimatePresence>
                    ) : (
                      isRequired &&
                      t === null && (
                        <span className="size-1.5 rounded-full bg-foreground/30" />
                      )
                    )}
                  </motion.div>
                </motion.button>
              );
            })}
            {/* End marker */}
            {maxTrials && (
              <div
                className="shrink-0 self-stretch w-px bg-foreground/40 mx-2"
                style={{ height: 48 }}
                aria-hidden
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* Action buttons row with slide animation */}
      <div className="relative mt-4 px-5 h-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent z-10" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current}
            initial={{ x: "60%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-60%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="absolute inset-0 px-5 flex items-center gap-3"
          >
            <ActionButton
              variant="incorrect"
              selected={lastAction.value === "incorrect" && lastAction.id !== 0}
              onClick={() => setResult("incorrect")}
              disabled={isMaxReached}
            />
            <ActionButton
              variant="correct"
              selected={lastAction.value === "correct" && lastAction.id !== 0}
              onClick={() => setResult("correct")}
              disabled={isMaxReached}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-5 pt-3">
        <div className="relative h-9 rounded-full bg-muted overflow-hidden border border-border">
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              isComplete ? "bg-green-300/70" : "bg-accent/60",
            )}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
          />
          {isComplete && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-foreground/80">
              {isMaxReached
                ? "Maximum trials reached! Congrats!"
                : "Minimum trials reached. This data can now be graphed."}
            </div>
          )}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2"
            animate={{ left: `calc(${progress}% - 18px)` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
          >
            <motion.div
              animate={
                isComplete
                  ? { scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.7, repeat: isComplete ? 1 : 0 }}
              className={cn(
                "relative grid place-items-center size-9 rounded-full border-2 shadow-soft text-xs font-semibold",
                isComplete
                  ? "bg-green-500 border-green-600 text-white"
                  : "bg-card border-foreground/30 text-foreground",
              )}
            >
              {isComplete ? <Check className="size-4" /> : `${progress}%`}
              {isComplete && <Starburst />}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  variant,
  onClick,
  selected,
  disabled,
}: {
  variant: "correct" | "incorrect";
  onClick: () => void;
  selected: boolean;
  disabled?: boolean;
}) {
  const isCorrect = variant === "correct";
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      animate={selected ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex-1 h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-40",
        isCorrect
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          (isCorrect
            ? "bg-green-400 border-green-500 text-white"
            : "bg-red-400 border-red-500 text-white"),
      )}
    >
      {isCorrect ? <Check className="size-7" strokeWidth={3} /> : <X className="size-7" strokeWidth={3} />}
      <span className="text-[10px] uppercase tracking-wider font-medium">
        {isCorrect ? "Correct" : "Incorrect"}
      </span>
    </motion.button>
  );
}

function Starburst() {
  const rays = Array.from({ length: 8 });
  return (
    <span className="absolute inset-0 pointer-events-none">
      {rays.map((_, i) => {
        const angle = (i / rays.length) * Math.PI * 2;
        const x = Math.cos(angle) * 22;
        const y = Math.sin(angle) * 22;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -ml-1 -mt-1 size-2 rounded-full bg-yellow-300"
          />
        );
      })}
      <motion.span
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.7 }}
        className="absolute inset-0 grid place-items-center text-yellow-400"
      >
        <Sparkles className="size-6" />
      </motion.span>
    </span>
  );
}
