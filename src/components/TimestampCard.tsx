import { useEffect } from "react";
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
  /** Total number of intervals across the whole observation window. */
  intervalCount: number;
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

export function intervalLabel(index: number, intervalMin: number): string {
  const start = index * intervalMin;
  const end = (index + 1) * intervalMin;
  const hourMode = end > 60;
  return `${formatBoundary(start, hourMode)}-${formatBoundary(end, hourMode)}`;
}

function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${s.toString().padStart(2, "0")}` : `${mm}:${s.toString().padStart(2, "0")}`;
}

export function TimestampCard({
  id,
  title,
  phase = "Intervention",
  description,
  intervalMin,
  intervalCount,
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
  const [statuses, setStatuses] = useCardState<IntervalStatus[]>(cardKey, "statuses", () =>
    Array(intervalCount).fill(null),
  );
  // Session-linked elapsed time — always ticking with the session (no local
  // play/pause of its own, unlike Rate/Duration's unlocked mode) so "which
  // interval is current" is a pure function of session time, not something
  // a user can navigate ahead of or pause independently.
  const [elapsed, setElapsed] = useCardState(cardKey, "elapsed", 0); // ms
  const { sessionRunning, subscribeTick } = useSession();
  const { markDirty, resetSignal } = useCardSession();

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setStatuses(Array(intervalCount).fill(null));
    setElapsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  useEffect(() => {
    if (!sessionRunning) return;
    return subscribeTick((d) => setElapsed((e) => e + d));
  }, [sessionRunning, subscribeTick]);

  const intervalMs = intervalMin * 60 * 1000;
  const totalMs = intervalCount * intervalMs;
  const currentIndex = Math.min(intervalCount - 1, Math.floor(elapsed / intervalMs));
  const currentStatus = statuses[currentIndex];
  const scoredCount = statuses.filter((s) => s !== null).length;
  const isComplete = scoredCount === intervalCount;
  useReportCardStatus(cardKey, scoredCount > 0, isComplete);
  const progress = (scoredCount / intervalCount) * 100;

  const score = (value: Exclude<IntervalStatus, null>) => {
    markDirty();
    setStatuses((prev) => {
      const next = [...prev];
      next[currentIndex] = next[currentIndex] === value ? null : value;
      return next;
    });
  };

  const details = (
    <>
      <DrawerQuickFacts
        icon={<TimestampIcon />}
        dataTypeLabel="Timestamp"
        phase={phase}
        stats={[
          { label: "Interval", value: `${intervalMin}m` },
          { label: "Scored", value: `${scoredCount} / ${intervalCount}` },
        ]}
      />
      {teachingProcedure && (
        <div className="mt-4">
          <TeachingProcedureAccordion data={teachingProcedure} kind="timestamp" />
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
        progress={progress}
        isComplete={isComplete}
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2.5" : "gap-1.5")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                score("incorrect");
              }}
              disabled={!sessionRunning}
              aria-label="Incorrect"
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
                score("correct");
              }}
              disabled={!sessionRunning}
              aria-label="Correct"
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
              {intervalCount}
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
        progress={progress}
        isComplete={isComplete}
        actions={
          <div className="flex items-center gap-1">
            <ListActionBadge value={currentIndex + 1} weight="regular" />
            <ListActionButton
              icon={X}
              variant="red"
              selected={currentStatus === "incorrect"}
              disabled={!sessionRunning}
              ariaLabel="Incorrect"
              onClick={() => score("incorrect")}
            />
            <ListActionButton
              icon={Check}
              variant="green"
              selected={currentStatus === "correct"}
              disabled={!sessionRunning}
              ariaLabel="Correct"
              onClick={() => score("correct")}
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
      progress={progress}
      isComplete={isComplete}
      details={details}
    >
      <div className="px-5 pt-2 pb-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Interval {currentIndex + 1} of {intervalCount}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {intervalLabel(currentIndex, intervalMin)}
            </div>
          </div>
          <span
            aria-label="Locked to session time"
            title="Locked to session time"
            className="inline-flex items-center shrink-0 rounded-full border border-stone-300 bg-stone-100 pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-muted-foreground"
          >
            {formatCompactTime(elapsed)}
            <Link2 className="ml-1 size-3 rotate-45" strokeWidth={2.5} />
          </span>
        </div>

        <IntervalTimeline intervalCount={intervalCount} elapsedMs={elapsed} totalMs={totalMs} currentIndex={currentIndex} />

        <div className="mt-1 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => score("incorrect")}
            disabled={!sessionRunning}
            aria-label="Incorrect"
            className={cn(
              "btn-bevel size-14 shrink-0 aspect-square rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
              currentStatus === "incorrect"
                ? "bg-red-400 border-red-500 text-white"
                : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
            )}
          >
            <X className="size-6" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => score("correct")}
            disabled={!sessionRunning}
            aria-label="Correct"
            className={cn(
              "btn-bevel size-14 shrink-0 aspect-square rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
              currentStatus === "correct"
                ? "bg-green-400 border-green-500 text-white"
                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
            )}
          >
            <Check className="size-6" strokeWidth={3} />
          </button>
        </div>
      </div>
    </CardShell>
  );
}

// The "now" chevron is the Schedule tab's own arrow (see ScheduleView.tsx),
// which points RIGHT to cross a vertical list from its left edge — rotated
// -90° here so it instead points UP, crossing this horizontal bar from
// underneath it.
const NOW_CHEVRON_PATH = "M3 2 Q1 2 1 4 V16 Q1 18 3 18 L13 11.5 Q15 10 13 8.5 Z";

function IntervalTimeline({
  intervalCount,
  elapsedMs,
  totalMs,
  currentIndex,
}: {
  intervalCount: number;
  elapsedMs: number;
  totalMs: number;
  currentIndex: number;
}) {
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;
  return (
    <div className="pt-2">
      <div className="relative flex text-center">
        {Array.from({ length: intervalCount }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-[10px] tabular-nums",
              i === currentIndex ? "font-bold text-blue-600" : "font-semibold text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className="relative h-2.5 rounded-full bg-stone-200 overflow-hidden mt-0.5">
        <div
          className="absolute inset-y-0 left-0 bg-blue-200 transition-[width]"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        {Array.from({ length: intervalCount - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-px bg-white"
            style={{ left: `${((i + 1) / intervalCount) * 100}%` }}
            aria-hidden
          />
        ))}
      </div>
      <div className="relative h-4" aria-hidden>
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${pct}%` }}
        >
          <svg
            width="14"
            height="18"
            viewBox="0 0 16 20"
            style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
          >
            <path d={NOW_CHEVRON_PATH} fill="#2563eb" />
          </svg>
        </div>
      </div>
    </div>
  );
}
