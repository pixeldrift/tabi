import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Stamp, ChevronLeft, ChevronRight } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { ListActionBadge, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { TimeOfDayKeypad, formatTimeOfDaySecondsForDisplay } from "./TimeOfDayKeypad";
import { useSettings } from "./SettingsContext";
import { cn } from "@/lib/utils";

export interface TimestampCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
}

// 24h "HH:MM:SS" — the keypad's own withSeconds value shape.
function to24hs(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// The clock display — pill, side bubble focus, list/tile pill, and the
// expanded view's own time+date rows — reads as the app's compact "10:00a"
// convention (with seconds) by default, or plain 24h "HH:MM:SS" when the
// Settings 24-hour toggle is on, same as every other on-screen clock (see
// formatTimeOfDaySecondsForDisplay).
function formatClockTime(ms: number, use24Hour: boolean): string {
  return formatTimeOfDaySecondsForDisplay(to24hs(ms), use24Hour);
}

// Grid-tile-only variant — drops the trailing a/p letter formatClockTime's
// 12-hour convention appends, freeing enough width for the tile's own pill
// to also hold a trailing log button (mirroring DurationCard's tile pill)
// without growing past the tile's own compact width. Loses the AM/PM
// distinction, an accepted tradeoff at this size — the full-size pill
// (TimestampCenterPill) keeps it.
function formatTileClockTime(ms: number, use24Hour: boolean): string {
  const full = formatClockTime(ms, use24Hour);
  return /[ap]$/.test(full) ? full.slice(0, -1) : full;
}

function formatStampDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Replaces an existing stamp's hour/minute/second (via the keypad's 24h
// "HH:MM:SS" commit value), keeping that entry's original date — editing a
// stamp's time was never meant to also silently move it to a different day.
function applyTimeOfDaySeconds(ms: number, hhmmss: string): number {
  const [h, m, s] = hhmmss.split(":").map((v) => parseInt(v, 10));
  const d = new Date(ms);
  d.setHours(h, m, s, 0);
  return d.getTime();
}

/** Everything the bookmark bar's Timestamp chip needs — reads the same
 *  `entries` slot the real card does (kept live across both readers by the
 *  store's own useSyncExternalStore subscription, same idiom every other
 *  kind's own useXChip hook already relies on) and logs through the exact
 *  same "push now onto the array" action, without needing the real card
 *  mounted anywhere. */
export function useTimestampChip(cardId: string) {
  const [entries, setEntries] = useCardState<number[]>(cardId, "entries", () => []);
  const { markDirty, canRecordData } = useCardSession();
  const logNow = () => {
    if (!canRecordData) return;
    markDirty();
    setEntries((prev) => [...prev, Date.now()]);
  };
  return { count: entries.length, logNow, canRecordData };
}

const FLASH_DURATION_MS = 500;
// How long the flash/scale-hop plays alone before the new entry actually
// commits and the track slides — long enough to clearly register as its
// own beat, short enough that logging still feels immediate overall.
const LOG_COMMIT_DELAY_MS = 220;
// Same track geometry DurationCard's own instance carousel uses (see its
// CenterPill/SideBubble/TriangleNav) — the focused item grows to this size,
// every other item shrinks to a small numbered bubble, and the whole track
// slides so the focused one stays centered. Same CENTER_W/CENTER_H as
// Duration's own pill (badge + time + a trailing w-12 action button).
const BUBBLE = 22;
const CENTER_W = 210;
const CENTER_H = 52;
const GAP = 8;
const STEP_WIDTH = BUBBLE + GAP;

export function TimestampCard({
  id,
  title,
  phase = "Intervention",
  description,
  isActive = true,
  onActivate,
  onExpandToStandard,
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
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: TimestampCardProps) {
  const cardKey = id ?? title;
  const { use24HourTime } = useSettings();
  const [entries, setEntries] = useCardState<number[]>(cardKey, "entries", () => []);
  const [viewIdx, setViewIdx] = useCardState(cardKey, "viewIdx", 0);
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal, canRecordData } = useCardSession();

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setEntries([]);
    setViewIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // A live wall-clock "now" — ticks every real second regardless of the
  // session's own running state, since this card stamps genuine real-world
  // moments (a literal date/time), not session-elapsed time like every
  // other timed card in this app.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Same "snap to solid color, then ease back" mechanism FrequencyCard's own
  // tally uses (see its own comment) — flash disables the CSS transition so
  // the color/border change is instant on tap, then re-enables it once flash
  // clears so the fade-back is a smooth ease rather than an instant snap.
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);
  // Delays committing a fresh log entry (see logNow below) just long enough
  // for the flash/scale-hop to actually register before the track slides
  // away from under it.
  const logCommitTimeoutRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
      if (logCommitTimeoutRef.current !== null) window.clearTimeout(logCommitTimeoutRef.current);
    },
    [],
  );

  // The track always has one more slot than logged entries — the last one
  // is never a real entry, it's the live, ticking "now" position. Logging
  // doesn't advance into that slot; it fills the current one and a fresh
  // live slot opens up after it, the same "using the last slot opens a new
  // blank one" idea DurationCard's own instances array already uses.
  const trackCount = entries.length + 1;
  const liveIndex = entries.length;

  const goTo = (idx: number) => {
    setViewIdx(Math.max(0, Math.min(trackCount - 1, idx)));
  };

  const logNow = () => {
    if (!canRecordData) return;
    markDirty();
    const ts = Date.now();

    setFlash(true);
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(false), FLASH_DURATION_MS);

    // Committing the new entry (which is what actually moves the track —
    // trackOffset depends on viewIdx, and viewIdx moves the instant this
    // fires) waits a beat behind the flash — otherwise both start in the
    // very same commit, and the color/scale "this got recorded" pulse and
    // the slide-away happen simultaneously instead of the pulse actually
    // registering first.
    if (logCommitTimeoutRef.current !== null) window.clearTimeout(logCommitTimeoutRef.current);
    logCommitTimeoutRef.current = window.setTimeout(() => {
      setEntries((prev) => {
        const next = [...prev, ts];
        // Keep viewing "live" — the just-logged entry now sits one slot
        // behind it, shrinking into its new bubble as the track's own
        // grow/shrink + slide transitions play.
        setViewIdx(next.length);
        return next;
      });
    }, LOG_COMMIT_DELAY_MS);
  };

  const updateEntryTime = (idx: number, next24hs: string) => {
    setEntries((prev) => prev.map((v, j) => (j === idx ? applyTimeOfDaySeconds(v, next24hs) : v)));
  };

  const addToEntryTime = (idx: number, deltaMs: number) => {
    setEntries((prev) => prev.map((v, j) => (j === idx ? v + deltaMs : v)));
  };

  const hasData = entries.length > 0;
  useReportCardStatus(cardKey, hasData, hasData, {
    title,
    kind: "timestamp",
    value: String(entries.length),
    unit: entries.length === 1 ? "Entry" : "Entries",
  });

  const trackOffset = -(viewIdx * STEP_WIDTH + CENTER_W / 2);
  const dragX = useMotionValue(0);
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const finalOffset = trackOffset + info.offset.x;
    const targetIdx = Math.round(-(finalOffset + CENTER_W / 2) / STEP_WIDTH);
    goTo(targetIdx);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
  };

  const details = (
    <>
      <DrawerQuickFacts
        icon={<Stamp className="size-4" />}
        kind="timestamp"
        dataTypeLabel="Timestamp"
        phase={phase}
        stats={[{ label: "Entries", value: entries.length }]}
      />
      {(teachingProcedure || description) && (
        <div className="mt-4">
          <TeachingProcedureAccordion
            description={description}
            data={teachingProcedure}
            kind="timestamp"
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
        density={tileDensity}
        isActive={isActive}
        onActivate={onActivate}
        onExpandToStandard={onExpandToStandard}
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
        details={details}
        // Same treatment as DurationCard's own "Instance N of M" — this
        // kind has no real action buttons either (Log Now already lives in
        // the pill), so this status text stands in for the actions row,
        // fixed to Frequency/Rate's own actions-row height (their real
        // size-[42px]/size-7 buttons) with this shorter text centered
        // inside it. Without that height match, this column had MORE
        // leftover space above it than Frequency/Rate get, centering zone 3
        // (and the pill inside it) further down the tile than theirs —
        // exactly the bug DurationCard's own fix (see its comment) already
        // covers. "Current time" on the live slot, "Entry X of Y" while
        // browsing a past stamp, "No entries yet" before the first one.
        actions={
          <div className={cn("flex items-center justify-center", large ? "h-[42px]" : "h-7")}>
            {/* uppercase tracking-wide — same plain metadata convention
                every other kind's own tile status text uses (Duration's
                "Instance N of M", Task Analysis's "Step X of Y"); this one
                had fallen out of step with plain sentence case. */}
            <span
              className={cn(
                "uppercase tracking-wide text-muted-foreground text-center truncate max-w-full",
                large ? "text-[11px]" : "text-[9px]",
              )}
            >
              {viewIdx < entries.length ? (
                <>
                  Entry{" "}
                  <span
                    className={cn(
                      "font-bold normal-case tracking-normal tabular-nums text-foreground",
                      large ? "text-sm" : "text-xs",
                    )}
                  >
                    {viewIdx + 1}
                  </span>{" "}
                  of{" "}
                  <span
                    className={cn(
                      "font-bold normal-case tracking-normal tabular-nums text-foreground",
                      large ? "text-sm" : "text-xs",
                    )}
                  >
                    {entries.length}
                  </span>
                </>
              ) : hasData ? (
                "Current time"
              ) : (
                "No entries yet"
              )}
            </span>
          </div>
        }
      >
        {/* MiniTileShell's zone-3 box centers `children` with plain
            `flex items-center justify-center` (row direction, no
            `flex-col`) — passing the dots row and the pill as two separate
            top-level children here left them side by side instead of
            stacked (the pill landing visually "inside" the dots row rather
            than below it). Same fix as DurationCard's own dots+pill wrapper:
            one flex-col div holding both. */}
        <div className="w-full flex flex-col items-center gap-1">
          {/* Dots (+ large-density nav arrows) sit above the pill now, not
              below it — the pill itself now actually tracks viewIdx (it
              used to just always show the live clock regardless of which
              dot was selected, so navigating never visibly did anything to
              it). */}
          {entries.length > 0 && (
            <div className="relative w-full flex items-center justify-center">
              {large && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(viewIdx - 1);
                    }}
                    disabled={viewIdx <= 0}
                    aria-label="Previous entry"
                    className="absolute -left-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="size-[18px]" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(viewIdx + 1);
                    }}
                    disabled={viewIdx >= trackCount - 1}
                    aria-label="Next entry"
                    className="absolute -right-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
                  >
                    <ChevronRight className="size-[18px]" strokeWidth={2.5} />
                  </button>
                </>
              )}
              <SwipeStrip
                count={trackCount}
                current={viewIdx}
                onCurrentChange={goTo}
                variant="centered"
                gapClassName={large ? "gap-2" : "gap-1.5"}
                itemWrapperClassName="flex items-center justify-center"
              >
                {(i) => {
                  const isCurrent = i === viewIdx;
                  const isLive = i === liveIndex;
                  return (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        goTo(i);
                      }}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        isCurrent
                          ? cn(
                              large ? "size-2" : "size-1.5",
                              isLive ? "bg-blue-500" : "bg-stone-400",
                            )
                          : cn(
                              large ? "size-1.5" : "size-1",
                              isLive ? "bg-blue-200" : "bg-stone-200",
                            ),
                      )}
                      aria-hidden
                    />
                  );
                }}
              </SwipeStrip>
            </div>
          )}

          {/* Same shape as DurationCard's own tile pill — time on the left,
            a trailing solid log button standing in for play/pause — rather
            than the old badge-left/text-right row. large density matches
            Duration's own pill exactly (h-10, text-lg, w-10 button) rather
            than a smaller size of its own, so the two read as the same
            kind of control at a glance. Drops the am/pm letter
            (formatTileClockTime) to keep the row narrow enough at this
            size — the full-size pill keeps it. Wrapped in its own
            SwipeStrip (same "paged" pattern as Duration's own pill) so the
            whole pill is a swipe target, not just the tiny dots above it —
            each page renders its OWN index's content (`i`, not `viewIdx`),
            since SwipeStrip pre-renders every page for a smooth swipe. */}
          <SwipeStrip
            count={trackCount}
            current={viewIdx}
            onCurrentChange={goTo}
            variant="paged"
            className="w-full"
            itemWrapperClassName="w-full flex items-center justify-center"
          >
            {(i) => {
              const isLivePage = i === liveIndex;
              return (
                <div
                  className={cn(
                    "flex items-stretch rounded-full overflow-hidden border-2 bg-white transition-colors",
                    large ? "h-10" : "h-7",
                    flash && isLivePage ? "border-blue-400" : "border-border",
                  )}
                  style={{
                    transition: flash && isLivePage ? "none" : "border-color 700ms ease-out",
                  }}
                >
                  <div className={cn("flex-1 grid place-items-center", large ? "px-3" : "px-2")}>
                    {isLivePage ? (
                      <motion.span
                        // Scales DOWN on log, not up — reads as the time
                        // itself getting pressed into the page, matching a
                        // real button press, rather than popping outward.
                        // Same direction/magnitude everywhere this flash
                        // hop appears (see TimestampCenterPill's own copy).
                        animate={{ scale: flash ? 0.88 : 1 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                        className={cn(
                          // text-size has to come before leading-none, not
                          // after — tailwind-merge treats an arbitrary (and,
                          // per its own config, even a named) text-size
                          // class as conflicting with leading-none and keeps
                          // whichever is LAST, so leading-none listed first
                          // was silently dropped from the rendered class
                          // list at BOTH densities (see Frequency/Rate/
                          // IntervalCard's own fix for the same bug) —
                          // harmless at large density's own bigger pill, but
                          // the resulting default line-height's extra
                          // padding visibly pushed the small pill's own
                          // shorter text off center.
                          "font-display tabular-nums",
                          large ? "text-lg" : "text-[11px]",
                          "leading-none",
                          flash ? "text-blue-600" : "text-stone-400",
                        )}
                      >
                        {formatTileClockTime(now, use24HourTime)}
                      </motion.span>
                    ) : (
                      <TimeOfDayKeypad
                        value={to24hs(entries[i])}
                        onChange={(next) => updateEntryTime(i, next)}
                        onAdd={(delta) => addToEntryTime(i, delta)}
                        withSeconds
                      >
                        {({ open }) => (
                          <button
                            type="button"
                            // No stopPropagation — editing this entry's time
                            // is a real interaction with it, same as the
                            // standard view's own identical button; tapping
                            // it on a not-yet-active tile should select the
                            // tile in the same tap.
                            onClick={open}
                            disabled={!canRecordData}
                            aria-label={`Edit time for entry ${i + 1}`}
                            className={cn(
                              // Same leading-none-vs-text-size ordering fix
                              // as the live clock span above.
                              "font-display tabular-nums text-foreground transition-colors hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed",
                              large ? "text-lg" : "text-[11px]",
                              "leading-none",
                            )}
                          >
                            {formatTileClockTime(entries[i], use24HourTime)}
                          </button>
                        )}
                      </TimeOfDayKeypad>
                    )}
                  </div>
                  <button
                    type="button"
                    // No stopPropagation — logging is this tile's own
                    // primary data-entry action, same as the standard
                    // view's own identical button.
                    onClick={logNow}
                    disabled={!canRecordData}
                    aria-label="Log timestamp now"
                    // active:scale-100: cancels the global button:active
                    // fallback (styles.css) — that scale shrinks this
                    // button's own rectangle away from the pill's
                    // rounded-full overflow-hidden clip on press, revealing
                    // white background around it, same bug already fixed
                    // for the session timer's own mini pause button (see
                    // StatusBar.tsx). Scale instead lives on the
                    // icon-wrapping span below.
                    className={cn(
                      "grid shrink-0 place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 active:scale-100 disabled:opacity-40",
                      large ? "w-10" : "w-7",
                    )}
                  >
                    <span className="grid place-items-center active:scale-95 transition-transform">
                      <Stamp className={large ? "size-[17px]" : "size-3.5"} />
                    </span>
                  </button>
                </div>
              );
            }}
          </SwipeStrip>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    const viewingLive = viewIdx === liveIndex;
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<Stamp className="size-4" />}
        kind="timestamp"
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
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        progress={null}
        isComplete={hasData}
        actions={
          // Instance badge + running clock travel together, same pattern as
          // Duration's own list row — the actual time (editable, or ticking
          // live) matters more here than a plain entry count.
          <ListActionSlide actionKey={viewIdx}>
            <ListActionBadge value={viewIdx + 1} />
            <div
              className={cn(
                "flex items-stretch h-7 rounded-full overflow-hidden border-2 bg-white transition-colors",
                viewingLive ? "border-border" : "border-blue-200",
              )}
            >
              {viewingLive ? (
                // Same flash-driven scale-down + color-snap every other
                // "current time" display in this file plays on log (see
                // TimestampCenterPill's own identical treatment) — this list
                // row's own value used to just sit there through a log with
                // nothing to show for it.
                <motion.span
                  animate={{ scale: flash ? 0.88 : 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                  className={cn(
                    "flex items-center justify-center px-1.5 text-[12px] font-bold tabular-nums min-w-[5.5rem]",
                    flash ? "text-blue-600" : "text-stone-400",
                  )}
                >
                  {formatClockTime(now, use24HourTime)}
                </motion.span>
              ) : (
                <TimeOfDayKeypad
                  value={to24hs(entries[viewIdx])}
                  onChange={(next) => updateEntryTime(viewIdx, next)}
                  onAdd={(delta) => addToEntryTime(viewIdx, delta)}
                  withSeconds
                >
                  {({ open }) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open();
                      }}
                      disabled={!canRecordData}
                      aria-label={`Edit time for entry ${viewIdx + 1}`}
                      className="flex items-center justify-center px-1.5 text-[12px] font-bold tabular-nums min-w-[5.5rem] cursor-text disabled:cursor-not-allowed"
                    >
                      {formatClockTime(entries[viewIdx], use24HourTime)}
                    </button>
                  )}
                </TimeOfDayKeypad>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  logNow();
                }}
                disabled={!canRecordData}
                aria-label="Log now"
                // active:scale-100: see the tile-mode version of this same
                // button for why (cancels the global button:active
                // fallback, which would otherwise shrink this button away
                // from the pill's own clip and reveal white around it).
                className="grid place-items-center w-7 text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 active:scale-100 disabled:opacity-40"
              >
                <span className="grid place-items-center active:scale-95 transition-transform">
                  <Stamp className="size-3" />
                </span>
              </button>
            </div>
          </ListActionSlide>
        }
      />
    );
  }

  return (
    <div className="w-full max-w-md scroll-mt-32">
      <CardShell
        title={title}
        phase={phase}
        dataType="Timestamp"
        dataTypeIcon={<Stamp className="size-4" />}
        kind="timestamp"
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
        progress={null}
        isComplete={hasData}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((v) => !v)}
        helperText={
          <span>
            Logged{" "}
            <span className="font-semibold normal-case tracking-normal tabular-nums text-foreground">
              {entries.length}
            </span>
          </span>
        }
        details={details}
        expandedView={
          <ol className="px-3 pt-2 pb-3 space-y-1">
            {entries.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground text-center">
                No entries logged yet.
              </li>
            )}
            {entries.map((ts, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
                  {i + 1}
                </span>
                <TimeOfDayKeypad
                  value={to24hs(ts)}
                  onChange={(next) => updateEntryTime(i, next)}
                  onAdd={(delta) => addToEntryTime(i, delta)}
                  withSeconds
                >
                  {({ open }) => (
                    <button
                      type="button"
                      // No stopPropagation — editing an entry's time is a
                      // real interaction with this card, and tapping it on
                      // a not-yet-active card should select the card too.
                      onClick={() => open()}
                      disabled={!canRecordData}
                      aria-label={`Edit time for entry ${i + 1}`}
                      className="flex-1 text-left tabular-nums text-sm text-foreground/80 transition-colors hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-foreground/80"
                    >
                      {formatClockTime(ts, use24HourTime)}
                    </button>
                  )}
                </TimeOfDayKeypad>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatStampDate(ts)}
                </span>
              </li>
            ))}
            {/* The live pill's own expanded-view counterpart — always the
                last line, ticking, with the log button right beside it
                rather than as a separate full-width bar below the list. */}
            <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 mt-1 border-t border-dashed border-border pt-2.5">
              <span className="grid place-items-center size-6 rounded-full bg-stone-300 text-[11px] font-medium text-white shrink-0">
                {liveIndex + 1}
              </span>
              <span className="flex-1 tabular-nums text-sm font-semibold text-stone-400">
                {formatClockTime(now, use24HourTime)}
              </span>
              <button
                type="button"
                onClick={logNow}
                disabled={!canRecordData}
                className="btn-bevel shrink-0 inline-flex items-center gap-1.5 rounded-full h-7 px-2.5 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-medium transition-colors active:scale-95 disabled:opacity-40"
              >
                <Stamp className="size-3" />
                Log Timestamp Now
              </button>
            </li>
          </ol>
        }
      >
        <div className="relative px-2 pt-2 pb-4">
          <div className="flex justify-center">
            <span
              style={{ transition: flash ? "none" : "color 700ms ease-out" }}
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                flash ? "text-blue-600" : "text-muted-foreground",
              )}
            >
              {formatStampDate(now)}
            </span>
          </div>

          <div className="relative h-[68px] mt-1">
            <TriangleNav
              direction="left"
              onClick={() => goTo(viewIdx - 1)}
              onDoubleClick={() => goTo(0)}
              disabled={viewIdx <= 0}
            />
            <TriangleNav
              direction="right"
              onClick={() => goTo(viewIdx + 1)}
              onDoubleClick={() => goTo(trackCount - 1)}
              disabled={viewIdx >= trackCount - 1}
            />

            <div
              className="relative h-full overflow-hidden"
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
                dragConstraints={{ left: -((trackCount - 1) * STEP_WIDTH) - 200, right: 200 }}
                dragElastic={0.08}
                onDragEnd={handleDragEnd}
              >
                {Array.from({ length: trackCount }, (_, i) => {
                  const isCenter = i === viewIdx;
                  const isLive = i === liveIndex;
                  return (
                    <motion.div
                      key={i}
                      className="relative shrink-0 grid place-items-center select-none"
                      animate={{
                        width: isCenter ? CENTER_W : BUBBLE,
                        height: isCenter ? CENTER_H : BUBBLE,
                      }}
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    >
                      {isCenter ? (
                        <TimestampCenterPill
                          index={i}
                          isLive={isLive}
                          ms={isLive ? null : entries[i]}
                          now={now}
                          disabled={!canRecordData}
                          onEditTime={(next) => updateEntryTime(i, next)}
                          onAddTime={(delta) => addToEntryTime(i, delta)}
                          onLog={logNow}
                          flash={flash}
                        />
                      ) : (
                        <TimestampSideBubble
                          index={i}
                          isLive={isLive}
                          justLogged={flash && i === entries.length - 1}
                          onClick={() => goTo(i)}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center h-4">
            {viewIdx < entries.length ? (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">
                Entry{" "}
                <span className="font-semibold normal-case tracking-normal tabular-nums text-foreground">
                  {viewIdx + 1}
                </span>{" "}
                of{" "}
                <span className="font-semibold normal-case tracking-normal tabular-nums text-foreground">
                  {entries.length}
                </span>
              </span>
            ) : hasData ? (
              // Color-flash only, matching its own "Entry X of Y"/"No
              // entries yet" siblings — the scale hop belongs on the actual
              // time digits (see TimestampCenterPill's own comment), not on
              // this status text about them. This used to carry the same
              // scale animation, which put the visible "press" feedback on
              // the metadata label instead of the value it's describing.
              <span
                style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                className={cn(
                  "text-[11px] uppercase tracking-wider",
                  flash ? "text-blue-600" : "text-muted-foreground",
                )}
              >
                Current time
              </span>
            ) : (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                No entries yet
              </span>
            )}
          </div>
        </div>
      </CardShell>
    </div>
  );
}

function TimestampCenterPill({
  index,
  isLive,
  ms,
  now,
  disabled,
  onEditTime,
  onAddTime,
  onLog,
  flash,
}: {
  index: number;
  isLive: boolean;
  ms: number | null;
  now: number;
  disabled?: boolean;
  onEditTime: (next24hs: string) => void;
  onAddTime: (deltaMs: number) => void;
  onLog: () => void;
  flash: boolean;
}) {
  const { use24HourTime } = useSettings();
  const displayMs = isLive ? now : (ms as number);
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-stretch rounded-full overflow-hidden border-2 bg-white transition-colors",
        flash && isLive ? "border-blue-400" : "border-border",
      )}
      style={{ transition: flash && isLive ? "none" : "border-color 700ms ease-out" }}
    >
      {/* Badge pinned to the pill's own left edge (pl-2/pr-2 on this flex
          row) with the time centered in the remaining space on its own —
          same layout DurationCard's own CenterPill uses — rather than
          centering badge+time together as one block, which let the badge
          drift off the left edge once a trailing button took up room on
          the right. */}
      <div className="flex-1 flex items-center gap-2 pl-2 pr-2">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-white text-xs font-semibold tabular-nums transition-colors",
            isLive ? "bg-blue-500" : "bg-stone-300",
          )}
        >
          {index + 1}
        </span>
        <div className="flex-1 grid place-items-center leading-none">
          <AnimatePresence mode="wait">
            <motion.span
              key={isLive ? "live" : index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="inline-block"
            >
              {isLive ? (
                <motion.span
                  // Scales DOWN on log, not up — see the tile pill's own
                  // identical comment on why (reads as a press into the
                  // page). This is the actual time value the flash is
                  // reporting on; the status label below it ("Current
                  // time") only gets the color flash, not this scale.
                  animate={{ scale: flash ? 0.88 : 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                  className={cn(
                    "font-display text-xl tabular-nums leading-none",
                    flash ? "text-blue-600" : "text-stone-400",
                  )}
                >
                  {formatClockTime(displayMs, use24HourTime)}
                </motion.span>
              ) : (
                <TimeOfDayKeypad
                  value={to24hs(displayMs)}
                  onChange={onEditTime}
                  onAdd={onAddTime}
                  withSeconds
                >
                  {({ open }) => (
                    <button
                      type="button"
                      // No stopPropagation — editing this entry's time is a
                      // real interaction with this card, and tapping it on
                      // a not-yet-active card should select the card too.
                      onClick={() => open()}
                      disabled={disabled}
                      aria-label={`Edit time for entry ${index + 1}`}
                      className="font-display text-xl tabular-nums leading-none text-foreground transition-colors hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {formatClockTime(displayMs, use24HourTime)}
                    </button>
                  )}
                </TimeOfDayKeypad>
              )}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      <button
        type="button"
        // No stopPropagation — logging is this card's own primary
        // data-entry action, and tapping it on a not-yet-active card
        // should select the card in the same tap.
        onClick={onLog}
        disabled={disabled}
        aria-label="Log timestamp now"
        // active:scale-100: same fix as this button's own tile/list-mode
        // counterparts — cancels the global button:active fallback, which
        // would otherwise shrink this button away from the pill's own
        // rounded-full overflow-hidden clip on press.
        className="btn-bevel grid w-12 place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 active:scale-100 disabled:opacity-40"
      >
        <span className="grid place-items-center active:scale-95 transition-transform">
          <Stamp className="size-4" />
        </span>
      </button>
    </div>
  );
}

function TimestampSideBubble({
  index,
  isLive,
  justLogged,
  onClick,
}: {
  index: number;
  isLive: boolean;
  justLogged: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="absolute inset-0 grid place-items-center">
      <span
        className={cn(
          "grid place-items-center size-full rounded-full border text-[9px] font-medium tabular-nums transition-colors",
          justLogged
            ? "bg-blue-100 border-blue-400 text-blue-700"
            : isLive
              ? "bg-blue-50 border-blue-200 text-blue-500"
              : "bg-stone-50 border-stone-200 text-stone-400",
        )}
      >
        {index + 1}
      </span>
    </button>
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
  onDoubleClick?: () => void;
  disabled?: boolean;
}) {
  const isLeft = direction === "left";
  return (
    <motion.button
      aria-label={isLeft ? "Previous entry" : "Next entry"}
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
          <path d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z" />
        ) : (
          <path d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z" />
        )}
      </svg>
    </motion.button>
  );
}
