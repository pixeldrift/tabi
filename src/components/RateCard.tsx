import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Link2, Minus, Pause, Play, Plus } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge, ListActionButton, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { NumberPadIcon } from "./icons/NumberPadIcon";
import { RateIcon } from "./icons/RateIcon";
import { NumberKeypad } from "./NumberKeypad";
import { TimeKeypad } from "./TimeKeypad";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession, useRegisterActiveTimer, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export interface RateCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Required observation window, in seconds — omit for interfering
   *  behaviors, which have no minimum and log every instance regardless. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
  /** When true, the timer is linked to the session timer: no play/pause, lock icon, gray display. */
  locked?: boolean;
}

/** Everything the bookmark bar's Rate chip needs. `count` is a plain
 *  tap-driven increment — safe to write straight through the store even
 *  while the real RateCard is also mounted elsewhere. `elapsed` (the rate's
 *  own denominator) is read-only here: it ticks automatically whenever the
 *  session is running, via the real card's own `subscribeTick` effect, so
 *  this hook only ever reads it (kept live by the store's
 *  useSyncExternalStore subscription) and never re-subscribes to the tick
 *  itself — a second subscription would double-count elapsed time. */
export function useRateChip(cardKey: string) {
  const [count, setCount] = useCardState(cardKey, "count", 0);
  const [elapsed] = useCardState(cardKey, "elapsed", 0);
  const { markDirty, canRecordData } = useCardSession();
  const ratePerMin = elapsed > 0 ? count / (elapsed / 60_000) : 0;
  const increment = () => {
    setCount((c) => c + 1);
    markDirty();
    playSoundEffect("tallyUp");
  };
  const decrement = () => {
    setCount((c) => Math.max(0, c - 1));
    markDirty();
    playSoundEffect("tallyDown");
  };
  return { count, ratePerMin, increment, decrement, canRecordData };
}

