import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "motion/react";
import { Check, HandHelping, X } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { ListActionBadge, ListActionButton, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TaskAnalysisIcon } from "./icons/TaskAnalysisIcon";
import { ForwardChainingIcon } from "./icons/ForwardChainingIcon";
import { BackwardChainingIcon } from "./icons/BackwardChainingIcon";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { UNSPECIFIED_LEVEL, PROMPT_LEVEL_ICONS } from "@/lib/promptLevels";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export type StepStatus = "independent" | "prompted" | "error" | null;

/** A step's expected mastery level per the chaining plan — either a named
 *  prompt-hierarchy level (see PROMPT_LEVEL_ICONS) or "Independent" — shown
 *  as a small badge beside the step, separate from (and not affected by)
 *  whatever gets scored for it during an actual session. */
export type StepPlanLevel = string;

export interface TaskAnalysisCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  steps: string[];
  /** "forward" (default) teaches the first step first and moves forward
   *  through the sequence; "backward" teaches the last step first and moves
   *  backward toward the beginning. Shown as a small icon beside the step
   *  counter and as a row in the details drawer. */
  chainingDirection?: "forward" | "backward";
  /** Per-step expected mastery level from the chaining plan (same length as
   *  `steps`) — a PROMPT_LEVEL_ICONS key, "Independent", or omitted/null for
   *  a step with no set expectation. Purely informational; independent of
   *  whatever gets scored for the step during a session. */
  stepPlan?: (StepPlanLevel | null | undefined)[];
  /** When set, Prompted becomes a picker for these prompt levels instead of
   *  a plain toggle — the chosen level is stored per-step and shown as a
   *  sub-label under "Prompted", mirroring TrialCard's Error picker. */
  promptLevels?: string[];
  isActive?: boolean;
  onActivate?: () => void;
}

// Error (negative) on the left, Independent (positive) on the right — same
// left-to-right reading as Percent Correct's Error/Correct pair, with
// Prompted as the neutral middle option unique to task analysis.
const OPTIONS: {
  value: Exclude<StepStatus, null>;
  label: string;
  icon: typeof Check;
  strokeWidth: number;
  classes: string;
  selectedClasses: string;
}[] = [
  {
    value: "error",
    label: "Error",
    icon: X,
    strokeWidth: 3,
    classes: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClasses: "bg-red-400 border-red-500 text-white",
  },
  {
    value: "prompted",
    label: "Prompted",
    icon: HandHelping,
    // HandHelping has much more path detail than Check/X, so the same
    // strokeWidth reads noticeably heavier — thinned to match their weight.
    strokeWidth: 1.75,
    classes: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClasses: "bg-amber-400 border-amber-500 text-white",
  },
  {
    value: "independent",
    label: "Independent",
    icon: Check,
    strokeWidth: 3,
    classes: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClasses: "bg-green-400 border-green-500 text-white",
  },
];

const BUBBLE = 18;
const BUBBLE_CENTER = 54;
const GAP = 6;

/** Small badge for a step's chaining-plan expectation — the bare symbol only
 *  (no background circle or color-coding, unlike the actual I/P/E scoring
 *  buttons below it, so it doesn't compete with those for attention): a
 *  single generic hand for "some level of prompting is expected" (not the
 *  specific per-level icon used elsewhere — that distinction belongs to
 *  what gets scored, not to this plan preview) or a check for "expected
 *  independent." Entirely separate from whatever actually gets scored for
 *  the step during a session. Returns null for a step with no set
 *  expectation. */
function StepPlanBadge({ level }: { level: StepPlanLevel | null | undefined }) {
  if (!level) return null;
  const isIndependent = level === "Independent";
  const Icon = isIndependent ? Check : HandHelping;
  return (
    <span title={`Expected: ${level}`} className="shrink-0 grid place-items-center text-stone-500">
      <Icon className="size-3.5" strokeWidth={isIndependent ? 2.5 : 1.75} />
    </span>
  );
}

// Solid dot color for a step's status — used by the tile's prev/next status
// indicator (unlike OPTIONS' classes above, which style a full button).
function statusDotColor(status: StepStatus) {
  return status === "independent"
    ? "bg-green-500"
    : status === "prompted"
      ? "bg-amber-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-stone-300";
}

