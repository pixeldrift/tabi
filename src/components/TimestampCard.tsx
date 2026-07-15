import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, X, Link2 } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge, ListActionButton } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TimestampIcon } from "./icons/TimestampIcon";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { useNotifications } from "./NotificationContext";
import { TimeKeypad } from "./TimeKeypad";
import { cn } from "@/lib/utils";

export type IntervalStatus = "correct" | "incorrect" | null;

export interface TimestampCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Length of each scored interval, in minutes (e.g. 30 or 60). */
  intervalMin: number;
  /** Total number of intervals across the whole observation window — omit
   *  for an open-ended card (e.g. a toileting check that runs the whole
   *  session): it then defaults to showing `defaultWindowHours` worth of
   *  intervals, growing to always show one more than the current elapsed
   *  time if the session runs past that. */
  intervalCount?: number;
  /** Only relevant when `intervalCount` is omitted — how many hours of
   *  intervals to show by default. */
  defaultWindowHours?: number;
  /** Button + measurement-row label for the positive outcome. */
  positiveLabel?: string;
  /** Button + measurement-row label for the negative outcome. */
  negativeLabel?: string;
  /** Whether the elapsed-time pill is locked to the session clock (the
   *  normal case) or editable via a tap-to-enter keypad — TEMPORARILY
   *  exposed so elapsed time can be typed in directly for testing;
   *  defaults to locked. */
  locked?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
}

// ---- Human-readable interval-label formatting ----
// "1: 0-30m", "2: 30m-60m", "3: 1h-1hr30m" — an interval whose END still
// falls within the first hour is written entirely in plain minutes
// (including a bare "0" for the very first, zero-valued boundary); once an
// interval's end passes the 60-minute mark, BOTH of its boundaries switch to
// hour notation instead — a round hour reads as "1h", an hour-plus-minutes
// boundary as "1hr30m". Deciding hour-vs-minute per INTERVAL (not per
// boundary in isolation) is what keeps interval 2's own end (60 min) reading
// as "60m" while interval 3's matching start (the same 60-minute instant)
// reads as "1h" — each boundary takes its format from the interval it's
// closing out or opening into.
function formatBoundary(min: number, hourMode: boolean): string {
  if (!hourMode) return min === 0 ? "0" : `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}hr${rem}m`;
}

/** Just the time range, e.g. "0-30m" — no leading number/colon. */
function intervalRange(index: number, intervalMin: number): string {
  const start = index * intervalMin;
  const end = (index + 1) * intervalMin;
  const hourMode = end > 60;
  return `${formatBoundary(start, hourMode)}-${formatBoundary(end, hourMode)}`;
}

/** "1: 0-30m" — same number/colon/text convention as Task Analysis's own
 *  step labels ("1: Turn on water"). */
export function intervalLabel(index: number, intervalMin: number): string {
  return `${index + 1}: ${intervalRange(index, intervalMin)}`;
}

/** A single time boundary in the "30m" / "1hr" / "1hr 30m" / "2hrs" style —
 *  shared by `intervalEndLabel` (just the higher boundary) and the "time to
 *  check" alert's own start-end range (see `intervalCheckRangeLabel`). */
function formatIntervalBoundary(totalMin: number): string {
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const rem = totalMin % 60;
  const hrPart = `${hours}hr${hours > 1 ? "s" : ""}`;
  return rem === 0 ? hrPart : `${hrPart} ${rem}m`;
}

/** Just the interval's higher (end) boundary — "30m", "1hr", "1hr 30m",
 *  "2hrs" — what the standard view's own header shows for the viewed
 *  interval instead of a full start-end range. */
function intervalEndLabel(index: number, intervalMin: number): string {
  return formatIntervalBoundary((index + 1) * intervalMin);
}

/** "1hr-1hr 30m" — the full start-end range in that same boundary style,
 *  used as the "time to check" alert's own sub-text instead of the card's
 *  title. */