export function RateCard({
  id,
  title,
  phase = "Intervention",
  description,
  minDurationSec,
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
  locked = false,
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: RateCardProps) {
  const cardKey = id ?? title;
  const [count, setCount] = useCardState(cardKey, "count", 0);
  const [bumpKey, setBumpKey] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const [elapsed, setElapsed] = useCardState(cardKey, "elapsed", 0); // ms
  const [running, setRunning] = useCardState(cardKey, "running", true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { sessionRunning, subscribeTick, getElapsedMsNow } = useSession();
  const { markDirty, resetSignal, canRecordData } = useCardSession();
  // Holds a pending "start on the next full master second" timeout — see
  // `toggle` below — so a quick pause (or a session reset) before it fires
  // can cancel it instead of starting the timer late anyway.
  const pendingStartRef = useRef<number | null>(null);

  const clearPendingStart = () => {
    if (pendingStartRef.current !== null) {
      window.clearTimeout(pendingStartRef.current);
      pendingStartRef.current = null;
    }
  };
  useEffect(() => clearPendingStart, []);

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    clearPendingStart();
    setCount(0);
    setElapsed(0);
    setRunning(true);
    setFlash(false);
    setBumpKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);
  // Locked timers always follow the session. Unlocked timers tick only when
  // BOTH the session is running and the card timer is running.
  const ticking = locked ? sessionRunning : sessionRunning && running;
  useRegisterActiveTimer({
    id: `rate:${title}`,
    label: title,
    active: ticking && !locked,
    elementRef: cardRef,
    source: "rate",
    onActivate,
  });
  // No minimum window means every instance already counts — ready to graph
  // as soon as there's any data, rather than gated behind a threshold.
  const isComplete =
    minDurationSec !== undefined ? elapsed / 1000 >= minDurationSec : count > 0 || elapsed > 0;
  // The clock (elapsed) ticks the moment a session starts regardless of
  // whether anyone's tallied anything — it's the denominator a rate needs
  // — so hasData is true (there's a real clock running) well before any
  // instance is tallied, and the rate itself is 0 rather than undefined.
  const ratePerMin = elapsed > 0 ? count / (elapsed / 60_000) : 0;
  useReportCardStatus(cardKey, count > 0 || elapsed > 0, isComplete, {
    title,
    kind: "rate",
    value: `${count}`,
    unit: `${ratePerMin.toFixed(1)} per minute`,
  });

  useEffect(() => {
    if (!ticking) return;
    return subscribeTick((d) => setElapsed((e) => e + d));
  }, [ticking, subscribeTick]);

  // Rate-card mini timers start automatically with the session timer and
  // resume automatically when the session resumes after a pause. Users can
  // still explicitly pause an individual rate timer via its play/pause button.
  useEffect(() => {
    if (sessionRunning && !running) setRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRunning]);

  // Pausing is immediate, but starting waits until the master session clock
  // next crosses a whole second — sub-second accuracy doesn't matter here,
  // and it means every timer's displayed seconds tick over in unison instead
  // of drifting out of phase depending on the exact moment each was started.
  const toggle = () => {
    markDirty();
    clearPendingStart();
    if (running) {
      setRunning(false);
      return;
    }
    const msUntilNextSecond = 1000 - (getElapsedMsNow() % 1000 || 1000);
    pendingStartRef.current = window.setTimeout(() => {
      pendingStartRef.current = null;
      setRunning(true);
    }, msUntilNextSecond);
  };

  const setElapsedMs = (ms: number) => {
    setElapsed(ms);
    markDirty();
  };

  const triggerFlash = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 450);
  };

  const inc = () => {
    setDir(1);
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
    playSoundEffect("tallyUp");
  };
  const dec = () => {
    setDir(-1);
    setCount((c) => Math.max(0, c - 1));
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
    playSoundEffect("tallyDown");
  };

  const commit = (next: number) => {
    setDir(next >= count ? 1 : -1);
    setCount(next);
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };

  if (tileDensity) {
    const large = tileDensity === "large";
    return (
      <div ref={cardRef} className="w-full h-full">
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
          details={
            <>
              <DrawerQuickFacts
                icon={<RateIcon />}
                kind="rate"
                dataTypeLabel="Rate (per minute)"
                phase={phase}
                stats={[
                  ...(minDurationSec !== undefined
                    ? [{ label: "Minimum", value: `${minDurationSec}s` }]
                    : []),
                  { label: "Count", value: count },
                  { label: "Period", value: formatTime(elapsed) },
                ]}
              />
              {(teachingProcedure || description) && (
                <div className="mt-4">
                  <TeachingProcedureAccordion
                    description={description}
                    data={teachingProcedure}
                    kind="rate"
                  />
                </div>
              )}
            </>
          }
          actionsFullWidth
          actions={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dec();
                }}
                disabled={!canRecordData || count === 0}
                aria-label="Decrement"
                className={cn(
                  "btn-bevel shrink-0 rounded-full grid place-items-center border border-border bg-white text-foreground/70 active:scale-95 transition disabled:opacity-30",
                  large ? "size-[42px]" : "size-7",
                )}
              >
                <Minus className={large ? "size-[19px]" : "size-3.5"} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inc();
                }}
                disabled={!canRecordData}
                aria-label="Increment"
                className={cn(
                  "btn-bevel-solid shrink-0 rounded-full grid place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 disabled:opacity-40",
                  large ? "size-[42px]" : "size-7",
                )}
              >
                <Plus className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-1">
            {/* Number stays the one thing this row is actually centered on —
              the tap-to-edit hint and the stopwatch unit icon both hang off
              it via absolute positioning (same technique as the full-card
              view's own version of this) rather than sitting in normal flex
              flow, so neither one's width shifts the number off-center. */}
            <div className="relative inline-flex items-center">
              <NumberKeypad
                value={count}
                onReplace={(v) => commit(v)}
                onAdd={(delta) => commit(count + delta)}
                onOpenChange={setEditing}
              >
                {({ isEditing, open }) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    disabled={!canRecordData}
                    className="relative cursor-text disabled:cursor-not-allowed"
                    aria-label={`Current tally is ${count}. Tap to edit.`}
                  >
                    <NumberPadIcon
                      className={cn(
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 transition-colors",
                        large ? "-left-4" : "-left-3.5",
                        isEditing ? "text-muted-foreground/40" : "text-blue-400",
                        large ? "size-3" : "size-2.5",
                      )}
                      aria-hidden
                    />
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={bumpKey}
                        initial={{ y: dir > 0 ? "60%" : "-60%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: dir > 0 ? "-60%" : "60%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
                        style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                        className={cn(
                          "block font-display leading-none tabular-nums",
                          large ? "text-[38px]" : "text-[28px]",
                          flash ? "text-blue-600" : "text-foreground",
                        )}
                      >
                        {count}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                )}
              </NumberKeypad>
              {/* "/ [clock]" reads as "count per timed period" — faded gray so
               *  it stays a quiet unit hint next to the real number, not
               *  competing with it, and static regardless of `ticking` (the
               *  number's own bump animation already carries the "this is
               *  live" signal). Lucide's plain Clock, not RateIcon (its
               *  dashed-quarter styling is the kind icon used elsewhere for
               *  Rate — too busy for a small inline unit hint here). */}
              <span
                className={cn(
                  "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center text-muted-foreground/40",
                  large ? "-right-7 gap-0.5" : "-right-6 gap-px",
                )}
                aria-hidden
              >
                <span className={cn("font-display leading-none", large ? "text-xl" : "text-base")}>
                  /
                </span>
                <Clock className={large ? "size-3.5" : "size-3"} strokeWidth={2} />
              </span>
            </div>
            {/* Only the large tile has room for this without crowding the
             *  actions row below — same wording as the standard view's own
             *  readout. */}
            {large && (
              <span className="text-[10px] text-muted-foreground">
                {ratePerMin.toFixed(1)} instances per minute
              </span>
            )}
          </div>
        </MiniTileShell>
      </div>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<RateIcon />}
        kind="rate"
        dataTypeLabel="Rate / Min"
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
        details={
          <>
            <DrawerQuickFacts
              icon={<RateIcon />}
              kind="rate"
              dataTypeLabel="Rate (per minute)"
              phase={phase}
              stats={[
                ...(minDurationSec !== undefined
                  ? [{ label: "Minimum", value: `${minDurationSec}s` }]
                  : []),
                { label: "Count", value: count },
                { label: "Period", value: formatTime(elapsed) },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="rate"
                />
              </div>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-1">
            <NumberKeypad
              value={count}
              onReplace={(v) => commit(v)}
              onAdd={(delta) => commit(count + delta)}
              onOpenChange={setEditing}
            >
              {({ open }) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    open();
                  }}
                  disabled={!canRecordData}
                  className="cursor-text disabled:cursor-not-allowed"
                  aria-label={`Current tally is ${count}. Tap to edit.`}
                >
                  <ListActionSlide actionKey={bumpKey} direction={dir}>
                    <ListActionBadge value={count} weight="bold" />
                  </ListActionSlide>
                </button>
              )}
            </NumberKeypad>
            <ListActionButton
              icon={Minus}
              variant="neutral"
              disabled={!canRecordData || count === 0}
              ariaLabel="Decrement"
              onClick={dec}
            />
            <ListActionButton
              icon={Plus}
              variant="blue-solid"
              disabled={!canRecordData}
              ariaLabel="Increment"
              onClick={inc}
            />
          </div>
        }
      />
    );
  }

  return (
    <div ref={cardRef} className="w-full max-w-md scroll-mt-32">
      <CardShell
        title={title}
        phase={phase}
        dataType="Rate / Min"
        dataTypeIcon={<RateIcon />}
        kind="rate"
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
        editing={editing}
        details={
          <>
            <DrawerQuickFacts
              icon={<RateIcon />}
              kind="rate"
              dataTypeLabel="Rate (per minute)"
              phase={phase}
              stats={[
                ...(minDurationSec !== undefined
                  ? [{ label: "Minimum", value: `${minDurationSec}s` }]
                  : []),
                { label: "Count", value: count },
                { label: "Period", value: formatTime(elapsed) },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="rate"
                />
              </div>
            )}
          </>
        }
      >
        <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
          <button
            onClick={dec}
            disabled={!canRecordData || count === 0}
            aria-label="Decrement"
            className="btn-bevel size-12 shrink-0 aspect-square rounded-full grid place-items-center border border-border bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
          >
            <Minus className="size-5" strokeWidth={2.5} />
          </button>

          <NumberKeypad
            value={count}
            onReplace={(v) => commit(v)}
            onAdd={(delta) => commit(count + delta)}
            onOpenChange={setEditing}
          >
            {({ isEditing, open }) => (
              <div className="flex flex-col items-center justify-center min-w-[6rem] px-3 py-1">
                <button
                  type="button"
                  onClick={open}
                  disabled={!canRecordData}
                  className="cursor-text disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={`Current tally is ${count}. Tap to edit.`}
                >
                  <div className="relative">
                    <NumberPadIcon
                      className={cn(
                        "pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 size-3 transition-opacity",
                        isEditing ? "opacity-0" : "text-blue-400 opacity-100",
                      )}
                      aria-hidden
                    />
                    {/* Same "/ [clock]" convention as the grid tile — faded
                     *  gray, no animation, purely a unit hint next to the
                     *  real number. */}
                    <span
                      className="pointer-events-none absolute -right-6 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-muted-foreground/40"
                      aria-hidden
                    >
                      <span className="font-display text-2xl leading-none">/</span>
                      <Clock className="size-4" strokeWidth={2} />
                    </span>
                    <div className="relative overflow-hidden rounded-lg px-2 py-0.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={bumpKey}
                          initial={{ y: dir > 0 ? "100%" : "-100%", opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: dir > 0 ? "-100%" : "100%", opacity: 0 }}
                          transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
                          style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                          className={cn(
                            "block font-display text-4xl leading-none tabular-nums",
                            isEditing ? "text-blue-600" : "text-foreground",
                            flash && "text-blue-600",
                          )}
                        >
                          {count}
                        </motion.span>
                      </AnimatePresence>
                      {isEditing && (
                        <span
                          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-blue-400/80"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                </button>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors",
                    isEditing ? "text-blue-500" : "text-muted-foreground",
                  )}
                >
                  <span>Instances in</span>
                  <span className="inline-flex items-center">
                    {locked ? (
                      <>
                        <span
                          aria-label="Elapsed time (linked to session)"
                          className="inline-flex items-center border border-border bg-stone-100 pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full text-muted-foreground"
                        >
                          {formatCompactTime(elapsed)}
                        </span>
                        <span
                          aria-label="Timer is linked to session"
                          className="grid size-5 place-items-center rounded-r-full bg-stone-300 text-stone-600"
                        >
                          <Link2 className="size-3 rotate-45 -translate-x-0.5" strokeWidth={2.5} />
                        </span>
                      </>
                    ) : (
                      <>
                        <TimeKeypad
                          valueMs={elapsed}
                          onReplace={(ms) => setElapsedMs(ms)}
                          onAdd={(ms) => setElapsedMs(elapsed + ms)}
                        >
                          {({ open: openTime }) => (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTime();
                              }}
                              disabled={!canRecordData}
                              aria-label="Edit elapsed time"
                              className={cn(
                                "inline-flex items-center border border-blue-500 bg-white pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full cursor-text hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                running ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {formatCompactTime(elapsed)}
                            </button>
                          )}
                        </TimeKeypad>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle();
                          }}
                          disabled={!canRecordData}
                          aria-label={running ? "Pause timer" : "Resume timer"}
                          className="btn-bevel grid size-5 place-items-center rounded-r-full bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-40"
                        >
                          {running ? (
                            <Pause className="size-3 -translate-x-0.5" fill="currentColor" />
                          ) : (
                            <Play className="size-3 -translate-x-0.5" fill="currentColor" />
                          )}
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {/* Plain-language readout of the same ratePerMin already
                 *  reported to the status bar (see useReportCardStatus
                 *  below) — spelled out here since "count / [icon]" up by
                 *  the number is a unit hint, not an actual rate. */}
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {ratePerMin.toFixed(1)} instances per minute
                </span>
              </div>
            )}
          </NumberKeypad>

          <motion.button
            onClick={inc}
            disabled={!canRecordData}
            whileTap={{ scale: 0.94 }}
            aria-label="Increment"
            className={cn(
              "btn-bevel-solid size-14 shrink-0 aspect-square rounded-full grid place-items-center text-white transition-colors disabled:opacity-40",
              "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
            )}
          >
            <Plus className="size-6" strokeWidth={3} />
          </motion.button>
        </div>
      </CardShell>
    </div>
  );
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// The pill sitting next to the play/pause button is much tighter on space
// than a details row — no session ever runs anywhere near 10 hours, so the
// leading hour digit never needs its own padding, and the "h:" segment is
// dropped entirely below the 1-hour mark (that's still the overwhelming
// majority of the time) while staying available for the rare meltdown that
// does run long.
function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0
    ? `${h}:${mm}:${s.toString().padStart(2, "0")}`
    : `${mm}:${s.toString().padStart(2, "0")}`;
}
