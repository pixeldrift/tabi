import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Check, X, CircleSlash2 } from "lucide-react";
import { PercentCorrectIcon } from "./icons/DataTypeIcons";
import { DetailsIcon } from "./icons/DetailsIcon";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { CardEditControls } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { useCardState, useResetGuard } from "./CardDataStore";
import { type CardEditAndDrawerProps } from "./CardShell";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export type TrialResult = "correct" | "incorrect" | "no-response" | null;

// Sits at the top of every prompt-level popup as a "yes, an error, but no
// particular level" choice — picking it marks the trial incorrect without
// ever populating `promptLevel`, so the Error button shows no sub-text.
const UNSPECIFIED_LEVEL = "-unspecified-";

export interface TrialCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  dataType?: string;
  description?: string;
  minTrials?: number;
  maxTrials?: number;
  isActive?: boolean;
  onActivate?: () => void;
  /** Adds a third, neutral "No Response" option between Error and Correct. */
  noResponse?: boolean;
  /** When set, Error becomes a picker for these prompt levels instead of a
   *  plain toggle — the chosen level is stored per-trial and shown as a
   *  sub-label under "Error". */
  promptLevels?: string[];
}

const BUBBLE = 18; // small bubble diameter
const BUBBLE_CENTER = 56; // center bubble diameter
const GAP = 6; // tighter spacing

