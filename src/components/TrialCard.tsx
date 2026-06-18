import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Check, X, Info, Sparkles } from "lucide-react";
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
  isActive?: boolean;
  onActivate?: () => void;
}

const BUBBLE = 18; // small bubble diameter (smaller)
const BUBBLE_CENTER = 64; // center bubble diameter
const GAP = 6; // tighter spacing

export function TrialCard({
  title,
  phase = "Intervention",
  dataType = "% correct",
  description = "Record whether the learner performed the target behavior independently during this trial.",
  minTrials = 10,
  maxTrials,
  initialTrialCount = 20,
  isActive = true,
  onActivate,
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
  const remaining = Math.max(0, minTrials - completedCount);

  const setResult = (value: Exclude<TrialResult, null>) => {
    if (isMaxReached && trials[current] === null) return;
    const isToggleOff = trials[current] === value;
    setTrials((prev) => {
      const next = [...prev];
      if (!isToggleOff && current >= next.length - 2 && maxTrials === undefined) {
        next.push(null, null, null);
      }
      next[current] = isToggleOff ? null : value;
      return next;
    });
    setLastAction({ id: Date.now(), value: isToggleOff ? null : value });
    if (!isToggleOff) {
      setTimeout(() => {
        setCurrent((c) => {
          const max = maxTrials ? maxTrials - 1 : Number.POSITIVE_INFINITY;
          return Math.min(c + 1, max);
        });
      }, 280);
    }
  };

  const goTo = (idx: number) => {
    const max = maxTrials ? maxTrials - 1 : trials.length - 1;
    setCurrent(Math.max(0, Math.min(idx, max)));
  };

  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(
    () => -(current * stepWidth + BUBBLE_CENTER / 2),
    [current, stepWidth],
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const finalOffset = trackOffset + info.offset.x;
    const targetIdx = Math.round(-(finalOffset + BUBBLE_CENTER / 2) / stepWidth);
    const max = maxTrials ? maxTrials - 1 : trials.length - 1;
    const clamped = Math.max(0, Math.min(targetIdx, max));
    setCurrent(clamped);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
  };

  return (
    <article
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-3xl bg-card text-card-foreground shadow-lift overflow-hidden border-2 transition-all duration-200",
        isActive
          ? "border-blue-400/80 shadow-[0_0_0_4px_rgba(96,165,250,0.15)]"
          : "border-border/40 opacity-70 hover:opacity-90",
      )}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 pt-3 pb-3">
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
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Info className="size-6" />
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


      {/* Bubble row */}
      <div className="relative mt-1 px-2">
        <div className="relative h-20">
          {/* Triangle nav buttons — centered with bubbles */}
          <TriangleNav
            direction="left"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
          />
          <TriangleNav
            direction="right"
            onClick={() => goTo(current + 1)}
            disabled={maxTrials ? current >= maxTrials - 1 : false}
          />

          <div
            ref={containerRef}
            className="relative h-20 overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
            }}
          >
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
                const bg =
                  t === "correct"
                    ? "bg-green-300 border-green-400"
                    : t === "incorrect"
                      ? "bg-red-300 border-red-400"
                      : "bg-foreground/5 border-foreground/10";
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
                    className="relative shrink-0 grid place-items-center rounded-full font-medium select-none"
                    animate={{
                      width: isCenter ? BUBBLE_CENTER : BUBBLE,
                      height: isCenter ? BUBBLE_CENTER : BUBBLE,
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
                            className="font-display text-3xl text-foreground"
                          >
                            {i + 1}
                          </motion.span>
                        </AnimatePresence>
                      ) : t ? (
                        <span className="text-[7px] leading-none font-medium text-foreground/35">
                          {i + 1}
                        </span>
                      ) : i < minTrials ? (
                        <span className="size-1 rounded-full bg-foreground/30" aria-hidden />
                      ) : (
                        <span className="text-[7px] leading-none font-medium text-foreground/35">
                          {i + 1}
                        </span>
                      )}
                    </motion.div>
                  </motion.button>
                );
              })}
              {maxTrials && (
                <div
                  className="shrink-0 w-px bg-foreground/40 mx-2"
                  style={{ height: 40 }}
                  aria-hidden
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Helper text under bubbles */}
        <div className="mt-1 text-center text-xs text-muted-foreground">
          Trial {current + 1} of {target} {maxTrials ? "max" : "required"}
        </div>
      </div>


      {/* Action buttons row with slide animation */}
      <div className="relative mt-4 px-5 h-16 overflow-hidden">
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

      {/* Progress bar — flush to bottom of card */}
      <div className="relative mt-3">
        <div className="relative h-5">
          <div className="absolute inset-0 bg-muted border-t border-border overflow-hidden">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0",
                isComplete ? "bg-green-300" : "bg-accent/70",
              )}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 26 }}
            />
          </div>

          {/* Status text inside bar — single line */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
            <span className="text-[10px] font-medium text-foreground/75 leading-none whitespace-nowrap">
              {isComplete
                ? isMaxReached
                  ? "Maximum trials reached! Congrats!"
                  : "Minimum trials reached. This data can now be graphed."
                : `Conduct at least ${remaining} more ${remaining === 1 ? "trial" : "trials"} to graph this target`}
            </span>
          </div>

          {/* Progress bubble — anchored to bar bottom so it sits on top without clipping */}
          <motion.div
            className="absolute bottom-0 z-10"
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
                  : "bg-card border-foreground/40 text-foreground",
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
      aria-label={isLeft ? "Previous trial" : "Next trial"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 rounded-full text-foreground/85 hover:text-foreground hover:bg-foreground/5 active:bg-foreground/10 transition-colors disabled:opacity-25 disabled:pointer-events-none",
        isLeft ? "left-0" : "right-0",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-9" fill="currentColor" aria-hidden>
        {isLeft ? (
          <path
            d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </motion.button>
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
        "flex-1 h-14 rounded-2xl border-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-40",
        isCorrect
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          (isCorrect
            ? "bg-green-400 border-green-500 text-white"
            : "bg-red-400 border-red-500 text-white"),
      )}
    >
      {isCorrect ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
      <span className="text-sm font-medium">
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
