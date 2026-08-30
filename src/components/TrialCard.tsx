import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Check, X, CircleSlash2, ChevronLeft, ChevronRight } from "lucide-react";
import { PercentCorrectIcon } from "./icons/PercentCorrectIcon";
import { DetailsIcon } from "./icons/DetailsIcon";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { VerbalPromptIcon } from "./icons/VerbalPromptIcon";
import { GesturalPromptIcon } from "./icons/GesturalPromptIcon";
import { ModelingPromptIcon } from "./icons/ModelingPromptIcon";
import { PartialPhysicalPromptIcon } from "./icons/PartialPhysicalPromptIcon";
import { FullPhysicalPromptIcon } from "./icons/FullPhysicalPromptIcon";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { CardEditControls } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { PhaseInfoLabel, DataTypeInfoLabel } from "./KindInfoLabels";
import { ListActionBadge, ListActionButton, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { ExpandableArea, type CardEditAndDrawerProps } from "./CardShell";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { renderBreakableTitle } from "./BreakableTitle";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import { ACTION_BUTTON_COLORS } from "@/lib/actionButtonColors";
import { HORIZONTAL_FADE_MASK } from "./IntervalCard";

export type TrialResult = "correct" | "incorrect" | "no-response" | null;

// Sits at the top of every prompt-level popup as a "yes, an error, but no
// particular level" choice — picking it marks the trial incorrect without
// ever populating `promptLevel`, so the Error button shows no sub-text.
const UNSPECIFIED_LEVEL = "-unspecified-";

// Only covers the prompt-hierarchy levels this app actually ships with
// (see `promptLevels` on the "Follows one-step direction" card) — an
// unrecognized custom level just renders with no icon rather than needing
// this map kept exhaustively in sync.
const PROMPT_LEVEL_ICONS: Record<string, typeof VerbalPromptIcon> = {
  Verbal: VerbalPromptIcon,
  Gestural: GesturalPromptIcon,
  Modeling: ModelingPromptIcon,
  "Partial Physical": PartialPhysicalPromptIcon,
  "Full Physical": FullPhysicalPromptIcon,
};

export interface TrialCardProps extends CardEditAndDrawerProps {
  /** The toolbar's own rendered height, in px — combined with `stickyTop` as
   *  the prompt-level popover's collision padding, so it never renders
   *  underneath the sticky toolbar. Not part of CardEditAndDrawerProps since
   *  most card kinds don't need it — only kinds with their own popover
   *  positioned relative to the toolbar do. */
  toolbarHeight?: number;
  id?: string;
  title: string;
  phase?: string;
  dataType?: string;
  description?: string;
  /** Omit for "No Min" — a card can set a maximum with no minimum (or vice
   *  versa) rather than always needing both. */
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

/** Everything the bookmark bar's Trial chip needs, independent of whether
 *  the real TrialCard is currently mounted anywhere — reads/writes the same
 *  useCardState-backed `trials`/`promptLevel`/`current` slots TrialCard
 *  itself uses (kept live across both readers by the store's
 *  useSyncExternalStore subscription), with lighter versions of TrialCard's
 *  own `applyResult`/`pickPromptLevel` (no `direction`/`lastAction`
 *  animation state, no advance delay — the chip has no stepper to
 *  animate). Pads `trials` out to `current + 1` before writing, since when
 *  the real TrialCard isn't mounted nothing else keeps that array in sync
 *  with `current` growing past its length. When `promptLevels` is set, the
 *  chip's Error button reuses TrialCard's own exported
 *  `ListPromptLevelButton` (see BookmarkChip.tsx) rather than a plain
 *  toggle — `pickPromptLevel` below is that button's write path. */
export function useTrialChip(
  cardKey: string,
  maxTrials?: number,
  minTrials?: number,
  promptLevels?: string[],
) {
  const { markDirty, canRecordData } = useCardSession();
  const [trials, setTrials] = useCardState<TrialResult[]>(cardKey, "trials", () =>
    Array.from({ length: maxTrials ?? minTrials ?? 1 }, () => null),
  );
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>>(
    cardKey,
    "promptLevel",
    {},
  );
  const [current, setCurrent] = useCardState(cardKey, "current", 0);

  const completedCount = trials.filter((t) => t !== null).length;
  const isMaxReached = maxTrials !== undefined && completedCount >= maxTrials;
  const currentResult: TrialResult = trials[current] ?? null;
  const needsPromptLevelPicker = (promptLevels?.length ?? 0) > 0;
  const advanceCurrent = () => {
    const max = maxTrials ? maxTrials - 1 : Number.POSITIVE_INFINITY;
    setCurrent((c) => Math.min(c + 1, max));
  };
  const padTrials = (prev: TrialResult[]) =>
    prev.length > current ? [...prev] : [...prev, ...Array(current + 1 - prev.length).fill(null)];

  const setResult = (value: Exclude<TrialResult, null>) => {
    markDirty();
    if (isMaxReached && currentResult === null) return;
    const isToggleOff = currentResult === value;
    if (!isToggleOff) {
      playSoundEffect(
        value === "correct" ? "correct" : value === "incorrect" ? "error" : "noResponse",
      );
    }
    setTrials((prev) => {
      const next = padTrials(prev);
      next[current] = isToggleOff ? null : value;
      return next;
    });
    if (value !== "incorrect" || isToggleOff) {
      setPromptLevel((prev) => {
        if (!(current in prev)) return prev;
        const next = { ...prev };
        delete next[current];
        return next;
      });
    }
    if (!isToggleOff) advanceCurrent();
  };

  const pickPromptLevel = (level: string) => {
    markDirty();
    const isUnspecified = level === UNSPECIFIED_LEVEL;
    const isToggleOff =
      currentResult === "incorrect" &&
      (isUnspecified ? !(current in promptLevel) : promptLevel[current] === level);
    setTrials((prev) => {
      const next = padTrials(prev);
      next[current] = isToggleOff ? null : "incorrect";
      return next;
    });
    setPromptLevel((prev) => {
      const next = { ...prev };
      if (isToggleOff || isUnspecified) delete next[current];
      else next[current] = level;
      return next;
    });
    if (!isToggleOff) advanceCurrent();
  };

  return {
    current,
    currentResult,
    currentPromptLevel: promptLevel[current] ?? null,
    needsPromptLevelPicker,
    isMaxReached,
    setResult,
    pickPromptLevel,
    canRecordData,
  };
}

export function TrialCard({
  id,
  title,
  phase = "Intervention",
  dataType = "Percent Correct",
  description = "Record whether the learner performed the target behavior independently during this trial.",
  minTrials,
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
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: TrialCardProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const cardKey = id ?? title;
  // Keyed by trial index rather than a parallel array — entries just don't
  // exist for trials that aren't "incorrect" (or don't have a level yet),
  // so it never needs to stay in sync/length with the trials array.
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>>(
    cardKey,
    "promptLevel",
    {},
  );
  // Always one slot ahead of the highest-scored trial (so there's always a
  // next one ready), never fewer than minTrials, capped at maxTrials when
  // set. Anchored to the highest scored INDEX rather than the total scored
  // COUNT, since the expanded list lets trials be scored out of order.
  const [trials, setTrials] = useCardState<TrialResult[]>(cardKey, "trials", () =>
    Array.from({ length: maxTrials ?? minTrials ?? 1 }, () => null),
  );
  const highestScoredIdx = trials.reduce((max, t, i) => (t !== null ? i : max), -1);
  const displayCount = maxTrials ?? Math.max(minTrials ?? 0, highestScoredIdx + 2);
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
  const incorrectCount = trials.filter((t) => t === "incorrect").length;
  const target = maxTrials ?? minTrials ?? 0;
  const progress = target > 0 ? Math.min(100, Math.round((completedCount / target) * 100)) : 0;
  const isComplete = target > 0 && completedCount >= target;
  const isMaxReached = maxTrials !== undefined && completedCount >= maxTrials;
  // With no fixed minimum, "remaining" counts down toward the max instead
  // (there's nothing to graph a fixed quota against) — and toward neither
  // when the card has set no minimum or maximum at all.
  const remaining =
    minTrials !== undefined
      ? Math.max(0, minTrials - completedCount)
      : maxTrials !== undefined
        ? Math.max(0, maxTrials - completedCount)
        : 0;
  // Percent correct only counts trials actually scored Correct/Error —
  // No Response trials are excluded from both the numerator and
  // denominator (they're an absence of a scoreable attempt, not a wrong
  // one), and the figure only appears once "enough" trials are in: the
  // card's own minimum when it has one, else at least a single scored
  // trial (so a lone lucky/unlucky trial can't read as a definitive 0%
  // or 100%).
  const scoredForPercent = correctCount + incorrectCount;
  const percentCorrectReady = completedCount >= (minTrials ?? 1) && scoredForPercent > 0;
  const percentCorrectDisplay = percentCorrectReady
    ? `${Math.round((correctCount / scoredForPercent) * 100)}%`
    : "Min not met";

  const { markDirty, resetSignal, canRecordData } = useCardSession();
  useReportCardStatus(cardKey, completedCount > 0, isComplete, {
    title,
    kind: "trial",
    value: percentCorrectReady ? percentCorrectDisplay : `${completedCount}/${target || "–"}`,
    unit: percentCorrectReady ? "% Correct" : "Trials",
  });
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setTrials(Array.from({ length: maxTrials ?? minTrials ?? 1 }, () => null));
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
    if (!isToggleOff) {
      playSoundEffect(
        value === "correct" ? "correct" : value === "incorrect" ? "error" : "noResponse",
      );
    }
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
      trials[idx] === "incorrect" &&
      (isUnspecified ? !(idx in promptLevel) : promptLevel[idx] === level);
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

  // Shared by both the twirl-down chevron and the title next to it — either
  // one toggling the same expanded state, the same way.
  // Shared by the twirl-down's own collapse-time jump and a tap on the card
  // body while it's already active — both want the same "back to now"
  // destination: whichever trial still needs scoring, or the last trial if
  // every one so far is already done.
  const jumpToCurrent = () => {
    const firstUnscored = trials.findIndex((t) => t === null);
    goTo(firstUnscored !== -1 ? firstUnscored : maxTrials ? maxTrials - 1 : completedCount);
  };

  const toggleTrialExpanded = () => {
    if (!expanded) {
      playSoundEffect("twirldown");
    } else {
      // Collapsing back to standard view — jump to whichever trial still
      // needs scoring (the expanded list may have just been used to fill in
      // ones out of order) rather than leaving the stepper wherever it
      // happened to be pointed before expanding.
      jumpToCurrent();
    }
    setExpanded((v) => !v);
  };

  // Every bubble's own outer slot is a fixed BUBBLE_CENTER square (not
  // BUBBLE, the small resting size) — see the per-bubble render below for
  // why: the slot itself never resizes, so the growing/shrinking bubble
  // inside it never pushes a neighboring slot and the row's own width never
  // changes as `current` moves.
  const stepWidth = BUBBLE_CENTER + GAP;
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
    return (
      <MiniTileShell
        title={title}
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
        progress={progress}
        isComplete={isComplete}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={
          <>
            <DrawerQuickFacts
              icon={<PercentCorrectIcon />}
              kind="trial"
              dataTypeLabel={dataType}
              phase={phase}
              stats={[
                { label: "Minimum", value: minTrials ?? "No Min" },
                { label: "Maximum", value: maxTrials ?? "No Max" },
                { label: "Correct", value: percentCorrectDisplay },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="trial"
                />
              </div>
            )}
          </>
        }
        actions={
          <div
            className={cn(
              "flex items-center justify-center",
              noResponse ? "gap-1.5" : "gap-2",
              large && (noResponse ? "gap-2.5" : "gap-3.5"),
            )}
          >
            {promptLevels && promptLevels.length > 0 ? (
              <ListPromptLevelButton
                levels={promptLevels}
                selectedLevel={promptLevel[current] ?? null}
                selected={trials[current] === "incorrect"}
                disabled={!canRecordData || (isMaxReached && trials[current] === null)}
                onPick={(level) => pickPromptLevel(current, level, true)}
                topInset={stickyTop + toolbarHeight}
                sizeClassName={large ? "size-10" : "size-7"}
                iconSizeClassName={large ? "size-[19px]" : "size-3.5"}
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setResult("incorrect");
                }}
                disabled={!canRecordData || (isMaxReached && trials[current] === null)}
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
            )}
            {noResponse && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setResult("no-response");
                }}
                disabled={!canRecordData || (isMaxReached && trials[current] === null)}
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
              disabled={!canRecordData || (isMaxReached && trials[current] === null)}
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
        <div className="relative w-full">
          {/* Large density only — same "pushed to the tile's own edges"
           *  nav-arrow convention as Checklist's tile; small density relies
           *  on swiping/tapping a bubble alone. */}
          {large && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(current - 1);
                }}
                disabled={current === 0}
                aria-label="Previous trial"
                className="absolute -left-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
              >
                <ChevronLeft className="size-[18px]" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(current + 1);
                }}
                disabled={
                  (trials[current] === null && current >= completedCount) ||
                  (maxTrials ? current >= maxTrials - 1 : false)
                }
                aria-label="Next trial"
                className="absolute -right-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
              >
                <ChevronRight className="size-[18px]" strokeWidth={2.5} />
              </button>
            </>
          )}
          {/* Large density only — fades trailing trial numbers out before
              they reach the tile's own edge, so they read as sliding away
              rather than sitting directly under the nav arrows just outside
              it (same HORIZONTAL_FADE_MASK convention IntervalCard's own
              timelines use). */}
          <div style={large ? HORIZONTAL_FADE_MASK : undefined}>
            <SwipeStrip
              count={trials.length}
              current={current}
              onCurrentChange={goTo}
              variant="centered"
              className="w-full"
              gapClassName={large ? "gap-2" : "gap-1.5"}
              // A fixed height (comfortably taller than the largest centered
              // fontSize below, not just the smallest resting one) — the
              // centered trial's own number scales up to 3x+ the size of its
              // neighbors, and without a fixed box here that growth changes
              // this ROW's own natural height as `isCenter` moves from one
              // item to the next, shifting every trial number vertically
              // (and, inside a tile's own fixed-height column, clipping the
              // top of whichever one just grew) rather than the swipe
              // staying a pure horizontal motion.
              itemWrapperClassName={cn("flex items-center justify-center", large ? "h-12" : "h-9")}
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
                    // relative + full-height/width: same "trial-min-dot"
                    // required-and-not-yet-scored marker the standard view's
                    // own bubble strip already shows below each number (see
                    // its own comment) — this tile-mode strip just never
                    // carried it over. Anchored to this item's own fixed-size
                    // slot (itemWrapperClassName's h-12/h-9), not the number
                    // glyph itself, so the dot sits level across every item
                    // regardless of which one is centered and momentarily
                    // rendering 3x larger.
                    className="relative h-full flex items-center justify-center"
                  >
                    <span
                      className={cn(
                        "font-display font-bold tabular-nums transition-[font-size] leading-none",
                        color,
                      )}
                      style={{ fontSize: isCenter ? (large ? 38 : 28) : large ? 13 : 10 }}
                    >
                      {i + 1}
                    </span>
                    {minTrials !== undefined && i < minTrials && !t && (
                      // bottom-0, not a negative inset — this item's own box
                      // is inside SwipeStrip's native `overflow-x-auto`
                      // scroller, which (per spec — setting only overflow-x
                      // forces overflow-y to compute as `auto` too, not
                      // `visible`) silently clips anything overflowing this
                      // box's own bottom edge instead of letting it show past
                      // it the way the standard view's bigger, dedicated
                      // bubble square allows.
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-foreground/35"
                        aria-hidden
                      />
                    )}
                  </div>
                );
              }}
            </SwipeStrip>
          </div>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    const isDisabled = !canRecordData || (isMaxReached && trials[current] === null);
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<PercentCorrectIcon />}
        kind="trial"
        dataTypeLabel={dataType}
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        stickyTop={stickyTop}
        progress={progress}
        isComplete={isComplete}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={
          <>
            <DrawerQuickFacts
              icon={<PercentCorrectIcon />}
              kind="trial"
              dataTypeLabel={dataType}
              phase={phase}
              stats={[
                { label: "Minimum", value: minTrials ?? "No Min" },
                { label: "Maximum", value: maxTrials ?? "No Max" },
                { label: "Correct", value: percentCorrectDisplay },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="trial"
                />
              </div>
            )}
          </>
        }
        actions={
          // The badge AND the buttons travel together here — unlike
          // Frequency/Rate's tally-and-increment (one action, repeated), each
          // button here scores THIS trial specifically, so advancing to the
          // next trial should read as the whole row moving on to a new one,
          // not just the number changing while the same buttons sit still.
          <ListActionSlide actionKey={current} direction={direction}>
            <ListActionBadge value={current + 1} />
            {promptLevels && promptLevels.length > 0 ? (
              <ListPromptLevelButton
                levels={promptLevels}
                selectedLevel={promptLevel[current] ?? null}
                selected={trials[current] === "incorrect"}
                disabled={isDisabled}
                onPick={(level) => pickPromptLevel(current, level, true)}
                topInset={stickyTop + toolbarHeight}
              />
            ) : (
              <ListActionButton
                icon={X}
                variant="red"
                selected={trials[current] === "incorrect"}
                disabled={isDisabled}
                ariaLabel="Error"
                onClick={() => setResult("incorrect")}
              />
            )}
            {noResponse && (
              <ListActionButton
                icon={CircleSlash2}
                variant="amber"
                selected={trials[current] === "no-response"}
                disabled={isDisabled}
                ariaLabel="No Response"
                onClick={() => setResult("no-response")}
              />
            )}
            <ListActionButton
              icon={Check}
              variant="green"
              selected={trials[current] === "correct"}
              disabled={isDisabled}
              ariaLabel="Correct"
              onClick={() => setResult("correct")}
            />
          </ListActionSlide>
        }
      />
    );
  }

  return (
    <article
      ref={articleRef}
      // Tapping the card body while it's already active jumps back to
      // whichever trial is current, instead of onActivate's setActiveId
      // being a same-value no-op — see jumpToCurrent's own comment.
      onClick={isActive ? jumpToCurrent : onActivate}
      className={cn(
        // Border always 1px (ring adds the selected weight without
        // consuming layout space) — see CardShell's own version of this
        // comment for the full rationale; overflow-hidden moved to the
        // inner clip wrapper below for the same shadow-clipping reason.
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        isActive
          ? "border border-blue-400/80 ring-2 ring-inset ring-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border border-border opacity-80 hover:opacity-95",
      )}
    >
      <div className="relative rounded-xl overflow-hidden">
        {/* Header */}
        <header
          className={cn("flex items-start gap-1 pl-5 pt-2 pb-0", reorderEditing ? "pr-3" : "pr-9")}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleTrialExpanded();
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Show standard view" : "Show all trials"}
            data-tour="twirldown"
            className="-ml-1.5 mt-[0.5px] shrink-0 grid place-items-center rounded-md p-0.5 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <TimeChevronIcon
              className={cn(
                "size-4 transition-transform duration-200",
                expanded && "translate-y-0.5 rotate-90",
              )}
            />
          </button>
          <h2
            className="font-display text-lg leading-[1.05] flex-1 min-w-0 break-words mr-auto mt-0.5 cursor-pointer"
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              toggleTrialExpanded();
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              toggleTrialExpanded();
            }}
          >
            {renderBreakableTitle(title)}
          </h2>
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
              <PhaseInfoLabel
                phase={phase}
                className="flex items-center justify-end gap-1 text-xs font-medium italic text-muted-foreground hover:text-blue-600 transition-colors"
              />
              <DataTypeInfoLabel
                kind="trial"
                label={dataType}
                icon={<PercentCorrectIcon />}
                className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground hover:text-blue-600 transition-colors"
              />
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
            onPrevCard={onPrevCard}
            onNextCard={onNextCard}
            slideFrom={slideFrom}
            details={
              <>
                <DrawerQuickFacts
                  icon={<PercentCorrectIcon />}
                  kind="trial"
                  dataTypeLabel={dataType}
                  phase={phase}
                  stats={[
                    { label: "Minimum", value: minTrials ?? "No Min" },
                    { label: "Maximum", value: maxTrials ?? "No Max" },
                    { label: "Correct", value: percentCorrectDisplay },
                  ]}
                />
                {(teachingProcedure || description) && (
                  <div className="mt-4">
                    <TeachingProcedureAccordion
                      description={description}
                      data={teachingProcedure}
                      kind="trial"
                    />
                  </div>
                )}
              </>
            }
            top={stickyTop}
            cardRef={articleRef}
            widthMode={widthMode}
            onWidthModeChange={onWidthModeChange}
          />
        )}

        {/* Universal header/body divider — present in both the standard and
          expanded views, not just faded in while expanded. */}
        <div className="mx-[18px] mt-2.5 border-t border-dashed border-border" />

        <ExpandableArea
          expanded={expanded}
          expandedView={
            /* Expanded view — every trial as its own row, each with the same
              Correct/Error buttons as the standard view, so a run of trials can
              be corrected or filled in without stepping through one at a time. */
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
                        disabled={!canRecordData}
                        onPick={(level) => pickPromptLevel(i, level, false)}
                        topInset={stickyTop + toolbarHeight}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyResult(i, "incorrect", false)}
                        disabled={!canRecordData}
                        className={cn(
                          "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                          "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
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
                        disabled={!canRecordData}
                        className={cn(
                          "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                          "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
                          t === "no-response" &&
                            "btn-bevel bg-amber-500 border-amber-600 text-white",
                        )}
                      >
                        <CircleSlash2 className="size-2.5" strokeWidth={2.5} />
                        No Response
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => applyResult(i, "correct", false)}
                      disabled={!canRecordData}
                      className={cn(
                        "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
                        "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
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
          }
        >
          {/* Bubble row */}
          <div className="relative px-2 mt-1">
            <div className="relative h-16">
              {/* Triangle nav buttons — centered with bubbles */}
              <TriangleNav
                direction="left"
                onClick={() => goTo(current - 1)}
                onDoubleClick={() => goTo(0)}
                disabled={current === 0}
              />
              <TriangleNav
                direction="right"
                onClick={() => goTo(current + 1)}
                onDoubleClick={() => goTo(maxTrials ? maxTrials - 1 : completedCount)}
                disabled={
                  (trials[current] === null && current >= completedCount) ||
                  (maxTrials ? current >= maxTrials - 1 : false)
                }
              />

              <div
                ref={containerRef}
                className="relative h-16 overflow-visible"
                style={{
                  // Fixed PIXEL stops, not percentages — the triangle nav
                  // arrows just outside this container are a constant size
                  // regardless of how wide the card itself renders (a
                  // percentage-based fade scaled with container width instead,
                  // so on a narrower card the opaque zone started well short
                  // of the arrows' own reach and a small bubble could still
                  // be sitting there at partial opacity, peeking out around
                  // the arrow glyph rather than being fully faded away by the
                  // time it got there). TriangleNav sits size-12 (48px)
                  // starting 8px outside this container's own edge, so its
                  // own footprint reaches 40px in; 48px of fade comfortably
                  // clears that with a small margin to spare.
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)",
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
                        ? "bg-green-50 border-green-400/80"
                        : lastAction.value === "incorrect" && i === current - 1
                          ? "bg-red-50 border-red-400/80"
                          : lastAction.value === "no-response" && i === current - 1
                            ? "bg-amber-50 border-amber-400/80"
                            : "";
                    return (
                      // Fixed-size slot (always BUBBLE_CENTER, the largest a
                      // bubble ever renders) — the actual bubble inside it
                      // grows/shrinks with a bouncy spring, but that motion
                      // stays entirely inside this unchanging box, so it
                      // never pushes a neighboring slot around and the track
                      // itself never visibly reflows/bounces as `current`
                      // moves. Only the current bubble's own growth should
                      // read as animated; everything else — the rest of the
                      // row, the nav arrows outside it — should hold still.
                      <div
                        key={i}
                        className="relative shrink-0 grid place-items-center"
                        style={{ width: BUBBLE_CENTER, height: BUBBLE_CENTER }}
                      >
                        <motion.button
                          onClick={() => goTo(i)}
                          className="relative grid place-items-center rounded-full font-medium select-none"
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
                                  className={cn(
                                    "font-display text-4xl leading-none tabular-nums",
                                    centerTextColor,
                                  )}
                                >
                                  {i + 1}
                                </motion.span>
                              </AnimatePresence>
                            ) : (
                              <span
                                className={cn("text-[7px] font-medium leading-none", textColor)}
                              >
                                {i + 1}
                              </span>
                            )}
                          </div>
                          {minTrials !== undefined && i < minTrials && !t && (
                            <span
                              data-tour="trial-min-dot"
                              className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-1 rounded-full bg-foreground/35"
                              aria-hidden
                            />
                          )}
                        </motion.button>
                      </div>
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
              Trial {current + 1} (of {target} {maxTrials ? "max" : "required"})
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
                className={cn(
                  "absolute inset-0 px-5 flex items-center",
                  noResponse ? "gap-1.5" : "gap-3",
                )}
              >
                {promptLevels && promptLevels.length > 0 ? (
                  <PromptLevelButton
                    levels={promptLevels}
                    selectedLevel={promptLevel[current] ?? null}
                    selected={trials[current] === "incorrect"}
                    disabled={!canRecordData || (isMaxReached && trials[current] === null)}
                    onPick={(level) => pickPromptLevel(current, level, true)}
                    topInset={stickyTop + toolbarHeight}
                  />
                ) : (
                  <ActionButton
                    variant="incorrect"
                    selected={trials[current] === "incorrect"}
                    onClick={() => setResult("incorrect")}
                    disabled={!canRecordData || (isMaxReached && trials[current] === null)}
                    dense={noResponse}
                  />
                )}
                {noResponse && (
                  <ActionButton
                    variant="no-response"
                    selected={trials[current] === "no-response"}
                    onClick={() => setResult("no-response")}
                    disabled={!canRecordData || (isMaxReached && trials[current] === null)}
                    dense
                  />
                )}
                <ActionButton
                  variant="correct"
                  selected={trials[current] === "correct"}
                  onClick={() => setResult("correct")}
                  disabled={!canRecordData || (isMaxReached && trials[current] === null)}
                  dense={noResponse}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </ExpandableArea>

        {/* Progress bar — inset from the card's own edges (not flush corner-
          to-corner) so it reads as sitting inside the card's border rather
          than touching/merging into it — most visible once a selected
          card's blue ring makes that border more prominent. Same treatment
          as CardShell's own version of this bar. */}
        {target > 0 && (
          <div className="relative mt-3 mx-4 mb-3">
            {/* Bar background + fill */}
            <div className="relative h-5 rounded-md overflow-hidden">
              <div className="absolute inset-0 bg-muted">
                <motion.div
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isComplete
                      ? "bg-green-500/25"
                      : progress >= 50
                        ? "bg-yellow-400/30"
                        : "bg-red-400/25",
                  )}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 180, damping: 26 }}
                />
              </div>

              {/* Helper text inside the bar */}
              <div className="absolute inset-0 flex items-center justify-center px-3 text-[11px] text-foreground/75 leading-none pointer-events-none">
                {isComplete ? (
                  isMaxReached ? (
                    "Maximum trials reached! Congrats!"
                  ) : (
                    "Minimum trials reached. This data can now be graphed."
                  )
                ) : minTrials !== undefined ? (
                  <span>
                    Conduct at least <strong className="font-semibold">{remaining} more</strong>{" "}
                    {remaining === 1 ? "trial" : "trials"} to graph this target.
                  </span>
                ) : (
                  <span>
                    <strong className="font-semibold">{remaining} more</strong>{" "}
                    {remaining === 1 ? "trial" : "trials"} until the maximum.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function TriangleNav({
  direction,
  onClick,
  onDoubleClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  /** Jumps straight to the first/last trial — the same shortcut every other
   *  scrollable card's own nav arrows now offer. */
  onDoubleClick?: () => void;
  disabled?: boolean;
}) {
  const isLeft = direction === "left";
  return (
    <motion.button
      aria-label={isLeft ? "Previous trial" : "Next trial"}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
    classes: ACTION_BUTTON_COLORS.green.classes,
    // The extra hover here (unlike the same green used elsewhere) is this
    // card's own choice for its bigger, more prominent scoring buttons.
    selectedClasses: cn(ACTION_BUTTON_COLORS.green.selectedClasses, "hover:bg-green-600"),
  },
  incorrect: {
    icon: X,
    label: "Error",
    classes: ACTION_BUTTON_COLORS.red.classes,
    selectedClasses: cn(ACTION_BUTTON_COLORS.red.selectedClasses, "hover:bg-red-600"),
  },
  // Neutral (not positive or negative), same amber used for Task Analysis's
  // Prompted option, so "the target behavior didn't happen at all" reads
  // distinctly from both Correct and Error.
  "no-response": {
    icon: CircleSlash2,
    label: "No Response",
    classes: ACTION_BUTTON_COLORS.amber.classes,
    selectedClasses: cn(ACTION_BUTTON_COLORS.amber.selectedClasses, "hover:bg-amber-600"),
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
  topInset = 0,
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  disabled?: boolean;
  onPick: (level: string) => void;
  /** Sticky header + toolbar height above this card — passed through so
   *  Radix's own collision detection treats that (visually opaque) band as
   *  unavailable space too, not just the true viewport edge, and flips the
   *  popover to the other side instead of rendering underneath it. */
  topInset?: number;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <motion.button
          ref={anchorRef}
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
            selected && "bg-red-500 border-red-600 text-white hover:bg-red-600",
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
            <span
              className={cn(
                "text-[10px] leading-none -mt-0.5",
                selected ? "text-white/80" : "text-red-600/70",
              )}
            >
              {selectedLevel}
            </span>
          )}
        </motion.button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="center"
        collisionPadding={{ top: topInset + 8, bottom: 8, left: 8, right: 8 }}
        // z-[70]: matches NumberKeypad/DataToolbar's own popovers — the
        // sticky toolbar (z-[60]) and details drawer (z-[62]) would
        // otherwise paint over this once the trigger scrolls near them.
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-red-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
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
          {levels.map((level) => {
            const LevelIcon = PROMPT_LEVEL_ICONS[level];
            return (
              <button
                key={level}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(level);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
                  selectedLevel === level
                    ? "bg-red-500 text-white"
                    : "text-red-700 hover:bg-red-50",
                )}
              >
                {LevelIcon && <LevelIcon className="size-3.5 shrink-0" />}
                {level}
              </button>
            );
          })}
        </div>
        {/* Arrow — points back at the button that opened this popup, same
            idiom as NumberKeypad's own popover arrow. Its left offset
            tracks the trigger's real position (see useSlidingArrowOffset)
            rather than staying hard-centered, since Radix's own collision
            avoidance can shift the popup sideways to stay on screen when
            the trigger sits near a viewport edge — a fixed center would
            then no longer line up with the button it's pointing at. */}
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-red-300 bg-card",
            "-bottom-[6px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[6px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Compact pill version of PromptLevelButton for the expanded list's
 *  per-trial row — same h-7 pill-with-label shape as that row's own
 *  Correct/No Response buttons (see the plain buttons right next to this
 *  one in the JSX below) rather than List mode's icon-only circle, since a
 *  row here has the same horizontal room those siblings already use for
 *  their own text. Shows the selected level in place of "Error" once one's
 *  picked, same as the standard view's own sub-label, just inline instead
 *  of on a second line since a pill this short has no room underneath. */
