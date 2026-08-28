import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Stamp, ChevronLeft, ChevronRight } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { ListActionBadge } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { HORIZONTAL_FADE_MASK } from "./IntervalCard";
import { TimeOfDayKeypad, formatTimeOfDay } from "./TimeOfDayKeypad";
import { cn } from "@/lib/utils";

export interface TimestampCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
}

function to24h(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Same "h:mma"/"h:mmp" convention as the Schedule tab's own grid — one
// canonical formatter used app-wide (see TimeOfDayKeypad.tsx), rather than
// this card inventing its own "9:34:37 PM" style.
function formatStampTime(ms: number) {
  return formatTimeOfDay(to24h(ms));
}

function formatStampDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Replaces just the hour/minute of an existing stamp (via the keypad's 24h
// "HH:MM" commit value), keeping that entry's original date and zeroing
// seconds — editing a stamp's time was never meant to also silently move it
// to a different day.
function applyTimeOfDay(ms: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const d = new Date(ms);
  d.setHours(h, m, 0, 0);
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

// How many past digits the log button's press animates through before the
// stamped copy actually lands in the history tape — long enough that the
// pill's own quick scale-up + color flash reads as its own distinct first
// beat, short enough the "slide over" still feels like part of the same tap.
const PUSH_DELAY_MS = 220;
const FLASH_DURATION_MS = 500;
// How many of the most recent (up to and including the focused one) stamps
// the history tape keeps mounted at once. Deliberately small — a centered,
// fixed-width pill only leaves one side of a max-w-md card for the tape at
// all, and confirmed via Playwright that a wider window overflowed that
// space and left its off-screen chips' (still real, still hit-testable)
// click targets sitting underneath the nav arrow instead.
const TAPE_WINDOW = 2;
const PILL_W = 160;
const PILL_HALF_GAP = 88; // half of PILL_W + an 8px gap to the tape
const ARROW_HIT = 28; // TriangleNav's own hit-box size (size-7)

export function TimestampCard({
  id,
  title,
  phase = "Intervention",
  description,
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
  // The actual entry isn't pushed until PUSH_DELAY_MS later — that gap is
  // what makes the pill's own scale-up-and-color-change read as a first,
  // distinct beat before the stamped copy slides into the history tape.
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const pushTimeoutRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
      if (pushTimeoutRef.current !== null) window.clearTimeout(pushTimeoutRef.current);
    },
    [],
  );

  const logNow = () => {
    if (!canRecordData) return;
    markDirty();
    const ts = Date.now();
    const insertIdx = entries.length;

    setFlash(true);
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(false), FLASH_DURATION_MS);

    if (pushTimeoutRef.current !== null) window.clearTimeout(pushTimeoutRef.current);
    pushTimeoutRef.current = window.setTimeout(() => {
      setEntries((prev) => [...prev, ts]);
      setViewIdx(insertIdx);
    }, PUSH_DELAY_MS);
  };

  const goTo = (idx: number) => {
    setViewIdx(Math.max(0, Math.min(entries.length - 1, idx)));
  };

  const updateEntryTime = (idx: number, next24h: string) => {
    setEntries((prev) => prev.map((v, j) => (j === idx ? applyTimeOfDay(v, next24h) : v)));
  };

  const hasData = entries.length > 0;
  useReportCardStatus(cardKey, hasData, hasData, {
    title,
    kind: "timestamp",
    value: String(entries.length),
    unit: entries.length === 1 ? "Entry" : "Entries",
  });

  // The tape only ever needs to render the window ending at whichever entry
  // is currently focused (viewIdx) — sliding the nav arrows back further
  // than TAPE_WINDOW just moves which slice of history that window shows,
  // rather than growing the tape itself.
  const windowStart = Math.max(0, viewIdx - (TAPE_WINDOW - 1));
  const windowEntries = entries.slice(windowStart, viewIdx + 1);

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
        actions={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              logNow();
            }}
            disabled={!canRecordData}
            aria-label="Log timestamp now"
            className={cn(
              "btn-bevel grid place-items-center rounded-full text-white transition-colors active:scale-95 disabled:opacity-40",
              "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
              large ? "size-10" : "size-8",
            )}
          >
            <Stamp className={large ? "size-4" : "size-3.5"} />
          </button>
        }
      >
        {/* Live ticking clock pill — no date needed at this density, just
            the count bubble + running time, same as the standard view's
            own pill minus the date line above it. */}
        <div
          className={cn(
            "shrink-0 flex items-stretch rounded-full border-2 border-border bg-white overflow-hidden",
            large ? "h-9" : "h-7",
          )}
        >
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-full bg-stone-300 text-white font-semibold tabular-nums",
              large ? "size-6 text-[11px] ml-1" : "size-5 text-[9px] ml-0.5",
            )}
          >
            {entries.length + 1}
          </span>
          <span
            className={cn(
              "flex items-center font-display tabular-nums leading-none text-stone-400",
              large ? "text-sm px-2.5" : "text-[11px] px-2",
            )}
          >
            {formatStampTime(now)}
          </span>
        </div>

        {/* Large density only — same "pushed to the tile's own edges"
            nav-arrow convention as Task Analysis's/Checklist's tiles; small
            density relies on tapping/swiping a dot alone. */}
        {entries.length > 0 && (
          <div className="relative w-full flex items-center justify-center mt-1">
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
                  className="absolute left-0 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(viewIdx + 1);
                  }}
                  disabled={viewIdx >= entries.length - 1}
                  aria-label="Next entry"
                  className="absolute right-0 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            )}
            <SwipeStrip
              count={entries.length}
              current={viewIdx}
              onCurrentChange={goTo}
              variant="centered"
              gapClassName={large ? "gap-2" : "gap-1.5"}
              itemWrapperClassName="flex items-center justify-center"
            >
              {(i) => {
                const isCurrent = i === viewIdx;
                return (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(i);
                    }}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      isCurrent
                        ? cn(large ? "size-2" : "size-1.5", "bg-blue-500")
                        : cn(large ? "size-1.5" : "size-1", "bg-blue-200"),
                    )}
                    aria-hidden
                  />
                );
              }}
            </SwipeStrip>
          </div>
        )}
      </MiniTileShell>
    );
  }

  if (listMode) {
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
          <div className="flex items-center gap-1">
            <ListActionBadge value={entries.length} weight="bold" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                logNow();
              }}
              disabled={!canRecordData}
              aria-label="Log now"
              className="btn-bevel grid size-7 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40 bg-blue-500 hover:bg-blue-600 active:bg-blue-600"
            >
              <Stamp className="size-3.5" />
            </button>
          </div>
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
            <span className="normal-case tracking-normal tabular-nums text-foreground">
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
                <TimeOfDayKeypad value={to24h(ts)} onChange={(next) => updateEntryTime(i, next)}>
                  {({ open }) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open();
                      }}
                      disabled={!canRecordData}
                      aria-label={`Edit time for entry ${i + 1}`}
                      className="flex-1 text-left tabular-nums text-sm text-foreground/80 transition-colors hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-foreground/80"
                    >
                      {formatStampTime(ts)}
                    </button>
                  )}
                </TimeOfDayKeypad>
                <span className="tabular-nums text-sm text-muted-foreground shrink-0">
                  {formatStampDate(ts)}
                </span>
              </li>
            ))}
            {/* The live pill's own expanded-view counterpart — always the
                last line, ticking, with the log button right beside it
                rather than as a separate full-width bar below the list. */}
            <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 mt-1 border-t border-dashed border-border pt-2.5">
              <span className="grid place-items-center size-6 rounded-full bg-stone-300 text-[11px] font-medium text-white shrink-0">
                {entries.length + 1}
              </span>
              <span className="flex-1 tabular-nums text-sm font-semibold text-stone-400">
                {formatStampTime(now)}
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
          <div className="relative h-[52px] mt-1">
            <TriangleNav
              direction="left"
              onClick={() => goTo(viewIdx - 1)}
              disabled={viewIdx <= 0}
            />
            <TriangleNav
              direction="right"
              onClick={() => goTo(viewIdx + 1)}
              disabled={viewIdx >= entries.length - 1}
            />

            {/* History tape — starts clear of the left TriangleNav's own
                hit box, so an old stamp sitting at the tape's left edge is
                never covered by the arrow's invisible hit area (confirmed
                via Playwright: without this inset, clicks meant for that
                stamp landed on "Previous entry" instead). Ends a fixed gap
                left of center (half the pill's own width plus an 8px gap)
                so the tape's own content, however wide, never pushes the
                live pill off its dead-center position. Fades toward the
                far/left edge, same mask IntervalCard's own timeline uses. */}
            <div
              className="absolute inset-y-0 overflow-hidden"
              style={{
                left: ARROW_HIT,
                right: `calc(50% + ${PILL_HALF_GAP}px)`,
                ...HORIZONTAL_FADE_MASK,
              }}
            >
              <div className="h-full flex items-center justify-end gap-1.5 px-1">
                <AnimatePresence initial={false}>
                  {windowEntries.map((ts, i) => {
                    const realIndex = windowStart + i;
                    const isNewest = realIndex === entries.length - 1;
                    const isFocused = realIndex === viewIdx;
                    return (
                      <motion.div
                        key={ts}
                        layout
                        initial={{ opacity: 0, x: 20, scale: 0.85 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      >
                        <TimeOfDayKeypad
                          value={to24h(ts)}
                          onChange={(next) => updateEntryTime(realIndex, next)}
                        >
                          {({ open }) => (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                open();
                              }}
                              disabled={!canRecordData}
                              aria-label={`Edit time for entry ${realIndex + 1}`}
                              style={{
                                transition:
                                  isNewest && flash
                                    ? "none"
                                    : "color 700ms ease-out, background-color 700ms ease-out, border-color 700ms ease-out",
                              }}
                              className={cn(
                                "shrink-0 rounded-full border px-1.5 py-1 text-[9px] font-medium tabular-nums whitespace-nowrap disabled:cursor-not-allowed",
                                isNewest && flash
                                  ? "border-blue-300 bg-blue-50 text-blue-700"
                                  : isFocused
                                    ? "border-blue-200 bg-blue-50/70 text-blue-700"
                                    : "border-stone-200 bg-stone-50 text-muted-foreground hover:border-blue-200",
                              )}
                            >
                              {formatStampTime(ts)}
                            </button>
                          )}
                        </TimeOfDayKeypad>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Live "now" pill — permanently centered, independent of the
                tape's own content width; only its text and border color
                flash on log, it never itself moves. */}
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 top-0 flex items-stretch rounded-full border-2 bg-white overflow-hidden h-[52px]",
                flash ? "border-blue-400" : "border-border",
              )}
              style={{ width: PILL_W, transition: flash ? "none" : "border-color 700ms ease-out" }}
            >
              <div className="flex-1 flex items-center gap-2 pl-2 pr-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-300 text-white text-xs font-semibold tabular-nums">
                  {entries.length + 1}
                </span>
                <motion.span
                  animate={{ scale: flash ? 1.16 : 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                  className={cn(
                    "flex-1 text-center font-display text-lg tabular-nums leading-none",
                    flash ? "text-blue-600" : "text-stone-400",
                  )}
                >
                  {formatStampTime(now)}
                </motion.span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={logNow}
              disabled={!canRecordData}
              className="btn-bevel inline-flex items-center justify-center gap-1.5 rounded-full h-9 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-4 transition-colors active:scale-95 disabled:opacity-40"
            >
              Log Timestamp Now
              <Stamp className="size-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center h-4">
            {hasData ? (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">
                Entry{" "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {viewIdx + 1}
                </span>{" "}
                of{" "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {entries.length}
                </span>
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
      aria-label={isLeft ? "Previous entry" : "Next entry"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-7 text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "left-0" : "right-0",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        {isLeft ? (
          <path d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z" />
        ) : (
          <path d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z" />
        )}
      </svg>
    </motion.button>
  );
}