export function TrialCard({
  id,
  title,
  phase = "Intervention",
  dataType = "Percent Correct",
  description = "Record whether the learner performed the target behavior independently during this trial.",
  minTrials = 10,
  maxTrials,
  isActive = true,
  onActivate,
  reorderEditing = false,
  favorited = false,
  onToggleFavorite,
  cardHidden = false,
  onToggleHidden,
  dragControls,
  detailsOpen = false,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop = 0,
  toolbarHeight = 0,
  noResponse = false,
  promptLevels,
  tileDensity,
}: TrialCardProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const cardKey = id ?? title;
  // Keyed by trial index rather than a parallel array — entries just don't
  // exist for trials that aren't "incorrect" (or don't have a level yet),
  // so it never needs to stay in sync/length with the trials array.
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>>(cardKey, "promptLevel", {});
  // Always one slot ahead of the highest-scored trial (so there's always a
  // next one ready), never fewer than minTrials, capped at maxTrials when
  // set. Anchored to the highest scored INDEX rather than the total scored
  // COUNT, since the expanded list lets trials be scored out of order.
  const [trials, setTrials] = useCardState<TrialResult[]>(cardKey, "trials", () =>
    Array.from({ length: maxTrials ?? minTrials }, () => null),
  );
  const highestScoredIdx = trials.reduce((max, t, i) => (t !== null ? i : max), -1);
  const displayCount = maxTrials ?? Math.max(minTrials, highestScoredIdx + 2);
  useEffect(() => {
    setTrials((prev) => {
      if (prev.length === displayCount) return prev;
      if (prev.length < displayCount) {
        return [...prev, ...Array(displayCount - prev.length).fill(null)];
      }
      return prev.slice(0, displayCount);
    });
  }, [displayCount]);

  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useCardState(cardKey, "current", 0);
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

  const { markDirty, resetSignal, sessionRunning } = useCardSession();
  useReportCardStatus(cardKey, completedCount > 0, isComplete);
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setTrials(Array.from({ length: maxTrials ?? minTrials }, () => null));
    setCurrent(0);
    setDirection(1);
    setLastAction({ id: 0, value: null });
    setPromptLevel({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset, maxTrials, minTrials]);

  // Shared by the standard view's Correct/Error/No-Response buttons (idx =
  // current, advance = true) and the expanded list's per-trial buttons
  // (arbitrary idx, advance = false — bulk edits shouldn't jump the
  // stepper forward).
  const applyResult = (idx: number, value: Exclude<TrialResult, null>, advance: boolean) => {
    markDirty();
    if (isMaxReached && trials[idx] === null) return;
    const isToggleOff = trials[idx] === value;
    setTrials((prev) => {
      const next = [...prev];
      next[idx] = isToggleOff ? null : value;
      return next;
    });
    // Any outcome other than "incorrect" (including toggling it off) clears
    // a leftover prompt level — otherwise switching Error -> Correct left
    // the old level's sub-text orphaned under a button that no longer
    // reflects an error at all.
    if (value !== "incorrect" || isToggleOff) {
      setPromptLevel((prev) => {
        if (!(idx in prev)) return prev;
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
    setCurrent(idx);
    setLastAction({ id: Date.now(), value: isToggleOff ? null : value });
    if (advance && !isToggleOff) {
      setTimeout(() => {
        setCurrentDir((c) => {
          const max = maxTrials ? maxTrials - 1 : Number.POSITIVE_INFINITY;
          return Math.min(c + 1, max);
        });
      }, 280);
    }
  };

  const setResult = (value: Exclude<TrialResult, null>) => applyResult(current, value, true);

  // Error, when promptLevels is set, opens a picker instead of a plain
  // toggle — picking a level marks the trial incorrect AND records which
  // level, so the two always stay in sync (no "incorrect" without a level,
  // no level surviving a switch away from incorrect).
  const pickPromptLevel = (idx: number, level: string, advance: boolean) => {
    markDirty();
    const isUnspecified = level === UNSPECIFIED_LEVEL;
    const isToggleOff =
      trials[idx] === "incorrect" && (isUnspecified ? !(idx in promptLevel) : promptLevel[idx] === level);
    setTrials((prev) => {
      const next = [...prev];
      next[idx] = isToggleOff ? null : "incorrect";
      return next;
    });
    setPromptLevel((prev) => {
      const next = { ...prev };
      if (isToggleOff || isUnspecified) delete next[idx];
      else next[idx] = level;
      return next;
    });
    setCurrent(idx);
    setLastAction({ id: Date.now(), value: isToggleOff ? null : "incorrect" });
    if (advance && !isToggleOff) {
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

  if (tileDensity) {
    const large = tileDensity === "large";
    const errorPress = () => {
      if (promptLevels && promptLevels.length > 0) pickPromptLevel(current, UNSPECIFIED_LEVEL, true);
      else setResult("incorrect");
    };
    return (
      <MiniTileShell
        title={title}
        description={description}
        density={tileDensity}
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen ?? false}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        toolbarHeight={toolbarHeight}
        details={
          <dl className="space-y-3">
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
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Correct so far</dt>
              <dd className="font-medium">
                {correctCount} / {completedCount || 0}
              </dd>
            </div>
          </dl>
        }
        actions={
          <div className={cn("flex items-center justify-center", noResponse ? "gap-1.5" : "gap-2", large && (noResponse ? "gap-2.5" : "gap-3.5"))}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                errorPress();
              }}
              disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
              aria-label="Error"
              className={cn(
                "shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-10" : "size-7",
                trials[current] === "incorrect"
                  ? "btn-bevel bg-red-500 border-red-600 text-white"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              <X className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
            {noResponse && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setResult("no-response");
                }}
                disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
                aria-label="No Response"
                className={cn(
                  "shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                  large ? "size-10" : "size-7",
                  trials[current] === "no-response"
                    ? "btn-bevel bg-amber-500 border-amber-600 text-white"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
                )}
              >
                <CircleSlash2 className={large ? "size-4" : "size-3"} strokeWidth={2.5} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setResult("correct");
              }}
              disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
              aria-label="Correct"
              className={cn(
                "shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-10" : "size-7",
                trials[current] === "correct"
                  ? "btn-bevel bg-green-500 border-green-600 text-white"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
              )}
            >
              <Check className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
          </div>
        }
      >
        <SwipeStrip
          count={trials.length}
          current={current}
          onCurrentChange={goTo}
          variant="centered"
          className="w-full"
          gapClassName={large ? "gap-2" : "gap-1.5"}
          itemWrapperClassName="flex items-center justify-center"
        >
          {(i, isCenter) => {
            const t = trials[i];
            const color =
              t === "correct"
                ? "text-green-700"
                : t === "incorrect"
                  ? "text-red-700"
                  : t === "no-response"
                    ? "text-amber-700"
                    : isCenter
                      ? "text-foreground"
                      : "text-foreground/30";
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={cn("font-display font-bold tabular-nums transition-[font-size] leading-none", color)}
                style={{ fontSize: isCenter ? (large ? 38 : 28) : large ? 13 : 10 }}
              >
                {i + 1}
              </div>
            );
          }}
        </SwipeStrip>
      </MiniTileShell>
    );
  }

  return (
    <article
      ref={articleRef}
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl overflow-hidden bg-card text-card-foreground transition-all duration-200",
        isActive
          ? "border-2 border-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      {/* Header */}
      <header className={cn("flex items-start gap-1 pl-5 pt-2 pb-0", reorderEditing ? "pr-3" : "pr-9")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          aria-label={expanded ? "Show standard view" : "Show all trials"}
          className="-ml-1.5 mt-[0.5px] shrink-0 grid place-items-center rounded-md p-0.5 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
        >
          <TimeChevronIcon
            className={cn("size-4 transition-transform duration-200", expanded && "translate-y-0.5 rotate-90")}
          />
        </button>
        <h2 className="font-display text-lg leading-[1.05] flex-1 mr-auto mt-0.5">{title}</h2>
        {reorderEditing ? (
          <CardEditControls
            favorited={favorited}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            cardHidden={cardHidden}
            onToggleHidden={onToggleHidden ?? (() => {})}
            dragControls={dragControls}
          />
        ) : (
          <div className="text-right leading-tight -mt-0.5">
            <div className="text-xs font-medium italic text-muted-foreground">{phase}</div>
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              <PercentCorrectIcon className="size-3 shrink-0" />
              <span>{dataType}</span>
            </div>
          </div>
        )}
      </header>

      {/* Positioned so the circle's center sits at the card's own corner-radius
          center (rounded-xl = 20px), rather than in the header's flex flow.
          Hidden in edit mode along with the phase/data-type label. */}
      {!reorderEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails?.();
          }}
          aria-label="Trial details"
          className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-current text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <DetailsIcon className="size-4" strokeWidth={1.5} />
        </button>
      )}

      {isActive && (
        <DataDetailsDrawer
          open={detailsOpen ?? false}
          onOpenChange={onDetailsOpenChange ?? (() => {})}
          title={title}
          description={description}
          details={
            <dl className="space-y-3">
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
          }
          top={stickyTop}
          toolbarHeight={toolbarHeight}
          cardRef={articleRef}
        />
      )}

      {/* Universal header/body divider — present in both the standard and
          expanded views, not just faded in while expanded. */}
      <div className="mx-[18px] mt-2.5 border-t border-dashed border-stone-200" />

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        )}
      >
        <div className="overflow-hidden">
      {/* Bubble row */}
      <div className="relative px-2 mt-1">
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
            className="relative h-16 overflow-visible"
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
                      : t === "no-response"
                        ? "bg-amber-50 border-amber-300"
                        : "bg-foreground/5 border-foreground/10";
                const textColor =
                  t === "correct"
                    ? "text-green-700"
                    : t === "incorrect"
                      ? "text-red-700"
                      : t === "no-response"
                        ? "text-amber-700"
                        : "text-foreground/40";
                const centerTextColor =
                  t === "correct"
                    ? "text-green-700"
                    : t === "incorrect"
                      ? "text-red-700"
                      : t === "no-response"
                        ? "text-amber-700"
                        : "text-foreground";
                const centerBg =
                  lastAction.value === "correct" && i === current - 1
                    ? "bg-green-100 border-green-400"
                    : lastAction.value === "incorrect" && i === current - 1
                      ? "bg-red-100 border-red-400"
                      : lastAction.value === "no-response" && i === current - 1
                        ? "bg-amber-100 border-amber-400"
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
                    <div
                      key={`${i}-${t ?? "none"}`}
                      className={cn(
                        "absolute inset-0 rounded-full flex items-center justify-center",
                        isCenter ? "border-2" : "border",
                        bg,
                        isCenter && !t && "bg-card border-foreground/30",
                        isCenter && centerBg,
                        isCenter && t && "animate-bubble-hop",
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
                            className={cn("font-display text-4xl leading-none tabular-nums", centerTextColor)}
                          >
                            {i + 1}
                          </motion.span>
                        </AnimatePresence>
                      ) : (
                        <span className={cn("text-[7px] font-medium leading-none", textColor)}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    {i < minTrials && !t && (
                      <span
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-1 rounded-full bg-foreground/35"
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
            className={cn("absolute inset-0 px-5 flex items-center", noResponse ? "gap-1.5" : "gap-3")}
          >
            {promptLevels && promptLevels.length > 0 ? (
              <PromptLevelButton
                levels={promptLevels}
                selectedLevel={promptLevel[current] ?? null}
                selected={trials[current] === "incorrect"}
                disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
                onPick={(level) => pickPromptLevel(current, level, true)}
              />
            ) : (
              <ActionButton
                variant="incorrect"
                selected={trials[current] === "incorrect"}
                onClick={() => setResult("incorrect")}
                disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
                dense={noResponse}
              />
            )}
            {noResponse && (
              <ActionButton
                variant="no-response"
                selected={trials[current] === "no-response"}
                onClick={() => setResult("no-response")}
                disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
                dense
              />
            )}
            <ActionButton
              variant="correct"
              selected={trials[current] === "correct"}
              onClick={() => setResult("correct")}
              disabled={!sessionRunning || (isMaxReached && trials[current] === null)}
              dense={noResponse}
            />
          </motion.div>
        </AnimatePresence>
      </div>
        </div>
      </div>

      {/* Expanded view — every trial as its own row, each with the same
          Correct/Error buttons as the standard view, so a run of trials can
          be corrected or filled in without stepping through one at a time. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ol className="px-3 pt-2 pb-3 space-y-1">
            {trials.map((t, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1" />
                <div className="flex items-center gap-1.5 shrink-0">
                  {promptLevels && promptLevels.length > 0 ? (
                    <RowPromptLevelButton
                      levels={promptLevels}
                      selectedLevel={promptLevel[i] ?? null}
                      selected={t === "incorrect"}
                      disabled={!sessionRunning}
                      onPick={(level) => pickPromptLevel(i, level, false)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => applyResult(i, "incorrect", false)}
                      disabled={!sessionRunning}
                      className={cn(
                        "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                        "border-red-300 text-red-700 hover:bg-red-50",
                        t === "incorrect" && "btn-bevel bg-red-500 border-red-600 text-white",
                      )}
                    >
                      <X className="size-3" strokeWidth={3} />
                      Error
                    </button>
                  )}
                  {noResponse && (
                    <button
                      type="button"
                      onClick={() => applyResult(i, "no-response", false)}
                      disabled={!sessionRunning}
                      className={cn(
                        "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                        "border-amber-300 text-amber-700 hover:bg-amber-50",
                        t === "no-response" && "btn-bevel bg-amber-500 border-amber-600 text-white",
                      )}
                    >
                      <CircleSlash2 className="size-2.5" strokeWidth={2.5} />
                      No Response
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => applyResult(i, "correct", false)}
                    disabled={!sessionRunning}
                    className={cn(
                      "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                      "border-green-300 text-green-700 hover:bg-green-50",
                      t === "correct" && "btn-bevel bg-green-500 border-green-600 text-white",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                    Correct
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Progress bar — flush to bottom of card */}
      {minTrials > 0 && (
        <div className="relative mt-3">
          {/* Bar background + fill — clipped to card corners */}
          <div className="relative h-5">
            <div className="absolute inset-0 bg-muted">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0",
                  isComplete
                    ? "bg-green-500/25"
                    : progress >= 50
                      ? "bg-yellow-400/25"
                      : "bg-blue-400/25",
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
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 shrink-0 aspect-square text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "-left-2" : "-right-2",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
        fill="currentColor"
        aria-hidden
      >
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

const ACTION_BUTTON_STYLES = {
  correct: {
    icon: Check,
    label: "Correct",
    classes: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClasses: "bg-green-500 border-green-600 text-white hover:bg-green-500",
  },
  incorrect: {
    icon: X,
    label: "Error",
    classes: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClasses: "bg-red-500 border-red-600 text-white hover:bg-red-500",
  },
  // Neutral (not positive or negative), same amber used for Task Analysis's
  // Prompted option, so "the target behavior didn't happen at all" reads
  // distinctly from both Correct and Error.
  "no-response": {
    icon: CircleSlash2,
    label: "No Response",
    classes: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClasses: "bg-amber-500 border-amber-600 text-white hover:bg-amber-500",
  },
} as const;

function ActionButton({
  variant,
  onClick,
  selected,
  disabled,
  dense = false,
}: {
  variant: keyof typeof ACTION_BUTTON_STYLES;
  onClick: () => void;
  selected: boolean;
  disabled?: boolean;
  /** Tighter gap/padding/text for the 3-button row (Error/No Response/Correct)
   *  — "No Response" doesn't fit at the 2-button row's roomier sizing. */
  dense?: boolean;
}) {
  const { icon: Icon, label, classes, selectedClasses } = ACTION_BUTTON_STYLES[variant];
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      animate={selected ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "btn-bevel flex-1 min-w-0 h-10 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-40",
        dense ? "gap-1 px-1" : "gap-1.5 px-2",
        classes,
        selected && selectedClasses,
      )}
    >
      <Icon
        className={cn("shrink-0", variant === "no-response" ? "size-3" : "size-4")}
        strokeWidth={variant === "no-response" ? 2.5 : 3}
      />
      <span className={cn("font-medium truncate", dense ? "text-[13px]" : "text-sm")}>{label}</span>
    </motion.button>
  );
}

/** Error, when a card has prompt levels configured, opens a small anchored
 *  picker instead of toggling directly — same visual language as the app's
 *  other anchored popovers (TimeOfDayKeypad, NumberKeypad). */
function PromptLevelButton({
  levels,
  selectedLevel,
  selected,
  disabled,
  onPick,
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  disabled?: boolean;
  onPick: (level: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          whileTap={{ scale: 0.94 }}
          animate={selected ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "btn-bevel flex-1 min-w-0 h-10 rounded-full border-2 flex flex-col items-center justify-center transition-colors disabled:opacity-40",
            "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
            selected && "bg-red-500 border-red-600 text-white hover:bg-red-500",
          )}
        >
          <span className="flex items-center gap-1.5">
            <X className="size-4 shrink-0" strokeWidth={3} />
            <span className="text-sm font-medium">Error</span>
            <TimeChevronIcon
              className={cn(
                "size-2.5 shrink-0 transition-transform duration-200",
                open && "-rotate-90",
              )}
            />
          </span>
          {selectedLevel && (
            <span className={cn("text-[10px] leading-none -mt-0.5", selected ? "text-white/80" : "text-red-600/70")}>
              {selectedLevel}
            </span>
          )}
        </motion.button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={8}
        className="w-auto min-w-[9rem] rounded-2xl border-2 border-red-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(UNSPECIFIED_LEVEL);
              setOpen(false);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-sm font-medium italic transition-colors",
              selected && !selectedLevel
                ? "bg-red-500 text-white"
                : "text-red-700/70 hover:bg-red-50",
            )}
          >
            {UNSPECIFIED_LEVEL}
          </button>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPick(level);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
                selectedLevel === level
                  ? "bg-red-500 text-white"
                  : "text-red-700 hover:bg-red-50",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Compact version of PromptLevelButton for the expanded list's per-row
 *  Error button — same popover-picker behavior, sized to match the row's
 *  other small pill buttons instead of the standard view's large ones. */
function RowPromptLevelButton({
  levels,
  selectedLevel,
  selected,
  disabled,
  onPick,
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  disabled?: boolean;
  onPick: (level: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          className={cn(
            "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
            "border-red-300 text-red-700 hover:bg-red-50",
            selected && "btn-bevel bg-red-500 border-red-600 text-white",
          )}
        >
          <X className="size-3" strokeWidth={3} />
          {selectedLevel ?? "Error"}
          <TimeChevronIcon
            className={cn("size-2 shrink-0 transition-transform duration-200", open && "-rotate-90")}
          />
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={8}
        className="w-auto min-w-[9rem] rounded-2xl border-2 border-red-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(UNSPECIFIED_LEVEL);
              setOpen(false);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-sm font-medium italic transition-colors",
              selected && !selectedLevel
                ? "bg-red-500 text-white"
                : "text-red-700/70 hover:bg-red-50",
            )}
          >
            {UNSPECIFIED_LEVEL}
          </button>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPick(level);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
                selectedLevel === level
                  ? "bg-red-500 text-white"
                  : "text-red-700 hover:bg-red-50",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