export function TaskAnalysisCard({
  id,
  title,
  phase = "Intervention",
  description,
  steps,
  chainingDirection = "forward",
  stepPlan,
  promptLevels,
  isActive = true,
  onActivate,
  reorderEditing,
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
  detailsOpen,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop,
  toolbarHeight,
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
}: TaskAnalysisCardProps) {
  const cardKey = id ?? title;
  const [statuses, setStatuses] = useCardState<StepStatus[]>(cardKey, "statuses", () =>
    steps.map(() => null),
  );
  const [current, setCurrent] = useCardState(cardKey, "current", 0);
  // Keyed by step index, same idiom as TrialCard's promptLevel — entries
  // just don't exist for steps that aren't "prompted" (or don't have a
  // level chosen yet).
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>>(
    cardKey,
    "promptLevel",
    {},
  );
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal, sessionRunning } = useCardSession();
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  // Real, measured width of the grid tile's own content area — the step
  // text strip below needs a genuine pixel width (not a percentage: its
  // scroll-snap container is padded 50% on each side so any step can
  // center, and with box-sizing: border-box that padding alone already
  // consumes the container's whole reported width, so a percentage here
  // resolves against zero). A hardcoded guess previously clipped the
  // leading step number on any tile even a few px narrower than assumed —
  // measuring the actual rendered space instead makes this correct at
  // every density and viewport rather than one specific guessed size.
  const tileContentRef = useRef<HTMLDivElement>(null);
  const [tileContentWidth, setTileContentWidth] = useState(0);
  useEffect(() => {
    const el = tileContentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setTileContentWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setStatuses(steps.map(() => null));
    setCurrent(0);
    setPromptLevel({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset, steps]);

  // Mirrors TrialCard's setResult: read the pre-toggle value from the
  // current render's closure (not inside the setState updater) so we know
  // whether this was a genuine score vs. a toggle-off before deciding
  // whether to auto-advance.
  const setStep = (idx: number, value: Exclude<StepStatus, null>, advance = false) => {
    markDirty();
    const isToggleOff = statuses[idx] === value;
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = isToggleOff ? null : value;
      return next;
    });
    // Any outcome other than "prompted" (including toggling it off) clears
    // a leftover prompt level — otherwise switching Prompted -> Independent
    // left the old level's sub-text orphaned under a button that no longer
    // reflects a prompt at all.
    if (value !== "prompted" || isToggleOff) {
      setPromptLevel((prev) => {
        if (!(idx in prev)) return prev;
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
    setCurrent(idx);
    if (advance && !isToggleOff) {
      window.setTimeout(() => {
        setCurrent((c) => Math.min(c + 1, steps.length - 1));
      }, 260);
    }
  };

  // Prompted, when promptLevels is set, opens a picker instead of a plain
  // toggle — picking a level marks the step prompted AND records which
  // level, so the two always stay in sync. Mirrors TrialCard's own
  // pickPromptLevel for its Error button.
  const pickPromptLevel = (idx: number, level: string, advance: boolean) => {
    markDirty();
    const isUnspecified = level === UNSPECIFIED_LEVEL;
    const isToggleOff =
      statuses[idx] === "prompted" &&
      (isUnspecified ? !(idx in promptLevel) : promptLevel[idx] === level);
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = isToggleOff ? null : "prompted";
      return next;
    });
    setPromptLevel((prev) => {
      const next = { ...prev };
      if (isToggleOff || isUnspecified) delete next[idx];
      else next[idx] = level;
      return next;
    });
    setCurrent(idx);
    if (advance && !isToggleOff) {
      window.setTimeout(() => {
        setCurrent((c) => Math.min(c + 1, steps.length - 1));
      }, 260);
    }
  };

  const goTo = (idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, steps.length - 1)));
  };

  const completed = statuses.filter((s) => s !== null).length;
  const independent = statuses.filter((s) => s === "independent").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const isComplete = completed >= steps.length;
  const remaining = Math.max(0, steps.length - completed);
  useReportCardStatus(cardKey, completed > 0, isComplete);

  // Steps must be scored in order — a step can't be scored while an earlier
  // one is still blank, so its own score buttons stay disabled until the
  // gap behind it closes. -1 (all scored) allows everything.
  const firstUnscored = statuses.indexOf(null);
  const canScore = (idx: number) => firstUnscored === -1 || idx <= firstUnscored;

  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(
    () => -(current * stepWidth + BUBBLE_CENTER / 2),
    [current, stepWidth],
  );

  // Same drag-to-swipe pattern as TrialCard's own bubble track — real touch/
  // mouse dragging in addition to the triangle nav buttons, snapping to
  // whichever step ends up nearest center on release.
  const dragX = useMotionValue(0);
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const finalOffset = trackOffset + info.offset.x;
    const targetIdx = Math.round(-(finalOffset + BUBBLE_CENTER / 2) / stepWidth);
    goTo(targetIdx);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
  };

  if (tileDensity) {
    const large = tileDensity === "large";
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
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        toolbarHeight={toolbarHeight}
        progress={progress}
        isComplete={isComplete}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        details={
          <>
            <DrawerQuickFacts
              icon={<TaskAnalysisIcon />}
              dataTypeLabel="Task analysis (I / P / E)"
              phase={phase}
              stats={[
                {
                  label: "Chaining",
                  value: chainingDirection === "backward" ? "Backward" : "Forward",
                },
                { label: "Steps", value: steps.length },
                { label: "Scored", value: `${completed} / ${steps.length}` },
                { label: "Independent", value: `${independent} / ${steps.length}` },
              ]}
            />
            {teachingProcedure && (
              <div className="mt-4">
                <TeachingProcedureAccordion data={teachingProcedure} />
              </div>
            )}
          </>
        }
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2" : "gap-1.5")}>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = statuses[current] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep(current, opt.value, true);
                  }}
                  disabled={!sessionRunning || !canScore(current)}
                  aria-label={opt.label}
                  className={cn(
                    "shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                    large ? "size-10" : "size-7",
                    selected ? cn("btn-bevel", opt.selectedClasses) : opt.classes,
                  )}
                >
                  <Icon
                    className={large ? "size-[19px]" : "size-3.5"}
                    strokeWidth={opt.strokeWidth}
                  />
                </button>
              );
            })}
          </div>
        }
      >
        {/* Measures the tile's own real content width (see tileContentWidth
            above) — plain w-full here, no scroll-snap padding trick, so the
            percentage resolves against genuine available space. Wraps both
            strips below purely so ResizeObserver has a stable element to
            watch; it isn't otherwise part of either strip's own layout. */}
        <div ref={tileContentRef} className="w-full flex flex-col items-center gap-0.5">
          {/* Every step's own dot, not just prev/current/next — a second
            SwipeStrip bound to the same current/goTo state as the step text
            below, so dragging either one moves both in lockstep and the
            whole row visibly slides as `current` changes (the same native
            smooth-scroll the text strip already uses). Only the current dot
            is enlarged; every other dot is the same size regardless of how
            far it is from center — same fixed convention every other card's
            own dot row uses (see Duration's). */}
          <SwipeStrip
            count={steps.length}
            current={current}
            onCurrentChange={goTo}
            variant="centered"
            className="-mt-1 w-full"
            gapClassName={large ? "gap-2" : "gap-1.5"}
            itemWrapperClassName="flex items-center justify-center"
          >
            {(i) => {
              const isCurrent = i === current;
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(i);
                  }}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    isCurrent ? (large ? "size-2.5" : "size-2") : large ? "size-1.5" : "size-1",
                    statusDotColor(statuses[i]),
                  )}
                  style={{ opacity: isCurrent ? 1 : 0.5 }}
                  aria-hidden
                />
              );
            }}
          </SwipeStrip>
          <SwipeStrip
            count={steps.length}
            current={current}
            onCurrentChange={goTo}
            variant="centered"
            className="w-full"
            gapClassName={large ? "gap-3" : "gap-2"}
            itemWrapperClassName="flex items-center justify-center"
          >
            {(i, isCenter) => {
              const status = statuses[i];
              const color =
                status === "independent"
                  ? "text-green-700"
                  : status === "prompted"
                    ? "text-amber-700"
                    : status === "error"
                      ? "text-red-700"
                      : "text-foreground";
              // Neighboring steps keep their usual footprint (so the swipe
              // strip's own drag distance doesn't change) but show no text at
              // all — previously a dimmed preview of the step name spilled
              // onto the tile next to the centered one; the dots above now
              // cover "what's coming" instead, so this just stays blank.
              return (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(i);
                  }}
                  className={cn(
                    "line-clamp-2 text-left font-semibold leading-[1.15] transition-[font-size]",
                    isCenter ? color : "invisible",
                  )}
                  // A real, MEASURED `width` (see tileContentWidth) — not a
                  // percentage, and not a hardcoded guess. Not a percentage
                  // because this strip's own scroll container is padded 50%
                  // on each side so any step can center, and with
                  // box-sizing: border-box that padding alone already
                  // consumes the container's whole reported width, leaving
                  // nothing for a percentage to resolve against (the text
                  // vanishes entirely). Not a hardcoded guess (even one
                  // borrowed from another element measured elsewhere in this
                  // same tile, e.g. the progress bar) because a mismatch of
                  // even a few px still clips this box's left edge once
                  // scroll-snap centers it — its text-left content starts
                  // flush against that edge, so the step number/colon are
                  // exactly what goes missing. line-clamp-2 (rather than a
                  // single nowrap line + ellipsis) is the other half of "no
                  // clipping": even at a smaller font, the longest step names
                  // (e.g. "Scrub for 20 seconds") don't fit on one line in a
                  // tile this narrow — wrapping to a second line reads the
                  // whole thing instead of truncating it.
                  style={{
                    width: tileContentWidth || undefined,
                    fontSize: isCenter ? (large ? 13 : 10) : large ? 13 : 10,
                  }}
                >
                  {i + 1}: {steps[i]}
                </div>
              );
            }}
          </SwipeStrip>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<TaskAnalysisIcon />}
        dataTypeLabel="Task Analysis"
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
        toolbarHeight={toolbarHeight}
        progress={progress}
        isComplete={isComplete}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        actions={
          // Badge and buttons slide together — each button scores THIS step
          // specifically, so advancing to the next step should read as the
          // whole row moving on, not just the number changing in place.
          <ListActionSlide actionKey={current}>
            <ListActionBadge value={current + 1} />
            {OPTIONS.map((opt) => {
              if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
                return (
                  <ListTaskAnalysisPromptLevelButton
                    key={opt.value}
                    levels={promptLevels}
                    selectedLevel={promptLevel[current] ?? null}
                    selected={statuses[current] === "prompted"}
                    disabled={!sessionRunning || !canScore(current)}
                    onPick={(level) => pickPromptLevel(current, level, true)}
                    topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                  />
                );
              }
              return (
                <ListActionButton
                  key={opt.value}
                  icon={opt.icon}
                  variant={
                    opt.value === "error" ? "red" : opt.value === "prompted" ? "amber" : "green"
                  }
                  selected={statuses[current] === opt.value}
                  disabled={!sessionRunning || !canScore(current)}
                  ariaLabel={opt.label}
                  onClick={() => setStep(current, opt.value, true)}
                />
              );
            })}
          </ListActionSlide>
        }
      />
    );
  }

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Task Analysis"
      dataTypeIcon={<TaskAnalysisIcon />}
      description={description}
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
      onOpenDetails={onOpenDetails}
      stickyTop={stickyTop}
      toolbarHeight={toolbarHeight}
      onPrevCard={onPrevCard}
      onNextCard={onNextCard}
      slideFrom={slideFrom}
      progress={progress}
      isComplete={isComplete}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      helperText={
        isComplete ? (
          <span>
            All steps scored ·{" "}
            <strong className="font-semibold">
              {independent}/{steps.length} independent
            </strong>
          </span>
        ) : (
          <span>
            Score <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "step" : "steps"}.
          </span>
        )
      }
      details={
        <>
          <DrawerQuickFacts
            icon={<TaskAnalysisIcon />}
            dataTypeLabel="Task analysis (I / P / E)"
            phase={phase}
            stats={[
              {
                label: "Chaining",
                value: chainingDirection === "backward" ? "Backward" : "Forward",
              },
              { label: "Steps", value: steps.length },
              { label: "Scored", value: `${completed} / ${steps.length}` },
              { label: "Independent", value: `${independent} / ${steps.length}` },
            ]}
          />
          {teachingProcedure && (
            <div className="mt-4">
              <TeachingProcedureAccordion data={teachingProcedure} />
            </div>
          )}
        </>
      }
      expandedView={
        <ol className="px-3 pt-1 pb-3 space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
                {i + 1}
              </span>
              <span
                className={cn("flex-1 text-sm leading-tight", statuses[i] && "text-foreground/80")}
              >
                {step}
              </span>
              <StepPlanBadge level={stepPlan?.[i]} />
              <div className="flex items-center gap-1 shrink-0">
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = statuses[i] === opt.value;
                  if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
                    return (
                      <RowPromptLevelButton
                        key={opt.value}
                        levels={promptLevels}
                        selectedLevel={promptLevel[i] ?? null}
                        selected={selected}
                        disabled={!sessionRunning || !canScore(i)}
                        onPick={(level) => pickPromptLevel(i, level, false)}
                        topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                      />
                    );
                  }
                  return (
                    <motion.button
                      key={opt.value}
                      onClick={() => setStep(i, opt.value)}
                      disabled={!sessionRunning || !canScore(i)}
                      whileTap={{ scale: 0.9 }}
                      aria-label={opt.value}
                      className={cn(
                        "size-8 rounded-full border-2 grid place-items-center transition-colors disabled:opacity-40",
                        opt.classes,
                        selected && cn("btn-bevel", opt.selectedClasses),
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={opt.strokeWidth} />
                    </motion.button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      }
    >
      <div className="relative px-2 pt-3 pb-1">
        <div className="relative h-16">
          <TriangleNav
            direction="left"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
          />
          <TriangleNav
            direction="right"
            onClick={() => goTo(current + 1)}
            disabled={current >= steps.length - 1}
          />
          <div
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
              style={{ gap: GAP, x: dragX, translateY: "-50%" }}
              animate={{ x: trackOffset }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              drag="x"
              dragConstraints={{ left: -((steps.length - 1) * stepWidth) - 200, right: 200 }}
              dragElastic={0.08}
              onDragEnd={handleDragEnd}
            >
              {steps.map((_, i) => {
                const isCenter = i === current;
                const status = statuses[i];
                return (
                  <motion.button
                    key={i}
                    onClick={() => goTo(i)}
                    className="relative shrink-0 grid place-items-center rounded-full font-medium select-none border"
                    animate={{
                      width: isCenter ? BUBBLE_CENTER : BUBBLE,
                      height: isCenter ? BUBBLE_CENTER : BUBBLE,
                    }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  >
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full grid place-items-center",
                        isCenter ? "border-2" : "border",
                        status === "independent"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : status === "prompted"
                            ? "bg-amber-50 border-amber-300 text-amber-700"
                            : status === "error"
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-foreground/5 border-foreground/10 text-foreground/40",
                        isCenter && !status && "bg-card border-foreground/30 text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          isCenter
                            ? "font-display text-2xl leading-none tabular-nums"
                            : "text-[7px] leading-none",
                        )}
                      >
                        {i + 1}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
              {/* End bar — same "quota boundary" divider as Percent Correct's
                  own maxTrials marker. Task analysis steps are always a
                  fixed count (there's no separate max to configure), so
                  this sits after the last step unconditionally rather than
                  behind a maxTrials check. */}
              <div
                className="shrink-0 w-px bg-foreground/40 mx-2"
                style={{ height: 40 }}
                aria-hidden
              />
            </motion.div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <span
            title={chainingDirection === "backward" ? "Backward chaining" : "Forward chaining"}
            className="inline-flex shrink-0"
          >
            {chainingDirection === "backward" ? (
              <BackwardChainingIcon className="size-3.5" />
            ) : (
              <ForwardChainingIcon className="size-3.5" />
            )}
          </span>
          <span>
            Step {current + 1} (of {steps.length})
          </span>
        </div>

        {/* flex+justify-center on the row, rather than text-align:center on
         *  the paragraph itself: a centered *line* pushes overflow past
         *  both edges equally, and CardShell's own rounded-corner
         *  overflow-hidden then clips the beginning of a too-long word
         *  along with the end. Centering the *box* instead means a short
         *  line (which fits, so the box shrinks to its content) still reads
         *  as centered, but a long line's box gets capped at max-w-full —
         *  leaving nothing left to center around — so it truncates from its
         *  natural (left) start, losing only the tail. */}
        <div className="mt-2 px-3 flex justify-center items-center gap-1.5">
          <StepPlanBadge level={stepPlan?.[current]} />
          <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold leading-tight">
            {steps[current]}
          </p>
        </div>

        <div className="mt-3 flex justify-center gap-1 px-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = statuses[current] === opt.value;
            if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
              return (
                <TaskAnalysisPromptLevelButton
                  key={opt.value}
                  levels={promptLevels}
                  selectedLevel={promptLevel[current] ?? null}
                  selected={selected}
                  disabled={!sessionRunning || !canScore(current)}
                  onPick={(level) => pickPromptLevel(current, level, true)}
                  topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                />
              );
            }
            return (
              <motion.button
                key={opt.value}
                onClick={() => setStep(current, opt.value, true)}
                disabled={!sessionRunning || !canScore(current)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "flex-1 min-w-0 h-10 rounded-full border-2 flex items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                  opt.classes,
                  selected && cn("btn-bevel", opt.selectedClasses),
                )}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={opt.strokeWidth} />
                <span className="truncate">{opt.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </CardShell>
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
      aria-label={isLeft ? "Previous step" : "Next step"}
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

/** Prompted, when a card has prompt levels configured, opens a small
 *  anchored picker instead of toggling directly — same amber styling as the
 *  plain Prompted button, and the same popover-picker idiom as TrialCard's
 *  own Error picker (PromptLevelButton). */
function TaskAnalysisPromptLevelButton({
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
   *  unavailable space too, not just the true viewport edge. */
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
          whileTap={{ scale: 0.96 }}
          className={cn(
            "flex-1 min-w-0 h-10 rounded-full border-2 flex flex-col items-center justify-center transition-colors disabled:opacity-40",
            "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
            selected && "btn-bevel bg-amber-400 border-amber-500 text-white",
          )}
        >
          <span className="flex items-center gap-1">
            <HandHelping className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="text-[11px] font-medium">Prompted</span>
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
                selected ? "text-white/80" : "text-amber-600/70",
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
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-amber-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <PromptLevelList
          levels={levels}
          selectedLevel={selectedLevel}
          selected={selected}
          onPick={onPick}
          setOpen={setOpen}
        />
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-amber-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Icon-only circular version of TaskAnalysisPromptLevelButton for the List
 *  display mode's floating action row — same popover-picker behavior,
 *  styled to match ListActionButton (including its "more choices" triangle). */
function ListTaskAnalysisPromptLevelButton({
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
          aria-label="Prompted"
          aria-haspopup
          className={cn(
            "btn-bevel relative shrink-0 size-7 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
            "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
            selected && "btn-bevel bg-amber-400 border-amber-500 text-white",
          )}
        >
          <HandHelping className="size-3.5 -translate-y-0.5" strokeWidth={1.75} />
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
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-amber-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <PromptLevelList
          levels={levels}
          selectedLevel={selectedLevel}
          selected={selected}
          onPick={onPick}
          setOpen={setOpen}
        />
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-amber-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Compact version for the expanded list's per-step Prompted button — same
 *  popover-picker behavior, sized to match the row's other small pill
 *  buttons instead of the standard view's large ones. */
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
          className={cn(
            "size-8 rounded-full border-2 grid place-items-center transition-colors disabled:opacity-40",
            "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
            selected && "btn-bevel bg-amber-400 border-amber-500 text-white",
          )}
        >
          <HandHelping className="size-3.5" strokeWidth={1.75} />
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="center"
        collisionPadding={{ top: topInset + 8, bottom: 8, left: 8, right: 8 }}
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-amber-300 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <PromptLevelList
          levels={levels}
          selectedLevel={selectedLevel}
          selected={selected}
          onPick={onPick}
          setOpen={setOpen}
        />
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-amber-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Shared popover body for all three Prompted-picker variants above — the
 *  "-unspecified-" catch-all plus one row per configured prompt level. */
function PromptLevelList({
  levels,
  selectedLevel,
  selected,
  onPick,
  setOpen,
}: {
  levels: string[];
  selectedLevel: string | null;
  selected: boolean;
  onPick: (level: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
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
            ? "bg-amber-400 text-white"
            : "text-amber-700/70 hover:bg-amber-50",
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
                ? "bg-amber-400 text-white"
                : "text-amber-700 hover:bg-amber-50",
            )}
          >
            {LevelIcon && <LevelIcon className="size-3.5 shrink-0" />}
            {level}
          </button>
        );
      })}
    </div>
  );
}
