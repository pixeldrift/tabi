import { useState, useEffect } from "react";
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

function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${s.toString().padStart(2, "0")}` : `${mm}:${s.toString().padStart(2, "0")}`;
}

// Bubble/badge coloring shared by the timeline's own numbers and the
// expanded view's per-row badges — gray until an interval has actually been
// scored, then the same green/red as its button. The current interval gets
// an outlined (not flat-gray) treatment while still unscored, so it reads
// as "this one's active" rather than just another blank slot.
function statusColors(status: IntervalStatus, isCurrent: boolean) {
  if (status === "correct") return { bg: "bg-green-50 border-green-300", text: "text-green-700" };
  if (status === "incorrect") return { bg: "bg-red-50 border-red-300", text: "text-red-700" };
  return isCurrent
    ? { bg: "bg-card border-foreground/30", text: "text-foreground" }
    : { bg: "bg-foreground/5 border-foreground/10", text: "text-foreground/40" };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  useEffect(() => {
    if (!sessionRunning) return;
    return subscribeTick((d) => setElapsed((e) => e + d));
  }, [sessionRunning, subscribeTick]);

  const currentStatus = statuses[currentIndex];
  const scoredCount = statuses.filter((s) => s !== null).length;
  const isComplete = scoredCount === displayIntervalCount;
  useReportCardStatus(cardKey, scoredCount > 0, isComplete);

  // Generalized to an arbitrary index (not just `currentIndex`) — the
  // expanded view lets any interval be scored or corrected directly,
  // mirroring Task Analysis's own expanded per-step editing.
  const score = (index: number, value: Exclude<IntervalStatus, null>) => {
    markDirty();
    setStatuses((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  };

  const measurementLabelOverride = {
    positive: `Mark ${positiveLabel} if`,
    negative: `Mark ${negativeLabel} if`,
  };

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
                score(currentIndex, "incorrect");
              }}
              disabled={!sessionRunning}
              aria-label={negativeLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                currentStatus === "incorrect"
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
                score(currentIndex, "correct");
              }}
              disabled={!sessionRunning}
              aria-label={positiveLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                currentStatus === "correct"
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
              {currentIndex + 1}
            </span>
            <span className={cn("font-display text-foreground/30", large ? "text-lg" : "text-sm")}>/</span>
            <span className={cn("font-display leading-none tabular-nums text-foreground/50", large ? "text-lg" : "text-sm")}>
              {displayIntervalCount}
            </span>
          </div>
          <span className={cn("text-muted-foreground tabular-nums", large ? "text-[11px]" : "text-[9px]")}>
            {intervalLabel(currentIndex, intervalMin)}
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
            <ListActionBadge value={currentIndex + 1} weight="regular" />
            <ListActionButton
              icon={X}
              variant="red"
              selected={currentStatus === "incorrect"}
              disabled={!sessionRunning}
              ariaLabel={negativeLabel}
              onClick={() => score(currentIndex, "incorrect")}
            />
            <ListActionButton
              icon={Check}
              variant="green"
              selected={currentStatus === "correct"}
              disabled={!sessionRunning}
              ariaLabel={positiveLabel}
              onClick={() => score(currentIndex, "correct")}
            />
          </div>
        }
      />
    );
  }

  return (
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
          elapsedMs={elapsed}
          sessionRunning={sessionRunning}
          positiveLabel={positiveLabel}
          negativeLabel={negativeLabel}
          onScore={score}
        />
      }
    >
      <div className="px-5 pt-2 pb-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold tabular-nums">{intervalLabel(currentIndex, intervalMin)}</div>
          <span
            aria-label="Locked to session time"
            title="Locked to session time"
            className="inline-flex items-center shrink-0 rounded-full border border-stone-300 bg-stone-100 pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-muted-foreground"
          >
            {formatCompactTime(elapsed)}
            <Link2 className="ml-1 size-3 rotate-45" strokeWidth={2.5} />
          </span>
        </div>

        <IntervalTimeline
          intervalCount={displayIntervalCount}
          elapsedMs={elapsed}
          intervalMs={intervalMs}
          currentIndex={currentIndex}
          statuses={statuses}
        />

        <div className="mt-2 flex items-center gap-3">
          <ScoreButton
            variant="negative"
            label={negativeLabel}
            selected={currentStatus === "incorrect"}
            disabled={!sessionRunning}
            onClick={() => score(currentIndex, "incorrect")}
          />
          <ScoreButton
            variant="positive"
            label={positiveLabel}
            selected={currentStatus === "correct"}
            disabled={!sessionRunning}
            onClick={() => score(currentIndex, "correct")}
          />
        </div>
      </div>
    </CardShell>
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
// scroll) to keep the current interval centered and fades its own edges,
// the same idiom as Percent Correct's own draggable trial-bubble strip.
const SEG_W = 64;
const BAR_H = 10;
const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 32 } as const;
const HORIZONTAL_FADE_MASK = {
  WebkitMaskImage: "linear-gradient(to right, transparent 0, black 12%, black 88%, transparent 100%)",
  maskImage: "linear-gradient(to right, transparent 0, black 12%, black 88%, transparent 100%)",
} as const;

function IntervalTimeline({
  intervalCount,
  elapsedMs,
  intervalMs,
  currentIndex,
  statuses,
}: {
  intervalCount: number;
  elapsedMs: number;
  intervalMs: number;
  currentIndex: number;
  statuses: IntervalStatus[];
}) {
  const BUBBLE = 20;
  const BUBBLE_CURRENT = 34;
  // Every interval before `currentIndex` is fully elapsed; `currentIndex`
  // itself is partially filled; nothing after it is filled at all — a
  // single continuous fill width follows directly from that, rather than a
  // percentage of some fixed (and, for an open-ended card, nonexistent)
  // total duration.
  const segFillFrac = Math.min(1, Math.max(0, (elapsedMs - currentIndex * intervalMs) / intervalMs));
  const fillPx = currentIndex * SEG_W + segFillFrac * SEG_W;
  const trackOffsetPx = -(currentIndex * SEG_W + SEG_W / 2);

  return (
    <div className="pt-1">
      {/* Period bubbles — parked in place above their own segment (not a
          draggable/swipeable strip like Percent Correct's trial bubbles),
          same "current is biggest" idiom, gray until scored then colored
          to match the button that scored it. */}
      <div className="relative overflow-hidden" style={{ height: BUBBLE_CURRENT, ...HORIZONTAL_FADE_MASK }}>
        <motion.div
          className="absolute left-1/2 top-0"
          style={{ height: BUBBLE_CURRENT }}
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          {Array.from({ length: intervalCount }, (_, i) => {
            const isCurrent = i === currentIndex;
            const { bg, text } = statusColors(statuses[i], isCurrent);
            const size = isCurrent ? BUBBLE_CURRENT : BUBBLE;
            return (
              <div key={i} className="absolute bottom-0 -translate-x-1/2" style={{ left: i * SEG_W + SEG_W / 2 }}>
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center font-display font-bold tabular-nums transition-all duration-200",
                    isCurrent ? "border-2" : "border",
                    bg,
                    text,
                  )}
                  style={{ width: size, height: size, fontSize: isCurrent ? 15 : 10 }}
                >
                  {i + 1}
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
      {/* The single combined progress indicator: the gray track fills light
          blue as the session clock advances, and the chevron below marks
          exactly how far the fill has reached — no separate "percent
          scored" bar duplicating this one. */}
      <div
        className="relative overflow-hidden rounded-full bg-stone-200 mt-0.5"
        style={{ height: BAR_H, ...HORIZONTAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div
            className="absolute bg-blue-200 transition-[width]"
            style={{ top: 0, left: 0, height: BAR_H, width: fillPx }}
            aria-hidden
          />
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
      <div className="relative overflow-hidden h-4" style={HORIZONTAL_FADE_MASK} aria-hidden>
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div className="absolute top-0 -translate-x-1/2" style={{ left: fillPx }}>
            <svg
              width="14"
              height="18"
              viewBox="0 0 16 20"
              style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
            >
              <path d={NOW_CHEVRON_PATH} fill="#2563eb" />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const ROW_H = 28; // matches h-7 row buttons
const ROW_GAP = 6; // matches space-y-1.5
const ROW_SLOT = ROW_H + ROW_GAP;
const VISIBLE_ROWS = 4; // how many intervals fit in the scrollable viewport at once
const VERTICAL_FADE_MASK = {
  WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%)",
  maskImage: "linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%)",
} as const;

/** Twirl-down alternative to the standard view's horizontal timeline — same
 *  progress fill and "now" indicator, just running vertically alongside a
 *  list of every interval, each with its own working score buttons (not
 *  gated to only the current one), mirroring Task Analysis's own expanded
 *  per-step editing. Only `VISIBLE_ROWS` show at once, auto-scrolled
 *  (spring transform) to keep the current interval in view and fading its
 *  own top/bottom edges — same idiom as the standard view's own horizontal
 *  strip, just running the other way. */
function TimestampExpandedView({
  intervalCount,
  intervalMin,
  intervalMs,
  statuses,
  currentIndex,
  elapsedMs,
  sessionRunning,
  positiveLabel,
  negativeLabel,
  onScore,
}: {
  intervalCount: number;
  intervalMin: number;
  intervalMs: number;
  statuses: IntervalStatus[];
  currentIndex: number;
  elapsedMs: number;
  sessionRunning: boolean;
  positiveLabel: string;
  negativeLabel: string;
  onScore: (index: number, value: Exclude<IntervalStatus, null>) => void;
}) {
  const segFillFrac = Math.min(1, Math.max(0, (elapsedMs - currentIndex * intervalMs) / intervalMs));
  const fillPx = currentIndex * ROW_SLOT + segFillFrac * ROW_H;
  const trackOffsetPx = -(currentIndex * ROW_SLOT + ROW_H / 2);
  const viewportHeight = VISIBLE_ROWS * ROW_H + (VISIBLE_ROWS - 1) * ROW_GAP;
  const totalTrackHeight = intervalCount * ROW_SLOT;

  return (
    <div className="px-5 pt-1 pb-4">
      <div
        className="relative overflow-hidden"
        style={{ height: viewportHeight, ...VERTICAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-0 top-1/2 w-full flex gap-3"
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
              const isCurrent = i === currentIndex;
              const { bg, text } = statusColors(status, isCurrent);
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ top: i * ROW_SLOT, height: ROW_H }}
                >
                  <span
                    className={cn(
                      "shrink-0 grid place-items-center size-6 rounded-full font-display font-bold text-[11px] tabular-nums",
                      isCurrent ? "border-2" : "border",
                      bg,
                      text,
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