function intervalCheckRangeLabel(index: number, intervalMin: number): string {
  return `${formatIntervalBoundary(index * intervalMin)}-${formatIntervalBoundary((index + 1) * intervalMin)}`;
}

function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${s.toString().padStart(2, "0")}` : `${mm}:${s.toString().padStart(2, "0")}`;
}

/** Where an interval sits relative to `viewIdx` — the position the nav
 *  arrows move, same "current/browsable" idiom as Task Analysis's own
 *  `current` step. */
type Recency = "current" | "past" | "future";

function recencyOf(index: number, viewIdx: number): Recency {
  if (index === viewIdx) return "current";
  return index < viewIdx ? "past" : "future";
}

// Bubble/badge coloring shared by the timeline's own numbers and the
// expanded view's per-row badges — gray until an interval has actually been
// scored, then the same green/red as its button. The current (viewed)
// interval reads solid/full-opacity; anything already passed fades out;
// anything still ahead stays flat gray regardless of status, since it
// hasn't come up yet.
function statusColors(status: IntervalStatus, recency: Recency) {
  if (recency === "future") {
    return { bg: "bg-foreground/5 border-foreground/10", text: "text-foreground/30", fade: "" };
  }
  const fade = recency === "past" ? "opacity-60" : "";
  if (status === "correct") return { bg: "bg-green-50 border-green-300", text: "text-green-700", fade };
  if (status === "incorrect") return { bg: "bg-red-50 border-red-300", text: "text-red-700", fade };
  return recency === "current"
    ? { bg: "bg-card border-foreground/30", text: "text-foreground", fade: "" }
    : { bg: "bg-foreground/5 border-foreground/10", text: "text-foreground/30", fade };
}

export function TimestampCard({
  id,
  title,
  phase = "Intervention",
  description,
  intervalMin,
  intervalCount,
  defaultWindowHours = 4,
  positiveLabel = "Correct",
  negativeLabel = "Incorrect",
  locked = true,
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
}: TimestampCardProps) {
  const cardKey = id ?? title;
  // Session-linked elapsed time — always ticking with the session (no local
  // play/pause of its own, unlike Rate/Duration's unlocked mode) so "which
  // interval is current" is a pure function of session time, not something
  // a user can navigate ahead of or pause independently.
  const [elapsed, setElapsed] = useCardState(cardKey, "elapsed", 0); // ms
  const [expanded, setExpanded] = useState(false);
  const { sessionRunning, subscribeTick } = useSession();
  const { markDirty, resetSignal } = useCardSession();

  const intervalMs = intervalMin * 60 * 1000;
  // With no fixed intervalCount, the card is open-ended: show at least
  // `defaultWindowHours` worth of intervals, growing to always keep one
  // extra (unscored, upcoming) interval past whichever one is current —
  // rather than a hard total that either runs out or gets cramped thinner
  // and thinner the longer the session runs.
  const defaultWindowIntervalCount = Math.max(1, Math.ceil((defaultWindowHours * 60) / intervalMin));
  const uncappedIndex = Math.floor(elapsed / intervalMs);
  const displayIntervalCount =
    intervalCount !== undefined ? intervalCount : Math.max(defaultWindowIntervalCount, uncappedIndex + 2);
  const currentIndex = intervalCount !== undefined ? Math.min(intervalCount - 1, uncappedIndex) : uncappedIndex;

  // Which interval is being browsed/scored — like Task Analysis's own
  // `current` step, navigable with the triangle arrows below, independent
  // of `currentIndex` (the real, session-time-driven "now"). Auto-follows
  // `currentIndex` the instant it moves to a new interval (see the effect
  // below), so browsing away is only ever temporary — the next real
  // interval boundary snaps the view back to live.
  const [viewIdx, setViewIdx] = useCardState(cardKey, "viewIdx", currentIndex);
  const prevCurrentIndexRef = useRef(currentIndex);
  // Separate from prevCurrentIndexRef above — that one drives auto-follow
  // and must update synchronously in the same effect tick; this one just
  // guards the "time to check" alert (see below) against re-firing for an
  // index it's already alerted for, on its own independent effect.
  const prevAlertIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (currentIndex !== prevCurrentIndexRef.current) {
      prevCurrentIndexRef.current = currentIndex;
      setViewIdx(currentIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const [statuses, setStatuses] = useCardState<IntervalStatus[]>(cardKey, "statuses", () =>
    Array(displayIntervalCount).fill(null),
  );
  // Grows the persisted statuses array as the open-ended window grows —
  // only ever extends (never truncates), so nothing already scored is lost.
  useEffect(() => {
    setStatuses((prev) => {
      if (prev.length >= displayIntervalCount) return prev;
      return [...prev, ...Array(displayIntervalCount - prev.length).fill(null)];
    });
  }, [displayIntervalCount]);

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setStatuses(Array(intervalCount ?? defaultWindowIntervalCount).fill(null));
    setElapsed(0);
    setViewIdx(0);
    prevCurrentIndexRef.current = 0;
    prevAlertIndexRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  useEffect(() => {
    if (!sessionRunning) return;
    return subscribeTick((d) => setElapsed((e) => e + d));
  }, [sessionRunning, subscribeTick]);

  const viewStatus = statuses[viewIdx];
  const scoredCount = statuses.filter((s) => s !== null).length;
  const isComplete = scoredCount === displayIntervalCount;
  useReportCardStatus(cardKey, scoredCount > 0, isComplete);

  const goTo = (idx: number) => {
    setViewIdx(Math.max(0, Math.min(idx, displayIntervalCount - 1)));
  };

  // Generalized to an arbitrary index (not just `viewIdx`) — the expanded
  // view lets any interval be scored or corrected directly, mirroring Task
  // Analysis's own expanded per-step editing.
  const score = (index: number, value: Exclude<IntervalStatus, null>) => {
    markDirty();
    setStatuses((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  };

  // Own root element ref — same "wrap the CardShell return in a plain div"
  // convention Duration/Rate cards use for their own scroll-to-card jump
  // (see useRegisterActiveTimer's elementRef) — used below so the "time to
  // check" alert's own Now button can scroll straight back to this card.
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const { push: pushNotification } = useNotifications();
  // Pops a "time to check" alert every time a new interval becomes current
  // (not on mount, and not while the session is paused — elapsed, and so
  // currentIndex, only ever advances while it's running). Scoring from the
  // alert calls this same `score` closure the card itself uses, so the
  // bubble/button color and the alert's own highlighting both come from
  // the identical source of truth.
  useEffect(() => {
    if (currentIndex === 0) return;
    if (currentIndex === prevAlertIndexRef.current) return;
    prevAlertIndexRef.current = currentIndex;
    pushNotification({
      dedupeKey: `timestamp-check:${cardKey}:${currentIndex}`,
      kind: "alert-now",
      title: `Check if ${positiveLabel}`,
      body: intervalCheckRangeLabel(currentIndex, intervalMin),
      icon: "bell-chime",
      allowSnooze: true,
      timestampCheck: {
        positiveLabel,
        negativeLabel,
        initialStatus: statuses[currentIndex] ?? null,
        onScore: (value) => score(currentIndex, value),
        onScrollToCard: () => cardElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const measurementLabelOverride = {
    positive: `Mark ${positiveLabel} if`,
    negative: `Mark ${negativeLabel} if`,
  };

  // Rendered inside the timeline itself, following the "now" chevron rather
  // than sitting in the header — see IntervalTimeline's own `timerPill` prop.
  const timerPill = locked ? (
    <span
      aria-label="Locked to session time"
      title="Locked to session time"
      className="inline-flex items-center shrink-0 rounded-full border border-stone-300 bg-stone-100 pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-muted-foreground"
    >
      {formatCompactTime(elapsed)}
      <Link2 className="ml-1 size-3 rotate-45" strokeWidth={2.5} />
    </span>
  ) : (
    <TimeKeypad
      valueMs={elapsed}
      onReplace={(ms) => {
        setElapsed(Math.max(0, ms));
        markDirty();
      }}
      onAdd={(ms) => {
        setElapsed(Math.max(0, elapsed + ms));
        markDirty();
      }}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          disabled={!sessionRunning}
          aria-label="Edit elapsed time (testing)"
          className="inline-flex items-center shrink-0 rounded-full border border-blue-500 bg-white pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-foreground cursor-text hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {formatCompactTime(elapsed)}
        </button>
      )}
    </TimeKeypad>
  );

  const details = (
    <>
      <DrawerQuickFacts
        icon={<TimestampIcon />}
        dataTypeLabel="Timestamp"
        phase={phase}
        stats={[
          { label: "Interval", value: `${intervalMin}m` },
          { label: "Scored", value: `${scoredCount} / ${displayIntervalCount}` },
        ]}
      />
      {teachingProcedure && (
        <div className="mt-4">
          <TeachingProcedureAccordion
            data={teachingProcedure}
            kind="timestamp"
            measurementLabelOverride={measurementLabelOverride}
          />
        </div>
      )}
    </>
  );

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
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        details={details}
        progress={(scoredCount / displayIntervalCount) * 100}
        isComplete={isComplete}
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2.5" : "gap-1.5")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                score(viewIdx, "incorrect");
              }}
              disabled={!sessionRunning}
              aria-label={negativeLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                viewStatus === "incorrect"
                  ? "bg-red-400 border-red-500 text-white"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              <X className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                score(viewIdx, "correct");
              }}
              disabled={!sessionRunning}
              aria-label={positiveLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                viewStatus === "correct"
                  ? "bg-green-400 border-green-500 text-white"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
              )}
            >
              <Check className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-0.5">
          <div className="inline-flex items-center gap-1">
            <span className={cn("font-display leading-none tabular-nums", large ? "text-[32px]" : "text-[24px]")}>
              {viewIdx + 1}
            </span>
            <span className={cn("font-display text-foreground/30", large ? "text-lg" : "text-sm")}>/</span>
            <span className={cn("font-display leading-none tabular-nums text-foreground/50", large ? "text-lg" : "text-sm")}>
              {displayIntervalCount}
            </span>
          </div>
          <span className={cn("text-muted-foreground tabular-nums", large ? "text-[11px]" : "text-[9px]")}>
            {intervalLabel(viewIdx, intervalMin)}
          </span>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<TimestampIcon />}
        dataTypeLabel="Timestamp"
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
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        progress={(scoredCount / displayIntervalCount) * 100}
        isComplete={isComplete}
        actions={
          <div className="flex items-center gap-1">
            <ListActionBadge value={viewIdx + 1} weight="regular" />
            <ListActionButton
              icon={X}
              variant="red"
              selected={viewStatus === "incorrect"}
              disabled={!sessionRunning}
              ariaLabel={negativeLabel}
              onClick={() => score(viewIdx, "incorrect")}
            />
            <ListActionButton
              icon={Check}
              variant="green"
              selected={viewStatus === "correct"}
              disabled={!sessionRunning}
              ariaLabel={positiveLabel}
              onClick={() => score(viewIdx, "correct")}
            />
          </div>
        }
      />
    );
  }

  return (
    <div ref={cardElRef} className="w-full max-w-md scroll-mt-32">
      <CardShell
      title={title}
      phase={phase}
      dataType="Timestamp"
      dataTypeIcon={<TimestampIcon />}
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
      details={details}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      expandedView={
        <TimestampExpandedView
          intervalCount={displayIntervalCount}
          intervalMin={intervalMin}
          intervalMs={intervalMs}
          statuses={statuses}
          currentIndex={currentIndex}
          viewIdx={viewIdx}
          elapsedMs={elapsed}
          sessionRunning={sessionRunning}
          positiveLabel={positiveLabel}
          negativeLabel={negativeLabel}
          onScore={score}
          timerPill={timerPill}
        />
      }
    >
      <div className="px-5 pt-2 pb-4 flex flex-col gap-1">
        <div className="text-center text-sm font-semibold tabular-nums">
          {intervalEndLabel(viewIdx, intervalMin)}
        </div>

        <div className="relative px-10">
          <TriangleNav direction="left" onClick={() => goTo(viewIdx - 1)} disabled={viewIdx <= 0} />
          <TriangleNav
            direction="right"
            onClick={() => goTo(viewIdx + 1)}
            disabled={viewIdx >= displayIntervalCount - 1}
          />
          <IntervalTimeline
            intervalCount={displayIntervalCount}
            elapsedMs={elapsed}
            intervalMs={intervalMs}
            currentIndex={currentIndex}
            viewIdx={viewIdx}
            statuses={statuses}
            timerPill={timerPill}
          />
        </div>

        <div className="mt-2 flex items-center gap-3">
          <ScoreButton
            variant="negative"
            label={negativeLabel}
            selected={viewStatus === "incorrect"}
            disabled={!sessionRunning}
            onClick={() => score(viewIdx, "incorrect")}
          />
          <ScoreButton
            variant="positive"
            label={positiveLabel}
            selected={viewStatus === "correct"}
            disabled={!sessionRunning}
            onClick={() => score(viewIdx, "correct")}
          />
        </div>
      </div>
      </CardShell>
    </div>
  );
}

// The "now" chevron is the Schedule tab's own arrow (see ScheduleView.tsx),
// which points RIGHT to cross a vertical list from its left edge — rotated
// -90° for the horizontal timeline (below) so it instead points UP,
// crossing that bar from underneath; used un-rotated for the expanded
// view's own vertical bar, where it already points the right way as-is.
const NOW_CHEVRON_PATH = "M3 2 Q1 2 1 4 V16 Q1 18 3 18 L13 11.5 Q15 10 13 8.5 Z";

// Fixed px per interval segment (both timelines) — keeps each interval a
// comfortable, constant size no matter how many total intervals exist,
// rather than getting squeezed thinner the longer an open-ended card's
// window grows. The track is free to run wider/taller than its own
// viewport; each viewport auto-scrolls (a spring transform, not real
// scroll) to keep the viewed interval in frame and fades its own trailing
// edge, the same idiom as Percent Correct's own draggable trial-bubble
// strip.
const SEG_W = 64;
const BAR_H = 10;
// Same diameter as every period bubble (see IntervalTimeline's own comment) —
// hoisted here so the nav arrows below can vertically center themselves on
// the bubble row specifically, rather than the timeline's full height
// (bubbles + bar + chevron).
const BUBBLE = 24;
// The currently-viewed interval's own bubble stands out at a larger size —
// same "active is bigger" idiom used elsewhere (e.g. the enlarged current
// dot on other cards' quick-glance strips) — so it needs its own row height
// tall enough to fit without clipping (bubbles are bottom-anchored, so the
// bigger one simply grows upward).
const BUBBLE_CURRENT = 32;
const BUBBLE_ROW_H = BUBBLE_CURRENT;
// Matches IntervalTimeline's own leading `pt-1` before the bubble row.
const BUBBLE_ROW_TOP_PX = 4;
const NAV_CENTER_PX = BUBBLE_ROW_TOP_PX + BUBBLE_ROW_H / 2;
// The "now" chevron's own half-width, roughly, once rotated on its side —
// extra room so it can render in full even parked right at a track edge.
// Chevron height (its rotated SVG) + a small gap + the timer pill's own
// height (h-5) stacked underneath it, following the same x position.
const CHEVRON_ROW_H = 18 + 4 + 20;
const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 32 } as const;
// Fades both edges — like Percent Correct's own trial-bubble strip, the
// viewed interval sits centered in the viewport with past/future segments
// trailing off on either side, so both directions need to fade out. Narrow
// and hugging the edge, rather than eating a big chunk of the viewport.
const HORIZONTAL_FADE_MASK = {
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
  maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
} as const;

function IntervalTimeline({
  intervalCount,
  elapsedMs,
  intervalMs,
  currentIndex,
  viewIdx,
  statuses,
  timerPill,
}: {
  intervalCount: number;
  elapsedMs: number;
  intervalMs: number;
  currentIndex: number;
  viewIdx: number;
  statuses: IntervalStatus[];
  timerPill: ReactNode;
}) {
  // Every period is an equal length of time, so its bubble is the same size
  // as every other's — only the border weight and the solid/faded/gray
  // recency treatment set one apart from another, not a bigger diameter.
  // (BUBBLE itself lives at module scope — the nav arrows need it too.)
  // Every interval before `currentIndex` is fully elapsed; `currentIndex`
  // itself is partially filled; nothing after it is filled at all — a
  // single continuous fill width follows directly from that, rather than a
  // percentage of some fixed (and, for an open-ended card, nonexistent)
  // total duration. This "now" fill/chevron always reflects the real
  // session clock, independent of whatever interval is being browsed —
  // starts at zero (the session's own start) and never gets any extra
  // padding tacked onto it.
  const segFillFrac = Math.min(1, Math.max(0, (elapsedMs - currentIndex * intervalMs) / intervalMs));
  const fillPx = currentIndex * SEG_W + segFillFrac * SEG_W;
  // Continuous centering, the same idiom as Percent Correct's own
  // trial-bubble strip: the viewed interval's own bubble — which now marks
  // the interval's END (see below), matching the bar's own divider ticks —
  // always sits dead-center in the viewport.
  const trackOffsetPx = -((viewIdx + 1) * SEG_W);

  return (
    <div className="pt-1">
      {/* Period bubbles — parked in place above their own segment (not a
          draggable/swipeable strip like Percent Correct's trial bubbles),
          gray until scored then colored to match the button that scored
          it. The currently-viewed one grows larger to stand out. */}
      <div className="relative overflow-hidden" style={{ height: BUBBLE_ROW_H, ...HORIZONTAL_FADE_MASK }}>
        <motion.div
          className="absolute left-1/2 top-0"
          style={{ height: BUBBLE_ROW_H }}
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          {Array.from({ length: intervalCount }, (_, i) => {
            const recency = recencyOf(i, viewIdx);
            const { bg, text, fade } = statusColors(statuses[i], recency);
            const isCurrent = recency === "current";
            return (
              <div key={i} className="absolute bottom-0 -translate-x-1/2" style={{ left: (i + 1) * SEG_W }}>
                <motion.div
                  className={cn(
                    "rounded-full flex items-center justify-center font-display font-bold tabular-nums transition-colors duration-200",
                    isCurrent ? "border-2 text-sm" : "border text-[11px]",
                    bg,
                    text,
                    fade,
                  )}
                  animate={{ width: isCurrent ? BUBBLE_CURRENT : BUBBLE, height: isCurrent ? BUBBLE_CURRENT : BUBBLE }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                >
                  {i + 1}
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>
      {/* The single combined progress indicator: the gray track fills light
          blue as the session clock advances, and the chevron below marks
          exactly how far the fill has reached — no separate "percent
          scored" bar duplicating this one. The gray/blue pill is sized to
          the track's own true bounds (0 to the last interval's end), not
          the viewport — otherwise, once the viewed interval is centered,
          gray backdrop would show through before the session's own start. */}
      <div
        className="relative overflow-hidden mt-0.5"
        style={{ height: BAR_H, ...HORIZONTAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div
            className="absolute rounded-full overflow-hidden bg-stone-200"
            style={{ top: 0, left: 0, height: BAR_H, width: intervalCount * SEG_W }}
          >
            <div
              className="absolute bg-blue-200 transition-[width]"
              style={{ top: 0, left: 0, height: BAR_H, width: fillPx }}
              aria-hidden
            />
          </div>
          {Array.from({ length: intervalCount - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute w-px bg-white"
              style={{ top: 0, height: BAR_H, left: (i + 1) * SEG_W }}
              aria-hidden
            />
          ))}
        </motion.div>
      </div>
      {/* The "now" chevron and the mini timer pill follow the same real
          elapsed-time position, the pill stacked directly underneath the
          chevron it belongs to rather than living in the card's own
          header. */}
      <div className="relative overflow-hidden" style={{ height: CHEVRON_ROW_H, ...HORIZONTAL_FADE_MASK }}>
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-1" style={{ left: fillPx }}>
            <svg
              width="14"
              height="18"
              viewBox="0 0 16 20"
              style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
              aria-hidden
            >
              <path d={NOW_CHEVRON_PATH} fill="#2563eb" />
            </svg>
            {timerPill}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const ROW_H = 28; // matches h-7 row buttons
// A bit more breathing room between rows than the standard-view idiom
// (space-y-1.5) — enough rows' worth of buttons crowd together vertically
// that the extra gap reads clearly, unlike a single horizontal row.
const ROW_GAP = 12;
const ROW_SLOT = ROW_H + ROW_GAP;
const VISIBLE_ROWS = 4; // how many intervals fit in the scrollable viewport at once

/** Twirl-down alternative to the standard view's horizontal timeline — same
 *  progress fill and "now" indicator, just running vertically alongside a
 *  list of every interval, each with its own working score buttons (not
 *  gated to only the current one), mirroring Task Analysis's own expanded
 *  per-step editing. Only `VISIBLE_ROWS` show at once, auto-scrolled
 *  (spring transform) to keep the viewed interval in frame. Unlike the
 *  standard view's own horizontal strip, nothing here fades at its edges —
 *  that fade exists purely so the horizontal nav arrows don't look like
 *  they're clipping content, and this view has no nav arrows of its own. */
function TimestampExpandedView({
  intervalCount,
  intervalMin,
  intervalMs,
  statuses,
  currentIndex,
  viewIdx,
  elapsedMs,
  sessionRunning,
  positiveLabel,
  negativeLabel,
  onScore,
  timerPill,
}: {
  intervalCount: number;
  intervalMin: number;
  intervalMs: number;
  statuses: IntervalStatus[];
  currentIndex: number;
  viewIdx: number;
  elapsedMs: number;
  sessionRunning: boolean;
  positiveLabel: string;
  negativeLabel: string;
  onScore: (index: number, value: Exclude<IntervalStatus, null>) => void;
  timerPill: ReactNode;
}) {
  const segFillFrac = Math.min(1, Math.max(0, (elapsedMs - currentIndex * intervalMs) / intervalMs));
  const fillPx = currentIndex * ROW_SLOT + segFillFrac * ROW_H;
  const trackOffsetPx = -Math.max(0, viewIdx - (VISIBLE_ROWS - 1)) * ROW_SLOT;
  const viewportHeight = VISIBLE_ROWS * ROW_H + (VISIBLE_ROWS - 1) * ROW_GAP;
  const totalTrackHeight = intervalCount * ROW_SLOT;

  return (
    <div className="px-5 pt-1 pb-4">
      <div className="flex justify-center mb-2">{timerPill}</div>
      <div
        className="relative overflow-hidden"
        style={{ height: viewportHeight }}
      >
        <motion.div
          className="absolute left-0 top-0 w-full flex gap-3"
          animate={{ y: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          {/* Current-time arrow — to the left of the bar, pointing right at
              it (the Schedule tab's own chevron, used as-is here since it
              already points the right way for a vertical list). */}
          <div className="relative shrink-0" style={{ width: 14 }}>
            <div className="absolute -translate-y-1/2 right-0" style={{ top: fillPx }} aria-hidden>
              <svg width="14" height="18" viewBox="0 0 16 20" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}>
                <path d={NOW_CHEVRON_PATH} fill="#2563eb" />
              </svg>
            </div>
          </div>
          <div
            className="relative shrink-0 rounded-full bg-stone-200 overflow-hidden"
            style={{ width: 10, height: totalTrackHeight }}
          >
            <div
              className="absolute inset-x-0 bg-blue-200 transition-[height]"
              style={{ top: 0, height: fillPx }}
              aria-hidden
            />
            {Array.from({ length: intervalCount - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 h-px bg-white"
                style={{ top: (i + 1) * ROW_SLOT }}
                aria-hidden
              />
            ))}
          </div>
          <div className="relative flex-1 min-w-0">
            {Array.from({ length: intervalCount }, (_, i) => {
              const status = statuses[i];
              const recency = recencyOf(i, viewIdx);
              const { bg, text, fade } = statusColors(status, recency);
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ top: i * ROW_SLOT, height: ROW_H }}
                >
                  <span
                    className={cn(
                      "shrink-0 grid place-items-center size-6 rounded-full font-display font-bold text-[11px] tabular-nums",
                      recency === "current" ? "border-2" : "border",
                      bg,
                      text,
                      fade,
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground tabular-nums">
                    {intervalRange(i, intervalMin)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <RowScoreButton
                      variant="negative"
                      label={negativeLabel}
                      selected={status === "incorrect"}
                      disabled={!sessionRunning}
                      onClick={() => onScore(i, "incorrect")}
                    />
                    <RowScoreButton
                      variant="positive"
                      label={positiveLabel}
                      selected={status === "correct"}
                      disabled={!sessionRunning}
                      onClick={() => onScore(i, "correct")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
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
      aria-label={isLeft ? "Previous interval" : "Next interval"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      // Vertically centered on the period-bubble row specifically (not the
      // full bubbles+bar+chevron height), so the arrows sit above the time
      // bar rather than straddling it.
      style={{ top: NAV_CENTER_PX }}
      className={cn(
        "absolute -translate-y-1/2 z-20 grid place-items-center size-12 shrink-0 aspect-square text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "-left-2" : "-right-2",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]" fill="currentColor" aria-hidden>
        {isLeft ? (
          <path d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z" strokeLinejoin="round" />
        ) : (
          <path d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z" strokeLinejoin="round" />
        )}
      </svg>
    </motion.button>
  );
}

function ScoreButton({
  variant,
  label,
  selected,
  disabled,
  onClick,
}: {
  variant: "positive" | "negative";
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isPositive = variant === "positive";
  const Icon = isPositive ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "btn-bevel flex-1 min-w-0 h-10 rounded-full border-2 flex items-center justify-center gap-1.5 px-2 transition-colors disabled:opacity-40",
        isPositive
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          (isPositive
            ? "bg-green-500 border-green-600 text-white hover:bg-green-500"
            : "bg-red-500 border-red-600 text-white hover:bg-red-500"),
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={3} />
      <span className="text-sm font-medium truncate">{label}</span>
    </button>
  );
}

function RowScoreButton({
  variant,
  label,
  selected,
  disabled,
  onClick,
}: {
  variant: "positive" | "negative";
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isPositive = variant === "positive";
  const Icon = isPositive ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40 shrink-0",
        isPositive
          ? "border-green-300 text-green-700 hover:bg-green-50"
          : "border-red-300 text-red-700 hover:bg-red-50",
        selected &&
          cn(
            "btn-bevel text-white",
            isPositive
              ? "bg-green-500 border-green-600 hover:bg-green-500"
              : "bg-red-500 border-red-600 hover:bg-red-500",
          ),
      )}
    >
      <Icon className="size-3" strokeWidth={3} />
      {label}
    </button>
  );
}