function RowPromptLevelButton({
  levels,
  selectedLevel,
  selected,
  disabled,
  onPick,
  topInset = 0,
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  disabled?: boolean;
  onPick: (level: string) => void;
  topInset?: number;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          aria-haspopup
          className={cn(
            "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40",
            "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
            selected && "btn-bevel bg-red-500 border-red-600 text-white",
          )}
        >
          <X className="size-3 shrink-0" strokeWidth={3} />
          {selectedLevel ?? "Error"}
          <TimeChevronIcon
            className={cn(
              "size-2.5 shrink-0 transition-transform duration-200",
              open && "-rotate-90",
            )}
          />
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="center"
        collisionPadding={{ top: topInset + 8, bottom: 8, left: 8, right: 8 }}
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-red-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
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
          {levels.map((level) => {
            const LevelIcon = PROMPT_LEVEL_ICONS[level];
            return (
              <button
                key={level}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(level);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
                  selectedLevel === level
                    ? "bg-red-500 text-white"
                    : "text-red-700 hover:bg-red-50",
                )}
              >
                {LevelIcon && <LevelIcon className="size-3.5 shrink-0" />}
                {level}
              </button>
            );
          })}
        </div>
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-red-300 bg-card",
            "-bottom-[6px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[6px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Icon-only circular version of PromptLevelButton — the shared "compact"
 *  convention (matching ListActionButton's own hasMenu affordance) used
 *  anywhere space is too tight for the standard view's pill-with-label:
 *  List mode's floating action row and both grid tile densities. Sized via
 *  sizeClassName/iconSizeClassName (defaulting to List mode's own
 *  size-7/size-3.5) rather than a fixed size, so one component covers both
 *  of those contexts instead of near-identical copies drifting out of sync
 *  with each other — which is exactly what happened before: grid mode had
 *  no picker here whatsoever, just an immediate unspecified-level tap. The
 *  expanded list's own row uses RowPromptLevelButton instead (see above) —
 *  that row has the horizontal room for a full pill-with-label to match its
 *  Correct/No Response siblings, so it doesn't need the icon-only treatment
 *  this one exists for. Also reused as-is by the bookmark bar's own Trial
 *  chip (see BookmarkChip.tsx), which is why the collision boundary below
 *  is pinned to the document rather than left at Radix's default. */
export function ListPromptLevelButton({
  levels,
  selectedLevel,
  selected,
  disabled,
  onPick,
  topInset = 0,
  sizeClassName = "size-7",
  iconSizeClassName = "size-3.5",
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  disabled?: boolean;
  onPick: (level: string) => void;
  /** See PromptLevelButton's own comment on this prop. */
  topInset?: number;
  sizeClassName?: string;
  iconSizeClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          aria-label="Error"
          aria-haspopup
          className={cn(
            "btn-bevel relative shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
            sizeClassName,
            "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
            selected && "btn-bevel bg-red-500 border-red-600 text-white",
          )}
        >
          <X className={cn(iconSizeClassName, "-translate-y-0.5")} strokeWidth={3} />
          <span
            className="absolute bottom-1 left-1/2 -translate-x-1/2 size-0 border-l-[3px] border-r-[3px] border-t-[3.5px] border-l-transparent border-r-transparent border-t-current opacity-70"
            aria-hidden
          />
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="center"
        collisionPadding={{ top: topInset + 8, bottom: 8, left: 8, right: 8 }}
        // Explicit boundary (not Radix's default clippingAncestors walk) so
        // this still collides against the real viewport rather than a
        // short scrollable ancestor — a no-op in DataListRow's own usage,
        // but load-bearing for the bookmark bar's chip, which anchors this
        // inside its own overflow-x-auto scroll strip (see BookmarkChip.tsx).
        collisionBoundary={typeof document !== "undefined" ? document.body : undefined}
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-red-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
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
          {levels.map((level) => {
            const LevelIcon = PROMPT_LEVEL_ICONS[level];
            return (
              <button
                key={level}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(level);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
                  selectedLevel === level
                    ? "bg-red-500 text-white"
                    : "text-red-700 hover:bg-red-50",
                )}
              >
                {LevelIcon && <LevelIcon className="size-3.5 shrink-0" />}
                {level}
              </button>
            );
          })}
        </div>
        {/* Arrow — points back at the button that opened this popup, same
            idiom as NumberKeypad's own popover arrow; left offset tracks
            the trigger's real position (see PromptLevelButton's own
            comment on this same idiom). */}
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-red-300 bg-card",
            "-bottom-[6px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[6px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}
