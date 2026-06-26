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

const BUBBLE = 18; // small bubble diameter
const BUBBLE_CENTER = 48; // center bubble diameter
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
  const [direction, setDirection] = useState<1 | -1>(1);
  const setCurrentDir = (next: number | ((c: number) => number)) => {
    setCurrent((c) => {
      const n = typeof next === "function" ? (next as (c: number) => number)(c) : next;
      setDirection(n >= c ? 1 : -1);
      return n;
    });
  };
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
        setCurrentDir((c) => {
          const max = maxTrials ? maxTrials - 1 : Number.POSITIVE_INFINITY;
          return Math.min(c + 1, max);
        });
      }, 280);
    }
  };

  const goTo = (idx: number) => {
    const max = maxTrials ? maxTrials - 1 : trials.length - 1;
    const clamped = Math.max(0, Math.min(idx, max));
    // Allow navigation to any trial with data, or the next empty trial after the last completed one.
    if (trials[clamped] === null && clamped > completedCount) return;
    setCurrentDir(clamped);
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
    setCurrentDir(clamped);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
  };

  return (
    <article
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        isActive
          ? "border-2 border-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      {/* Header */}
      <header className="flex items-start gap-3 pl-5 pr-3 pt-3 pb-0">
        <h2 className="font-display text-xl leading-tight flex-1 mr-auto">{title}</h2>
        <div className="flex items-start gap-2">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium text-blue-400">{phase}</div>
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
      <div className="relative px-2 -mt-1">
        <div className="relative h-16">
          {/* Triangle nav buttons — centered with bubbles */}
          <TriangleNav
            direction="left"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
          />
          <TriangleNav
            direction="right"
            onClick={() => goTo(current + 1)}
            disabled={
              (trials[current] === null && current >= completedCount) ||
              (maxTrials ? current >= maxTrials - 1 : false)
            }
          />



          <div
            ref={containerRef}
            className="relative h-16 overflow-hidden"
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
                    ? "bg-green-50 border-green-300"
                    : t === "incorrect"
                      ? "bg-red-50 border-red-300"
                      : "bg-foreground/5 border-foreground/10";
                const textColor =
                  t === "correct"
                    ? "text-green-700"
                    : t === "incorrect"
                      ? "text-red-700"
                      : "text-foreground/40";
                const centerTextColor =
                  t === "correct"
                    ? "text-green-700"
                    : t === "incorrect"
                      ? "text-red-700"
                      : "text-foreground";
                const centerBg =
                  lastAction.value === "correct" && i === current - 1
                    ? "bg-green-100 border-green-400"
                    : lastAction.value === "incorrect" && i === current - 1
                      ? "bg-red-100 border-red-400"
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
                        "absolute inset-0 rounded-full flex items-center justify-center",
                        isCenter ? "border-2" : "border",
                        bg,
                        isCenter && !t && "bg-card border-foreground/30 shadow-[0_2px_10px_rgba(0,0,0,0.15)]",
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
                            className={cn("font-display text-3xl leading-none", centerTextColor)}
                          >
                            {i + 1}
                          </motion.span>
                        </AnimatePresence>
                      ) : (
                        <span className={cn("text-[7px] font-medium leading-none", textColor)}>
                          {i + 1}
                        </span>
                      )}
                    </motion.div>
                    {i < minTrials && (
                      <span
                        className={cn(
                          "absolute -bottom-2 left-1/2 -translate-x-1/2 size-1 rounded-full",
                          t === "correct"
                            ? "bg-green-500"
                            : t === "incorrect"
                              ? "bg-red-500"
                              : "bg-foreground/35",
                        )}
                        aria-hidden
                      />
                    )}
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
        <div className="text-center text-xs text-muted-foreground">
          Trial {current + 1} of {target} {maxTrials ? "max" : "required"}
        </div>
      </div>



      {/* Action buttons row with slide animation */}
      <div className="relative mt-3 px-5 h-12 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current}
            initial={{ x: direction > 0 ? "60%" : "-60%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? "-60%" : "60%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="absolute inset-0 px-5 flex items-center gap-3"
          >
            <ActionButton
              variant="incorrect"
              selected={trials[current] === "incorrect"}
              onClick={() => setResult("incorrect")}
              disabled={isMaxReached && trials[current] === null}
            />
            <ActionButton
              variant="correct"
              selected={trials[current] === "correct"}
              onClick={() => setResult("correct")}
              disabled={isMaxReached && trials[current] === null}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar — flush to bottom of card */}
      {minTrials > 0 && (
        <div className="relative mt-3">
          {/* Bar background + fill — clipped to card corners */}
          <div className="relative h-5 overflow-hidden rounded-b-xl">
            <div className="absolute inset-0 bg-muted">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0",
                  isComplete ? "bg-green-500/25" : "bg-blue-400/25",
                )}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>

            {/* Helper text inside the bar */}
            <div className="absolute inset-0 flex items-center justify-center px-5 text-[11px] text-foreground/75 leading-none pointer-events-none">
              {isComplete ? (
                isMaxReached
                  ? "Maximum trials reached! Congrats!"
                  : "Minimum trials reached. This data can now be graphed."
              ) : (
                <span>
                  Conduct at least <strong className="font-semibold">{remaining} more</strong>{" "}
                  {remaining === 1 ? "trial" : "trials"} to graph this target.
                </span>
              )}
            </div>
          </div>

          {/* Progress indicator — sits on top of bar, can extend outside card */}
          <motion.div
            className="absolute bottom-0 left-0 z-30 pointer-events-none"
            animate={{ left: `${progress}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            style={{ translateX: "-50%" }}
          >
            <motion.div
              animate={isComplete ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.7 }}
              className="relative flex flex-col items-center"
            >
              <div
                className={cn(
                  "grid place-items-center h-[18px] min-w-[30px] px-1.5 rounded-md text-[10px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
                  isComplete ? "bg-green-500" : "bg-blue-500",
                )}
              >
                {isComplete ? <Check className="size-3" strokeWidth={3} /> : `${progress}%`}
              </div>
              <div
                className={cn(
                  "w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent",
                  isComplete ? "border-t-green-500" : "border-t-blue-500",
                )}
                aria-hidden
              />
              {isComplete && <Starburst />}
            </motion.div>
          </motion.div>
        </div>
      )}




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
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-500/5 active:bg-blue-500/10 transition-colors disabled:text-foreground/30 disabled:pointer-events-none",
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
        "flex-1 h-10 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-40",
        isCorrect
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          (isCorrect
            ? "bg-green-500 border-green-600 text-white hover:bg-green-500"
            : "bg-red-500 border-red-600 text-white hover:bg-red-500"),

      )}
    >
      {isCorrect ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
      <span className="text-sm font-medium">
        {isCorrect ? "Correct" : "Error"}
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
