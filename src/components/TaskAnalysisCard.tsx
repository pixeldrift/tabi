import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  HandHelping,
  X,
} from "lucide-react";
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
import { playSoundEffect } from "@/lib/soundEffects";
import { ACTION_BUTTON_COLORS } from "@/lib/actionButtonColors";
import { cn } from "@/lib/utils";

export type StepStatus = "independent" | "prompted" | "error" | null;

/** A step's expected mastery level per the chaining plan — either a named
 *  prompt-hierarchy level (see PROMPT_LEVEL_ICONS) or "Independent" — shown
 *  as a small badge beside the step, separate from (and not affected by)
 *  whatever gets scored for it during an actual session. */
export type StepPlanLevel = string;

export interface TaskAnalysisCardProps extends CardEditAndDrawerProps {
  /** The toolbar's own rendered height, in px — combined with `stickyTop` as
   *  the prompt-level popover's collision padding, so it never renders
   *  underneath the sticky toolbar. Not part of CardEditAndDrawerProps since
   *  most card kinds don't need it — only kinds with their own popover
   *  positioned relative to the toolbar do. */
  toolbarHeight?: number;
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
    ...ACTION_BUTTON_COLORS.red,
  },
  {
    value: "prompted",
    label: "Prompted",
    icon: HandHelping,
    // HandHelping has much more path detail than Check/X, so the same
    // strokeWidth reads noticeably heavier — thinned to match their weight.
    strokeWidth: 1.75,
    ...ACTION_BUTTON_COLORS.amber,
  },
  {
    value: "independent",
    label: "Independent",
    icon: Check,
    strokeWidth: 3,
    ...ACTION_BUTTON_COLORS.green,
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
    <span
      title={`Expected: ${level}`}
      data-tour="step-plan-badge"
      className="shrink-0 grid place-items-center text-stone-500"
    >
      <Icon className="size-4.5" strokeWidth={isIndependent ? 2.5 : 1.75} />
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

/** Everything the bookmark bar's Task Analysis chip needs, independent of
 *  whether the real TaskAnalysisCard is currently mounted anywhere — reads/
 *  writes the same useCardState-backed `statuses`/`current`/`promptLevel`/
 *  `viewIdx` slots TaskAnalysisCard itself uses, with lighter versions of
 *  its own `setStep`/`pickPromptLevel` (no expanded-list bubble-track
 *  animation state, no advance delay). `statuses`/`current`/`promptLevel`
 *  are now one entry per instance (see TaskAnalysisCard's own comment on
 *  why) — the chip always reads/writes whichever instance `viewIdx` points
 *  at, same as the real card, but has no way to switch instances itself;
 *  that's deliberately only reachable from the full card view's own
 *  Previous/Next Instance buttons, not a quick-score surface. `totalSteps`
 *  comes from the card's own `steps.length`, same as TaskAnalysisCard's own
 *  initial per-instance `statuses` entry — unlike Trial's `trials` array, this
 *  length is fixed by the card's config rather than growing dynamically, so
 *  no defensive padding is needed. When `promptLevels` is set, the chip's
 *  Prompted button reuses TaskAnalysisCard's own exported
 *  `ListTaskAnalysisPromptLevelButton` (see BookmarkChip.tsx) rather than a
 *  plain toggle — `pickPromptLevel` below is that button's write path. */
export function useTaskAnalysisChip(cardKey: string, totalSteps: number, promptLevels?: string[]) {
  const { markDirty, canRecordData } = useCardSession();
  const [statuses, setStatuses] = useCardState<StepStatus[][]>(cardKey, "statuses", () => [
    Array.from({ length: totalSteps }, () => null),
  ]);
  const [current, setCurrent] = useCardState<number[]>(cardKey, "current", () => [0]);
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>[]>(
    cardKey,
    "promptLevel",
    () => [{}],
  );
  const [viewIdx] = useCardState(cardKey, "viewIdx", 0);

  const activeStatuses = statuses[viewIdx] ?? [];
  const activeCurrent = current[viewIdx] ?? 0;
  const activePromptLevel = promptLevel[viewIdx] ?? {};

  const firstUnscored = activeStatuses.indexOf(null);
  const canScoreCurrent = firstUnscored === -1 || activeCurrent <= firstUnscored;
  const currentStatus: StepStatus = activeStatuses[activeCurrent] ?? null;
  const needsPromptLevelPicker = (promptLevels?.length ?? 0) > 0;
  const advanceCurrent = () =>
    setCurrent((prev) => {
      const next = prev.slice();
      next[viewIdx] = Math.min((next[viewIdx] ?? 0) + 1, totalSteps - 1);
      return next;
    });

  const setStep = (value: Exclude<StepStatus, null>) => {
    if (!canScoreCurrent) return;
    markDirty();
    const isToggleOff = currentStatus === value;
    if (!isToggleOff) {
      playSoundEffect(
        value === "independent" ? "correct" : value === "error" ? "error" : "prompted",
      );
    }
    setStatuses((prev) => {
      const next = prev.slice();
      const instanceNext = next[viewIdx].slice();
      instanceNext[activeCurrent] = isToggleOff ? null : value;
      next[viewIdx] = instanceNext;
      return next;
    });
    if (value !== "prompted" || isToggleOff) {
      setPromptLevel((prev) => {
        if (!(activeCurrent in (prev[viewIdx] ?? {}))) return prev;
        const next = prev.slice();
        const instanceNext = { ...next[viewIdx] };
        delete instanceNext[activeCurrent];
        next[viewIdx] = instanceNext;
        return next;
      });
    }
    if (!isToggleOff) advanceCurrent();
  };

  const pickPromptLevel = (level: string) => {
    if (!canScoreCurrent) return;
    markDirty();
    const isUnspecified = level === UNSPECIFIED_LEVEL;
    const isToggleOff =
      currentStatus === "prompted" &&
      (isUnspecified
        ? !(activeCurrent in activePromptLevel)
        : activePromptLevel[activeCurrent] === level);
    setStatuses((prev) => {
      const next = prev.slice();
      const instanceNext = next[viewIdx].slice();
      instanceNext[activeCurrent] = isToggleOff ? null : "prompted";
      next[viewIdx] = instanceNext;
      return next;
    });
    setPromptLevel((prev) => {
      const next = prev.slice();
      const instanceNext = { ...next[viewIdx] };
      if (isToggleOff || isUnspecified) delete instanceNext[activeCurrent];
      else instanceNext[activeCurrent] = level;
      next[viewIdx] = instanceNext;
      return next;
    });
    if (!isToggleOff) advanceCurrent();
  };

  return {
    current: activeCurrent,
    currentStatus,
    currentPromptLevel: activePromptLevel[activeCurrent] ?? null,
    canScoreCurrent,
    needsPromptLevelPicker,
    setStep,
    pickPromptLevel,
    canRecordData,
  };
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
  widthMode,
  onWidthModeChange,
}: TaskAnalysisCardProps) {
  const cardKey = id ?? title;
  // One entry per instance (a kid washing hands twice in one session, say,
  // is two independent runs through the same steps) — `viewIdx` is which
  // one is currently shown, same shape as Duration's own
  // `instances`/`viewIdx` split. Unlike Duration, a new instance is never
  // created implicitly (there's no natural "that one's obviously done"
  // signal the way stopping a timer is) — only the "Next Instance" button
  // in the full card view creates one (via `addInstance` below), and only
  // once there's no already-existing later instance for it to just browse
  // to instead (see `nextInstance`).
  const [statuses, setStatuses] = useCardState<StepStatus[][]>(cardKey, "statuses", () => [
    steps.map(() => null),
  ]);
  const [current, setCurrent] = useCardState<number[]>(cardKey, "current", () => [0]);
  // Keyed by step index within each instance, same idiom as TrialCard's
  // promptLevel — entries just don't exist for steps that aren't "prompted"
  // (or don't have a level chosen yet).
  const [promptLevel, setPromptLevel] = useCardState<Record<number, string>[]>(
    cardKey,
    "promptLevel",
    () => [{}],
  );
  const [viewIdx, setViewIdx] = useCardState(cardKey, "viewIdx", 0);
  const activeStatuses = statuses[viewIdx] ?? [];
  const activeCurrent = current[viewIdx] ?? 0;
  const activePromptLevel = promptLevel[viewIdx] ?? {};
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal, canRecordData } = useCardSession();
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
    setStatuses([steps.map(() => null)]);
    setCurrent([0]);
    setPromptLevel([{}]);
    setViewIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset, steps]);

  // Mirrors TrialCard's setResult: read the pre-toggle value from the
  // current render's closure (not inside the setState updater) so we know
  // whether this was a genuine score vs. a toggle-off before deciding
  // whether to auto-advance. `idx` is a step within `instanceIdx`, which
  // defaults to the CURRENTLY VIEWED instance — every caller except the
  // expanded, all-instances list (which passes its own row's instance
  // index explicitly) relies on that default rather than naming it.
  const setStep = (
    idx: number,
    value: Exclude<StepStatus, null>,
    advance = false,
    instanceIdx = viewIdx,
  ) => {
    markDirty();
    const isToggleOff = (statuses[instanceIdx] ?? [])[idx] === value;
    if (!isToggleOff) {
      playSoundEffect(
        value === "independent" ? "correct" : value === "error" ? "error" : "prompted",
      );
    }
    setStatuses((prev) => {
      const next = prev.slice();
      const instanceNext = next[instanceIdx].slice();
      instanceNext[idx] = isToggleOff ? null : value;
      next[instanceIdx] = instanceNext;
      return next;
    });
    // Any outcome other than "prompted" (including toggling it off) clears
    // a leftover prompt level — otherwise switching Prompted -> Independent
    // left the old level's sub-text orphaned under a button that no longer
    // reflects a prompt at all.
    if (value !== "prompted" || isToggleOff) {
      setPromptLevel((prev) => {
        if (!(idx in (prev[instanceIdx] ?? {}))) return prev;
        const next = prev.slice();
        const instanceNext = { ...next[instanceIdx] };
        delete instanceNext[idx];
        next[instanceIdx] = instanceNext;
        return next;
      });
    }
    setCurrent((prev) => {
      const next = prev.slice();
      next[instanceIdx] = idx;
      return next;
    });
    if (advance && !isToggleOff) {
      window.setTimeout(() => {
        setCurrent((prev) => {
          const next = prev.slice();
          next[instanceIdx] = Math.min((next[instanceIdx] ?? 0) + 1, steps.length - 1);
          return next;
        });
      }, 260);
    }
  };

  // Prompted, when promptLevels is set, opens a picker instead of a plain
  // toggle — picking a level marks the step prompted AND records which
  // level, so the two always stay in sync. Mirrors TrialCard's own
  // pickPromptLevel for its Error button. Same `instanceIdx` default as
  // setStep above, for the same reason.
  const pickPromptLevel = (idx: number, level: string, advance: boolean, instanceIdx = viewIdx) => {
    markDirty();
    const instanceStatuses = statuses[instanceIdx] ?? [];
    const instancePromptLevel = promptLevel[instanceIdx] ?? {};
    const isUnspecified = level === UNSPECIFIED_LEVEL;
    const isToggleOff =
      instanceStatuses[idx] === "prompted" &&
      (isUnspecified ? !(idx in instancePromptLevel) : instancePromptLevel[idx] === level);
    setStatuses((prev) => {
      const next = prev.slice();
      const instanceNext = next[instanceIdx].slice();
      instanceNext[idx] = isToggleOff ? null : "prompted";
      next[instanceIdx] = instanceNext;
      return next;
    });
    setPromptLevel((prev) => {
      const next = prev.slice();
      const instanceNext = { ...next[instanceIdx] };
      if (isToggleOff || isUnspecified) delete instanceNext[idx];
      else instanceNext[idx] = level;
      next[instanceIdx] = instanceNext;
      return next;
    });
    setCurrent((prev) => {
      const next = prev.slice();
      next[instanceIdx] = idx;
      return next;
    });
    if (advance && !isToggleOff) {
      window.setTimeout(() => {
        setCurrent((prev) => {
          const next = prev.slice();
          next[instanceIdx] = Math.min((next[instanceIdx] ?? 0) + 1, steps.length - 1);
          return next;
        });
      }, 260);
    }
  };

  const goTo = (idx: number) => {
    setCurrent((prev) => {
      const next = prev.slice();
      next[viewIdx] = Math.max(0, Math.min(idx, steps.length - 1));
      return next;
    });
  };

  // Which way the full-card slide (see the AnimatePresence below) plays —
  // forward (enter from right) for Next Instance, reversed for Previous
  // Instance, so going back actually reads as going back instead of
  // replaying the same "moving on" motion. Set right before the `viewIdx`
  // change that triggers it, same render.
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  // A fresh, fully-unmarked run through the same steps — the ONLY thing
  // "Next Instance" does at the end of the list (see nextInstance below).
  // Doesn't touch or clear any earlier instance's data; it's just appended,
  // and `viewIdx` moving to it is what the outer AnimatePresence reads to
  // slide the whole card over to it.
  const addInstance = () => {
    markDirty();
    const newIdx = statuses.length;
    setStatuses((prev) => [...prev, steps.map(() => null)]);
    setCurrent((prev) => [...prev, 0]);
    setPromptLevel((prev) => [...prev, {}]);
    setViewIdx(newIdx);
  };

  // "Next Instance" both browses an already-created later instance AND
  // creates the next one — same button either way, since from the tech's
  // side both read as "move on to the next run." Only actually creates one
  // once there's nowhere existing left to move on to.
  const nextInstance = () => {
    setSlideDir(1);
    if (viewIdx < statuses.length - 1) {
      setViewIdx(viewIdx + 1);
      return;
    }
    addInstance();
  };

  // Never creates anything — instance 0 has no "previous" to go to, which
  // is why this control only ever renders once viewIdx > 0 (see the track
  // JSX below).
  const prevInstance = () => {
    setSlideDir(-1);
    setViewIdx(Math.max(0, viewIdx - 1));
  };

  const completed = activeStatuses.filter((s) => s !== null).length;
  const independent = activeStatuses.filter((s) => s === "independent").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const isComplete = completed >= steps.length;
  const remaining = Math.max(0, steps.length - completed);
  // hasData looks across every instance (any step scored anywhere counts,
  // same as Duration's own totalMs summing every instance) — but
  // isComplete/progress/the value reported below describe only the
  // instance actually on screen, since "how far along is this run"
  // is inherently a per-instance question the way Duration's cumulative
  // elapsed time isn't.
  const hasAnyData = statuses.some((instanceStatuses) => instanceStatuses.some((s) => s !== null));
  useReportCardStatus(cardKey, hasAnyData, isComplete, {
    title,
    kind: "task-analysis",
    value: `${independent}/${steps.length}`,
    unit: "Independent",
  });

  // Steps must be scored in order — a step can't be scored while an earlier
  // one is still blank, so its own score buttons stay disabled until the
  // gap behind it closes. -1 (all scored) allows everything. `instanceIdx`
  // defaults to the viewed instance, same reasoning as setStep's own.
  const canScore = (idx: number, instanceIdx = viewIdx) => {
    const firstUnscoredForInstance = (statuses[instanceIdx] ?? []).indexOf(null);
    return firstUnscoredForInstance === -1 || idx <= firstUnscoredForInstance;
  };

  const hasPrevInstance = viewIdx > 0;
  const stepWidth = BUBBLE + GAP;
  // Previous Instance button + its own end-bar divider, when both are
  // rendered (see the track JSX below) — how many extra children sit
  // before bubble 0 in the track, so the measurement/drag math below can
  // find the right one by index.
  const leadingChildren = hasPrevInstance ? 2 : 0;

  // Which real DOM element the track should center — the active step
  // bubble normally, or (once every step in view is scored) the Next
  // Instance button itself, so finishing the last step reveals it
  // automatically instead of leaving it sitting past the fade mask,
  // reachable only by a deliberate extra drag. Measured off the real DOM
  // (see tileContentWidth's own comment above on why) rather than derived
  // from BUBBLE/GAP by hand — that math can't account for a leading
  // Previous Instance button (and its own divider) shifting every bubble's
  // true position, and re-deriving that shift by hand here would just be
  // the same class of bug this file already learned from once. Track
  // children, in order: [Previous Instance button, its end bar]?, one per
  // step, the end-bar divider, Next Instance — so the active bubble sits
  // at a fixed, known child index.
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackOffset, setTrackOffset] = useState(-(BUBBLE_CENTER / 2));
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const children = track.children;
      const showingNextInstance = isComplete && activeCurrent === steps.length - 1;
      const target = (
        showingNextInstance
          ? children[children.length - 1]
          : children[leadingChildren + activeCurrent]
      ) as HTMLElement | undefined;
      if (target) setTrackOffset(-(target.offsetLeft + target.offsetWidth / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [activeCurrent, isComplete, steps.length, leadingChildren]);

  // Same drag-to-swipe pattern as TrialCard's own bubble track — real touch/
  // mouse dragging in addition to the triangle nav buttons, snapping to
  // whichever step ends up nearest center on release.
  const dragX = useMotionValue(0);
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const finalOffset = trackOffset + info.offset.x;
    // Same real-DOM read as the measurement above — a leading Previous
    // Instance button (and its own divider) shifts step 0 away from the
    // track's own left edge, and this needs to know by how much to land on
    // the right step.
    const firstBubble = trackRef.current?.children[leadingChildren] as HTMLElement | undefined;
    const leadingOffset = firstBubble?.offsetLeft ?? 0;
    const targetIdx = Math.round(-(finalOffset + leadingOffset + BUBBLE_CENTER / 2) / stepWidth);
    goTo(targetIdx);
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
        detailsOpen={detailsOpen}
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
              icon={<TaskAnalysisIcon />}
              kind="task-analysis"
              dataTypeLabel="Task analysis"
              phase={phase}
              stats={[
                {
                  label: "Chaining",
                  value: chainingDirection === "backward" ? "Backward" : "Forward",
                },
                { label: "Instances", value: statuses.length },
                { label: "Steps", value: steps.length },
                { label: "Scored", value: `${completed} / ${steps.length}` },
                { label: "Independent", value: `${independent} / ${steps.length}` },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="task-analysis"
                />
              </div>
            )}
          </>
        }
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2" : "gap-1.5")}>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = activeStatuses[activeCurrent] === opt.value;
              if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
                return (
                  <ListTaskAnalysisPromptLevelButton
                    key={opt.value}
                    levels={promptLevels}
                    selectedLevel={activePromptLevel[activeCurrent] ?? null}
                    selected={selected}
                    disabled={!canRecordData || !canScore(activeCurrent)}
                    onPick={(level) => pickPromptLevel(activeCurrent, level, true)}
                    topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                    sizeClassName={large ? "size-10" : "size-7"}
                    iconSizeClassName={large ? "size-[19px]" : "size-3.5"}
                  />
                );
              }
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep(activeCurrent, opt.value, true);
                  }}
                  disabled={!canRecordData || !canScore(activeCurrent)}
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
            watch; it isn't otherwise part of either strip's own layout.
            `relative` additionally anchors the large-density-only nav
            arrows (position: absolute doesn't affect the measured width
            above, so this is safe to add without disturbing that). */}
        <div
          ref={tileContentRef}
          className={cn(
            "relative w-full flex flex-col items-center gap-0.5",
            // Shrinks the measured content width (tileContentWidth reads
            // this div's own content-box rect, which already excludes
            // padding) so the step text's own width leaves the arrows'
            // gutter clear instead of running underneath them.
            large && "px-6",
          )}
        >
          {/* Large density only — same "pushed to the tile's own edges"
           *  nav-arrow convention as Checklist's/Percent Correct's tiles;
           *  small density relies on swiping/tapping a dot alone. */}
          {large && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(activeCurrent - 1);
                }}
                disabled={activeCurrent === 0}
                aria-label="Previous step"
                className="absolute left-0 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(activeCurrent + 1);
                }}
                disabled={activeCurrent >= steps.length - 1}
                aria-label="Next step"
                className="absolute right-0 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
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
            current={activeCurrent}
            onCurrentChange={goTo}
            variant="centered"
            className="-mt-1 w-full"
            gapClassName={large ? "gap-2" : "gap-1.5"}
            itemWrapperClassName="flex items-center justify-center"
          >
            {(i) => {
              const isCurrent = i === activeCurrent;
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(i);
                  }}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    isCurrent ? (large ? "size-2.5" : "size-2") : large ? "size-1.5" : "size-1",
                    statusDotColor(activeStatuses[i]),
                  )}
                  style={{ opacity: isCurrent ? 1 : 0.5 }}
                  aria-hidden
                />
              );
            }}
          </SwipeStrip>
          <SwipeStrip
            count={steps.length}
            current={activeCurrent}
            onCurrentChange={goTo}
            variant="centered"
            className="w-full"
            gapClassName={large ? "gap-3" : "gap-2"}
            itemWrapperClassName="flex items-center justify-center"
          >
            {(i, isCenter) => {
              const status = activeStatuses[i];
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
        dataTypeIcon={<TaskAnalysisIcon />}
        kind="task-analysis"
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
              icon={<TaskAnalysisIcon />}
              kind="task-analysis"
              dataTypeLabel="Task analysis"
              phase={phase}
              stats={[
                {
                  label: "Chaining",
                  value: chainingDirection === "backward" ? "Backward" : "Forward",
                },
                { label: "Instances", value: statuses.length },
                { label: "Steps", value: steps.length },
                { label: "Scored", value: `${completed} / ${steps.length}` },
                { label: "Independent", value: `${independent} / ${steps.length}` },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="task-analysis"
                />
              </div>
            )}
          </>
        }
        actions={
          // Badge and buttons slide together — each button scores THIS step
          // specifically, so advancing to the next step should read as the
          // whole row moving on, not just the number changing in place.
          <ListActionSlide actionKey={activeCurrent}>
            <ListActionBadge value={activeCurrent + 1} />
            {OPTIONS.map((opt) => {
              if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
                return (
                  <ListTaskAnalysisPromptLevelButton
                    key={opt.value}
                    levels={promptLevels}
                    selectedLevel={activePromptLevel[activeCurrent] ?? null}
                    selected={activeStatuses[activeCurrent] === "prompted"}
                    disabled={!canRecordData || !canScore(activeCurrent)}
                    onPick={(level) => pickPromptLevel(activeCurrent, level, true)}
                    topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                  />
                );
              }
              return (
                <ListActionButton
                  key={opt.value}
                  icon={opt.icon}
                  strokeWidth={opt.strokeWidth}
                  variant={
                    opt.value === "error" ? "red" : opt.value === "prompted" ? "amber" : "green"
                  }
                  selected={activeStatuses[activeCurrent] === opt.value}
                  disabled={!canRecordData || !canScore(activeCurrent)}
                  ariaLabel={opt.label}
                  onClick={() => setStep(activeCurrent, opt.value, true)}
                />
              );
            })}
          </ListActionSlide>
        }
      />
    );
  }

  return (
    // Keyed on viewIdx so switching instances (nextInstance/prevInstance,
    // above) swaps this whole card over with a full-width slide — forward
    // (Next Instance) enters from the right and exits to the left, same
    // "moving on" direction as swiping ahead on a phone; backward (Previous
    // Instance) reverses both, via `slideDir`. No explicit overflow-hidden
    // clip wrapper — this card already reads full-bleed at the phone widths
    // this app targets, so sliding a full `x: "100%"` off either side
    // already lands past the edge of what a horizontally non-scrolling page
    // shows, without needing to also clip (and, with it, needing extra
    // padding to keep CardShell's own drop shadow from getting cropped
    // mid-slide).
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={viewIdx}
        initial={{ x: slideDir === 1 ? "100%" : "-100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: slideDir === 1 ? "-100%" : "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <CardShell
          title={title}
          phase={phase}
          dataType="Task Analysis"
          dataTypeIcon={<TaskAnalysisIcon />}
          kind="task-analysis"
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
          onPrevCard={onPrevCard}
          onNextCard={onNextCard}
          slideFrom={slideFrom}
          widthMode={widthMode}
          onWidthModeChange={onWidthModeChange}
          progress={progress}
          isComplete={isComplete}
          expanded={expanded}
          onToggleExpanded={() => {
            if (!expanded) {
              playSoundEffect("twirldown");
            } else {
              // Same idea as TrialCard's own twirl-down: collapsing should
              // land back on whichever step still needs scoring, not
              // wherever the stepper happened to be pointed before expanding.
              const firstUnscored = activeStatuses.indexOf(null);
              if (firstUnscored !== -1) goTo(firstUnscored);
            }
            setExpanded((v) => !v);
          }}
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
                kind="task-analysis"
                dataTypeLabel="Task analysis"
                phase={phase}
                stats={[
                  {
                    label: "Chaining",
                    value: chainingDirection === "backward" ? "Backward" : "Forward",
                  },
                  { label: "Instances", value: statuses.length },
                  { label: "Steps", value: steps.length },
                  { label: "Scored", value: `${completed} / ${steps.length}` },
                  { label: "Independent", value: `${independent} / ${steps.length}` },
                ]}
              />
              {(teachingProcedure || description) && (
                <div className="mt-4">
                  <TeachingProcedureAccordion
                    description={description}
                    data={teachingProcedure}
                    kind="task-analysis"
                  />
                </div>
              )}
            </>
          }
          expandedView={
            // Every instance, not just the one currently in view — expanded
            // mode is the "see everything at once" surface, same idea as
            // twirling open any other multi-instance card, so a divider (and
            // label) between each instance's own step list is what actually
            // tells them apart. Never rendered before the first one, so a
            // single-instance card (by far the common case) looks exactly
            // like it always has. Every row stays independently scoreable —
            // setStep/pickPromptLevel/canScore all take an explicit
            // instanceIdx here rather than relying on their viewIdx default,
            // since a row belongs to whichever instance it's under, not
            // necessarily the one the swipeable view above is showing.
            <div className="px-3 pt-1 pb-3 space-y-1">
              {statuses.map((instanceStatuses, instanceIdx) => {
                const instancePromptLevel = promptLevel[instanceIdx] ?? {};
                return (
                  <div key={instanceIdx}>
                    {instanceIdx > 0 && (
                      <div className="flex items-center gap-2 pt-3 pb-2" aria-hidden>
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Instance {instanceIdx + 1}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <ol className="space-y-1">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                          <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className={cn(
                              "flex-1 text-sm leading-tight",
                              instanceStatuses[i] && "text-foreground/80",
                            )}
                          >
                            {step}
                          </span>
                          <StepPlanBadge level={stepPlan?.[i]} />
                          <div className="flex items-center gap-1 shrink-0">
                            {OPTIONS.map((opt) => {
                              const Icon = opt.icon;
                              const selected = instanceStatuses[i] === opt.value;
                              if (
                                opt.value === "prompted" &&
                                promptLevels &&
                                promptLevels.length > 0
                              ) {
                                return (
                                  <ListTaskAnalysisPromptLevelButton
                                    key={opt.value}
                                    levels={promptLevels}
                                    selectedLevel={instancePromptLevel[i] ?? null}
                                    selected={selected}
                                    disabled={!canRecordData || !canScore(i, instanceIdx)}
                                    onPick={(level) =>
                                      pickPromptLevel(i, level, false, instanceIdx)
                                    }
                                    topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                                    sizeClassName="size-8"
                                  />
                                );
                              }
                              return (
                                <motion.button
                                  key={opt.value}
                                  onClick={() => setStep(i, opt.value, false, instanceIdx)}
                                  disabled={!canRecordData || !canScore(i, instanceIdx)}
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
                  </div>
                );
              })}
            </div>
          }
        >
          <div className="relative px-2 pt-3 pb-1">
            <div className="relative h-16">
              <TriangleNav
                direction="left"
                onClick={() => goTo(activeCurrent - 1)}
                disabled={activeCurrent === 0}
              />
              <TriangleNav
                direction="right"
                onClick={() => goTo(activeCurrent + 1)}
                disabled={activeCurrent >= steps.length - 1}
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
                  ref={trackRef}
                  className="absolute top-1/2 left-1/2 flex items-center"
                  style={{ gap: GAP, x: dragX, translateY: "-50%" }}
                  animate={{ x: trackOffset }}
                  transition={{ type: "spring", stiffness: 320, damping: 34 }}
                  drag="x"
                  dragConstraints={{ left: -((steps.length - 1) * stepWidth) - 200, right: 200 }}
                  dragElastic={0.08}
                  onDragEnd={handleDragEnd}
                >
                  {/* Previous Instance — only once there's actually an
                      earlier instance to go back to (instance 0 has none).
                      Mirrors Next Instance below: same pill shape, same
                      "lives right in the draggable strip" placement, just on
                      the opposite end and never creating anything (see
                      prevInstance's own comment). */}
                  {hasPrevInstance && (
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevInstance();
                      }}
                      whileTap={{ scale: 0.94 }}
                      className="shrink-0 h-10 flex items-center gap-1.5 rounded-full border-2 border-blue-300 bg-blue-50 px-3 text-blue-700 transition-colors"
                    >
                      <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} />
                      <span className="text-xs font-semibold whitespace-nowrap">Prev Instance</span>
                    </motion.button>
                  )}
                  {/* Same "quota boundary" end bar as the one after the last
                      step below, mirrored here — the pair of them read as
                      the step count's own start/end brackets once there's
                      more than one instance to browse past on either
                      side. */}
                  {hasPrevInstance && (
                    <div
                      className="shrink-0 w-px bg-foreground/40 mx-2"
                      style={{ height: 40 }}
                      aria-hidden
                    />
                  )}
                  {steps.map((_, i) => {
                    const isCenter = i === activeCurrent;
                    const status = activeStatuses[i];
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
                  {/* End bar — same "quota boundary" divider as Percent
                      Correct's own maxTrials marker. Task analysis steps
                      are always a fixed count (there's no separate max to
                      configure), so this sits after the last step
                      unconditionally rather than behind a maxTrials
                      check. */}
                  <div
                    className="shrink-0 w-px bg-foreground/40 mx-2"
                    style={{ height: 40 }}
                    aria-hidden
                  />
                  {/* Next Instance — browses an already-created later
                      instance, or (only once there's nowhere existing left
                      to browse to) creates one — see nextInstance's own
                      comment. Lives right after the end bar in the same
                      draggable strip, the same "one more swipe past the
                      last step" idiom the strip already uses for reaching
                      anything past where a normal step count would put the
                      mask's own fade — not hidden, just the next thing
                      along the same track. Once the viewed instance is
                      complete, the track's own trackOffset (above) centers
                      THIS button automatically, so finishing the last step
                      is what actually reveals it rather than requiring an
                      extra manual drag past the fade to find it. onClick
                      (not a plain button here) plus stopPropagation matches
                      every OTHER interactive control already living inside
                      this drag="x" parent (the step bubbles' own
                      onClick={() => goTo(i)}), which already coexists with
                      real dragging via Motion's own built-in drag-vs-tap
                      threshold. */}
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextInstance();
                    }}
                    disabled={!canRecordData}
                    whileTap={{ scale: 0.94 }}
                    className="shrink-0 h-10 flex items-center gap-1.5 rounded-full border-2 border-blue-300 bg-blue-50 px-3 text-blue-700 transition-colors disabled:opacity-40"
                  >
                    <ArrowRight className="size-4 shrink-0" strokeWidth={2.5} />
                    <span className="text-xs font-semibold whitespace-nowrap">Next Instance</span>
                  </motion.button>
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
                Step {activeCurrent + 1} (of {steps.length})
              </span>
            </div>

            {/* flex+justify-center on the row, rather than text-align:center
             *  on the paragraph itself: a centered *line* pushes overflow
             *  past both edges equally, and CardShell's own rounded-corner
             *  overflow-hidden then clips the beginning of a too-long word
             *  along with the end. Centering the *box* instead means a
             *  short line (which fits, so the box shrinks to its content)
             *  still reads as centered, but a long line's box gets capped
             *  at max-w-full — leaving nothing left to center around — so
             *  it truncates from its natural (left) start, losing only the
             *  tail. */}
            <div className="mt-2 px-3 flex justify-center items-center gap-1.5">
              <StepPlanBadge level={stepPlan?.[activeCurrent]} />
              <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold leading-tight">
                {steps[activeCurrent]}
              </p>
            </div>

            <div className="mt-3 flex justify-center gap-1 px-2">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = activeStatuses[activeCurrent] === opt.value;
                if (opt.value === "prompted" && promptLevels && promptLevels.length > 0) {
                  return (
                    <TaskAnalysisPromptLevelButton
                      key={opt.value}
                      levels={promptLevels}
                      selectedLevel={activePromptLevel[activeCurrent] ?? null}
                      selected={selected}
                      disabled={!canRecordData || !canScore(activeCurrent)}
                      onPick={(level) => pickPromptLevel(activeCurrent, level, true)}
                      topInset={(stickyTop ?? 0) + (toolbarHeight ?? 0)}
                    />
                  );
                }
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => setStep(activeCurrent, opt.value, true)}
                    disabled={!canRecordData || !canScore(activeCurrent)}
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
      </motion.div>
    </AnimatePresence>
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
            ACTION_BUTTON_COLORS.amber.classes,
            selected && cn("btn-bevel", ACTION_BUTTON_COLORS.amber.selectedClasses),
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

/** Icon-only circular version of TaskAnalysisPromptLevelButton — the shared
 *  "compact" convention (matching ListActionButton's own hasMenu affordance)
 *  used anywhere space is too tight for the standard view's pill-with-label:
 *  List mode's floating action row, the expanded list's per-step Prompted
 *  button, and both grid tile densities. Sized via sizeClassName/
 *  iconSizeClassName (defaulting to List mode's own size-7/size-3.5) rather
 *  than a fixed size, so one component covers every one of those contexts
 *  instead of near-identical copies drifting out of sync with each other —
 *  which is exactly what happened before: the expanded-list row had its own
 *  variant with no triangle at all, and grid mode had no picker here
 *  whatsoever. Also reused as-is by the bookmark bar's own Task Analysis
 *  chip (see BookmarkChip.tsx), which is why the collision boundary below is
 *  pinned to the document rather than left at Radix's default. */
export function ListTaskAnalysisPromptLevelButton({
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
          aria-label="Prompted"
          aria-haspopup
          className={cn(
            "btn-bevel relative shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
            sizeClassName,
            ACTION_BUTTON_COLORS.amber.classes,
            selected && cn("btn-bevel", ACTION_BUTTON_COLORS.amber.selectedClasses),
          )}
        >
          <HandHelping className={cn(iconSizeClassName, "-translate-y-0.5")} strokeWidth={1.75} />
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
        // See ListPromptLevelButton's own comment in TrialCard.tsx — same
        // fix, needed for the same reason once this is reused inside the
        // bookmark bar's overflow-x-auto strip.
        collisionBoundary={typeof document !== "undefined" ? document.body : undefined}
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

/** Shared popover body for every Prompted-picker variant above — the
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
            ? "bg-amber-500 text-white"
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
                ? "bg-amber-500 text-white"
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
