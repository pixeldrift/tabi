import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from "motion/react";
import { Play, Pause } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge, ListActionSlide } from "./ListRowActions";
import { SwipeStrip } from "./SwipeStrip";
import { useCardState, useResetGuard } from "./CardDataStore";
import { DurationIcon } from "./icons/DurationIcon";
import { TimeKeypad } from "./TimeKeypad";
import { useCardSession, useRegisterActiveTimer, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

const PULSE_BEAT_MS = 1000;

export interface DurationCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Minimum cumulative duration, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

const BUBBLE = 22;
const CENTER_W = 210;
const CENTER_H = 52;
const GAP = 8;

export function DurationCard({
  id,
  title,
  phase = "Intervention",
  description,
  minDurationSec = 30,
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
}: DurationCardProps) {
  const cardKey = id ?? title;
  const [instances, setInstances] = useCardState<number[]>(cardKey, "instances", [0]);
  const [viewIdx, setViewIdx] = useCardState(cardKey, "viewIdx", 0);
  const [liveMs, setLiveMs] = useCardState(cardKey, "liveMs", 0);
  const [running, setRunning] = useCardState(cardKey, "running", false);
  const [runningIdx, setRunningIdx] = useCardState<number | null>(cardKey, "runningIdx", null);
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const { sessionRunning, getElapsedMsNow, subscribeTick } = useSession();
  const { markDirty, resetSignal } = useCardSession();
  useRegisterActiveTimer({
    id: `duration:${title}`,
    label: title,
    active: running && sessionRunning,
    elementRef: cardRef,
    source: "duration",
    // Jumping here from the header's timer indicator should bring the
    // actual running instance into view — not whichever one the user last
    // swiped to — since a multi-instance card can easily be showing a
    // finished earlier instance instead of the live one.
    onActivate: () => {
      if (runningIdx !== null && runningIdx !== viewIdx) setViewIdx(runningIdx);
      onActivate?.();
    },
  });
  // Holds a pending "start on the next full master second" timeout — see
  // `toggleInstance` below — so a quick pause (or a session reset) before it
  // fires can cancel it instead of starting the timer late anyway.
  const pendingStartRef = useRef<number | null>(null);

  const clearPendingStart = () => {
    if (pendingStartRef.current !== null) {
      window.clearTimeout(pendingStartRef.current);
      pendingStartRef.current = null;
    }
  };
  useEffect(() => clearPendingStart, []);

  // The pulse beat should read as one continuous heartbeat tied to the
  // session clock, not a fresh cycle every time a bubble starts running. A
  // negative delay equal to how far into the current beat we already are
  // lands it exactly where it'd be if it had been animating since session
  // elapsed = 0. Computed synchronously in the same state update that flips
  // `running` on (see togglePause) rather than in an effect — setting it a
  // render later would mean the very first paint uses a stale delay of 0,
  // and correcting it after the CSS animation has already begun jumps its
  // phase instead of cleanly establishing it.
  const [pulseDelayMs, setPulseDelayMs] = useState(0);
  const pulseStyle = { animationDuration: `${PULSE_BEAT_MS}ms`, animationDelay: `${pulseDelayMs}ms` };

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    clearPendingStart();
    setInstances([0]);
    setViewIdx(0);
    setLiveMs(0);
    setRunning(false);
    setRunningIdx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);


  // Tick in unison with the master session timer.
  useEffect(() => {
    if (!running || !sessionRunning) return;
    return subscribeTick((d) => setLiveMs((ms) => ms + d));
  }, [running, sessionRunning, subscribeTick]);

  const instanceMs = (idx: number) => {
    if (idx < 0 || idx >= instances.length) return 0;
    if (running && runningIdx === idx) {
      return instances[idx] + liveMs;
    }
    return instances[idx];
  };

  const totalMs = instances.reduce((a, b) => a + b, 0) + (running ? liveMs : 0);
  const totalSec = totalMs / 1000;
  const isComplete = totalSec >= minDurationSec;
  const remaining = Math.max(0, Math.ceil(minDurationSec - totalSec));
  useReportCardStatus(cardKey, totalMs > 0, isComplete);

  const flushLive = () => {
    if (running && runningIdx !== null) {
      const idx = runningIdx;
      setInstances((arr) => {
        const next = arr.slice();
        next[idx] = (next[idx] ?? 0) + liveMs;
        return next;
      });
    }
    setLiveMs(0);
  };

  // When the session pauses, pause the current instance too.
  useEffect(() => {
    if (!sessionRunning && running) {
      flushLive();
      setRunning(false);
      setRunningIdx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRunning]);

  // Shared by the standard view's center-pill toggle (idx = viewIdx) and the
  // expanded list's per-instance play/pause buttons (arbitrary idx) —
  // starting a different instance pauses whichever one was running, so
  // there's only ever one clock ticking.
  // Pausing is immediate, but starting waits until the master session clock
  // next crosses a whole second — sub-second accuracy doesn't matter here,
  // and it means every timer's displayed seconds tick over in unison instead
  // of drifting out of phase depending on the exact moment each was started.
  const toggleInstance = (idx: number) => {
    markDirty();
    clearPendingStart();
    if (running && runningIdx === idx) {
      const wasLast = idx === instances.length - 1;
      flushLive();
      setRunning(false);
      setRunningIdx(null);
      if (wasLast) {
        setInstances((arr) => [...arr, 0]);
        // Only auto-advance the view when the paused instance was the last
        // one — pausing an earlier instance (after navigating back to fix
        // up its time) shouldn't yank the view forward past instances that
        // already have their own data.
        setViewIdx(idx + 1);
      }
    } else {
      if (running) {
        flushLive();
        setRunning(false);
        setRunningIdx(null);
      }
      setViewIdx(idx);
      const msUntilNextSecond = 1000 - (getElapsedMsNow() % 1000 || 1000);
      pendingStartRef.current = window.setTimeout(() => {
        pendingStartRef.current = null;
        setRunningIdx(idx);
        setRunning(true);
        setPulseDelayMs(-(getElapsedMsNow() % PULSE_BEAT_MS));
      }, msUntilNextSecond);
    }
  };

  const togglePause = () => toggleInstance(viewIdx);

  const setInstanceMs = (idx: number, ms: number) => {
    markDirty();
    if (running && runningIdx === idx) {
      flushLive();
      setRunning(false);
      setRunningIdx(null);
    }
    setInstances((arr) => {
      const next = arr.slice();
      next[idx] = Math.max(0, ms);
      // Same "always one more ready" rule as the play/pause path — editing
      // the last instance's time directly (not via the timer) should also
      // open up a fresh one, not just get grown when the timer is paused.
      if (next[idx] > 0 && idx === next.length - 1) next.push(0);
      return next;
    });
  };

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(instances.length - 1, idx));
    setViewIdx(clamped);
  };

  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(
    () => -(viewIdx * stepWidth + CENTER_W / 2),
    [viewIdx, stepWidth],
  );

  const isViewingRunning = running && runningIdx === viewIdx;
  const isIdxRunning = (i: number) => running && runningIdx === i;
  const isActivated = (i: number) => instances[i] > 0 || isIdxRunning(i);

  // Same drag-to-swipe pattern as TrialCard's own bubble track — real touch/
  // mouse dragging in addition to the triangle nav buttons, snapping to
  // whichever instance ends up nearest center on release.
  const dragX = useMotionValue(0);
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const finalOffset = trackOffset + info.offset.x;
    const targetIdx = Math.round(-(finalOffset + CENTER_W / 2) / stepWidth);
    goTo(targetIdx);
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 32 });
  };

  if (tileDensity) {
    const large = tileDensity === "large";
    return (
      <div ref={cardRef as React.RefObject<HTMLDivElement>} className="w-full h-full">
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
          details={
            <dl className="space-y-3">
              <Row label="Phase" value={phase} />
              <Row label="Data type" value="Frequency / Duration" />
              <Row label="Minimum" value={`${minDurationSec}s`} />
              <Row label="Times" value={String(instances.length)} />
              <Row label="Total" value={formatTime(totalMs)} />
            </dl>
          }
        >
          <div
            className={cn("flex flex-wrap items-center justify-center", large ? "gap-1.5" : "gap-1")}
            aria-hidden
          >
            {instances.map((ms, i) => {
              const isCurrent = i === viewIdx;
              return (
                <motion.span
                  key={i}
                  layout="position"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(
                    "rounded-full shrink-0 transition-[width,height,background-color]",
                    isCurrent ? (large ? "size-2" : "size-1.5") : large ? "size-1.5" : "size-1",
                    // Color reflects this instance's own data/running state
                    // only — being the "current" (viewed) instance no longer
                    // forces blue on its own; a fresh, not-yet-started
                    // instance stays gray even while it's the one in view.
                    isIdxRunning(i) ? "bg-blue-500" : ms > 0 ? "bg-blue-200" : "bg-stone-300",
                  )}
                />
              );
            })}
            {/* Preview of the next instance, before it formally exists —
                appears once the last real instance has data or is running,
                hinting "one more is coming" (matching toggleInstance's own
                auto-advance-on-pause behavior). Smaller and plain gray, and
                not interactive, so it doesn't read as a real, clickable
                instance yet. */}
            <AnimatePresence>
              {isActivated(instances.length - 1) && (
                <motion.span
                  key="preview"
                  layout="position"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className={cn("rounded-full shrink-0 bg-stone-300", large ? "size-1" : "size-[3px]")}
                />
              )}
            </AnimatePresence>
          </div>
          {/* No h-full here (unlike the old version) — that forced this
              strip to claim the tile's entire remaining height, and its own
              item wrapper then top-pinned the pill/label within that tall
              box, leaving all the slack as empty space below instead of
              actually centering. Sized to its own content instead, so the
              dots-row + strip together form one natural-height block that
              the tile's own centering wrapper (see MiniTileShell) can
              center as a whole. */}
          <SwipeStrip
            count={instances.length}
            current={viewIdx}
            onCurrentChange={goTo}
            variant="paged"
            className="w-full"
            itemWrapperClassName="w-full flex flex-col items-center gap-1"
          >
            {(i) => {
              const running = isIdxRunning(i);
              const activated = isActivated(i);
              const accent = running || activated;
              return (
                <>
                  <div
                    className={cn(
                      "flex items-stretch rounded-full overflow-hidden border-2 bg-white transition-colors",
                      large ? "h-10" : "h-[30px]",
                      accent ? "border-blue-500" : "border-stone-300",
                    )}
                  >
                    <TimeKeypad
                      valueMs={instanceMs(i)}
                      onReplace={(next) => setInstanceMs(i, next)}
                      onAdd={(delta) => setInstanceMs(i, instanceMs(i) + delta)}
                    >
                      {({ open }) => (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            open();
                          }}
                          disabled={!sessionRunning}
                          aria-label={`Edit time for instance ${i + 1}`}
                          className={cn(
                            // Reserves room up front for one more digit than
                            // the common case (e.g. crossing from "9:59" to
                            // "10:00", or gaining an hours place entirely) —
                            // without this, the pill only grows when it
                            // actually needs to, which reads as a sudden
                            // jolt right as the button shifts over with it.
                            "flex items-center justify-center font-bold tabular-nums cursor-text disabled:cursor-not-allowed",
                            large ? "px-3 text-lg min-w-[4.5rem]" : "px-2 text-[13px] min-w-[3.25rem]",
                          )}
                        >
                          {formatCompactTime(instanceMs(i))}
                        </button>
                      )}
                    </TimeKeypad>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleInstance(i);
                      }}
                      disabled={!sessionRunning}
                      aria-label={running ? "Pause this instance" : "Start this instance"}
                      className={cn(
                        "grid place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40",
                        large ? "w-10" : "w-[30px]",
                      )}
                    >
                      {running ? (
                        <Pause className={large ? "size-[17px]" : "size-3.5"} fill="currentColor" strokeWidth={0} />
                      ) : (
                        <Play className={cn(large ? "size-[17px]" : "size-3.5", "translate-x-px")} fill="currentColor" strokeWidth={0} />
                      )}
                    </button>
                  </div>
                  <span
                    className={cn(
                      "flex items-baseline gap-1 uppercase tracking-wide text-muted-foreground",
                      large ? "text-[11px] leading-none" : "text-[9px] leading-none",
                    )}
                  >
                    <span>Instance</span>
                    {/* The instance number itself is the one thing worth a
                        glance here — larger and bolder than the rest of the
                        label, same emphasis idiom as Duration's own "Time X
                        of Y" helper text in Card mode. */}
                    <span
                      className={cn(
                        "font-display font-bold normal-case tabular-nums text-foreground",
                        large ? "text-sm" : "text-xs",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span>of {instances.length}</span>
                  </span>
                </>
              );
            }}
          </SwipeStrip>
        </MiniTileShell>
      </div>
    );
  }

  if (listMode) {
    const running_ = isIdxRunning(viewIdx);
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<DurationIcon />}
        dataTypeLabel="Duration"
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
        actions={
          // Badge and pill travel together — the pill's time/play-pause is
          // specific to THIS instance, so advancing to another one should
          // read as the whole row moving on, not just the number changing
          // while the same pill sits still.
          <ListActionSlide actionKey={viewIdx}>
            <ListActionBadge value={viewIdx + 1} />
            <div
              className={cn(
                "flex items-stretch h-7 rounded-full overflow-hidden border-2 bg-white transition-colors",
                isActivated(viewIdx) ? "border-blue-500" : "border-stone-300",
              )}
            >
              <TimeKeypad
                valueMs={instanceMs(viewIdx)}
                onReplace={(next) => setInstanceMs(viewIdx, next)}
                onAdd={(delta) => setInstanceMs(viewIdx, instanceMs(viewIdx) + delta)}
              >
                {({ open }) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    disabled={!sessionRunning}
                    aria-label={`Edit time for instance ${viewIdx + 1}`}
                    className="flex items-center justify-center px-2 text-[12px] font-bold tabular-nums min-w-[3rem] cursor-text disabled:cursor-not-allowed"
                  >
                    {formatCompactTime(instanceMs(viewIdx))}
                  </button>
                )}
              </TimeKeypad>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePause();
                }}
                disabled={!sessionRunning}
                aria-label={running_ ? "Pause this instance" : "Start this instance"}
                className="grid place-items-center w-7 text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40"
              >
                {running_ ? (
                  <Pause className="size-3" fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play className="size-3 translate-x-px" fill="currentColor" strokeWidth={0} />
                )}
              </button>
            </div>
          </ListActionSlide>
        }
      />
    );
  }

  return (
    <div ref={cardRef as React.RefObject<HTMLDivElement>} className="w-full max-w-md scroll-mt-32">
    <CardShell
      title={title}
      phase={phase}
      dataType="Duration"
      dataTypeIcon={<DurationIcon />}
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
      progress={null}
      isComplete={isComplete}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      helperText={
        <span>
          Combined Total{" "}
          <span className="normal-case tracking-normal tabular-nums text-foreground">
            {formatTime(totalMs)}
          </span>
        </span>
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Frequency / Duration" />
          <Row label="Minimum" value={`${minDurationSec}s`} />
          <Row label="Times" value={String(instances.length)} />
          <Row label="Total" value={formatTime(totalMs)} />
        </dl>
      }
      expandedView={
        <ol className="px-3 pt-2 pb-3 space-y-1">
          {instances.map((ms, i) => {
            const isRunning = isIdxRunning(i);
            const hasData = ms > 0;
            // A never-started instance is just the trailing "next" slot the
            // auto-push logic always keeps ready (see setInstanceMs/
            // toggleInstance) — showing it a number implies it's actually
            // in progress, so it stays hidden (not just dimmed) until it
            // genuinely has one, at which point it fades in already
            // colored (gray, or blue once/while actively running).
            const started = hasData || isRunning;
            return (
              <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span
                  className={cn(
                    "grid place-items-center size-6 rounded-full text-[11px] font-medium shrink-0 transition-opacity",
                    isRunning ? "bg-blue-500 text-white" : "bg-stone-100 text-muted-foreground",
                    started ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden={!started}
                >
                  {i + 1}
                </span>
                {/* The instance actually running gets bold blue text — every
                    other row (including ones with recorded time) stays
                    regular weight, so there's exactly one obvious highlight. */}
                <TimeKeypad
                  valueMs={instanceMs(i)}
                  onReplace={(next) => setInstanceMs(i, next)}
                  onAdd={(delta) => setInstanceMs(i, instanceMs(i) + delta)}
                >
                  {({ open }) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open();
                      }}
                      disabled={!sessionRunning}
                      aria-label={`Edit time for instance ${i + 1}`}
                      className={cn(
                        "flex-1 text-left tabular-nums text-sm rounded-md transition-colors hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed",
                        isRunning ? "font-bold text-blue-600" : "font-normal text-foreground/80",
                      )}
                    >
                      {formatTime(instanceMs(i))}
                    </button>
                  )}
                </TimeKeypad>
                <button
                  type="button"
                  onClick={() => toggleInstance(i)}
                  disabled={!sessionRunning}
                  aria-label={isRunning ? "Pause this instance" : "Start this instance"}
                  className={cn(
                    "btn-bevel grid size-7 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40",
                    isRunning ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600",
                  )}
                >
                  {isRunning ? (
                    <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play className="size-3.5 translate-x-px" fill="currentColor" strokeWidth={0} />
                  )}
                </button>
              </li>
            );
          })}
          <li className="flex items-center gap-2 px-2 py-2 mt-1 border-t border-dashed border-stone-200">
            <span className="size-6 shrink-0" aria-hidden />
            <span className="tabular-nums text-sm font-bold text-foreground">{formatTime(totalMs)}</span>
            <span className="text-sm font-bold text-foreground">Total</span>
          </li>
        </ol>
      }
    >
      <div className="relative px-2 pt-2 pb-4">
        <div className="relative h-[68px]">
          <TriangleNav
            direction="left"
            onClick={() => goTo(viewIdx - 1)}
            disabled={viewIdx === 0}
          />
          <TriangleNav
            direction="right"
            onClick={() => goTo(viewIdx + 1)}
            disabled={viewIdx >= instances.length - 1}
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
              dragConstraints={{ left: -((instances.length - 1) * stepWidth) - 200, right: 200 }}
              dragElastic={0.08}
              onDragEnd={handleDragEnd}
            >
              {instances.map((_, i) => {
                const isCenter = i === viewIdx;
                const centerRunning = isCenter && isViewingRunning;
                const itemRunning = isIdxRunning(i);
                const activated = isActivated(i);
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
                      <CenterPill
                        index={i}
                        ms={instanceMs(i)}
                        running={centerRunning}
                        activated={activated}
                        disabled={!sessionRunning}
                        onToggle={togglePause}
                        onEditTime={(ms) => setInstanceMs(i, ms)}
                        pulseStyle={pulseStyle}
                      />
                    ) : (
                      <SideBubble
                        index={i}
                        running={itemRunning}
                        activated={activated}
                        onClick={() => goTo(i)}
                        pulseStyle={pulseStyle}
                      />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground h-4">
          <span>
            Time{" "}
            <span className="normal-case tracking-normal tabular-nums text-foreground">
              {viewIdx + 1}
            </span>{" "}
            of{" "}
            <span className="normal-case tracking-normal tabular-nums text-foreground">
              {instances.filter((v, i) => v > 0 || (running && runningIdx === i)).length}
            </span>
            , total{" "}
            <strong className="font-semibold normal-case tracking-normal tabular-nums text-foreground">
              {formatShortTime(totalMs)}
            </strong>
          </span>
        </div>
      </div>
    </CardShell>
    </div>
  );
}

function CenterPill({
  index,
  ms,
  running,
  activated,
  disabled,
  onToggle,
  onEditTime,
  pulseStyle,
}: {
  index: number;
  ms: number;
  running: boolean;
  activated: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onEditTime: (ms: number) => void;
  pulseStyle: { animationDuration: string; animationDelay: string };
}) {
  const accent = running || activated;
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-stretch rounded-full overflow-hidden border-2 bg-white transition-colors",
        accent ? "border-blue-500" : "border-stone-300",
      )}
    >
      <div className="flex-1 flex items-center gap-2 pl-2 pr-2">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-white text-xs font-semibold tabular-nums transition-colors",
            accent ? "bg-blue-500" : "bg-stone-300",
            running && "animate-pulse-scale",
          )}
          style={running ? pulseStyle : undefined}
        >
          {index + 1}
        </span>

        <div className="flex-1 grid place-items-center leading-none">
          <TimeKeypad
            valueMs={ms}
            onReplace={(next) => onEditTime(next)}
            onAdd={(delta) => onEditTime(ms + delta)}
          >
            {({ open }) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  open();
                }}
                disabled={disabled}
                className={cn(
                  "font-display text-2xl tabular-nums leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  running ? "text-foreground" : activated ? "text-foreground" : "text-stone-400",
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    {formatTime(ms)}
                  </motion.span>
                </AnimatePresence>
              </button>
            )}
          </TimeKeypad>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        aria-label={running ? "Pause this instance" : "Start this instance"}
        className="btn-bevel grid w-12 place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40"
      >
        {running ? (
          <Pause className="size-5 -translate-x-0.5" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-5 -translate-x-0.5" fill="currentColor" strokeWidth={0} />
        )}
      </button>
    </div>
  );
}

function SideBubble({
  index,
  running,
  activated,
  onClick,
  pulseStyle,
}: {
  index: number;
  running: boolean;
  activated: boolean;
  onClick: () => void;
  pulseStyle: { animationDuration: string; animationDelay: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-0 grid place-items-center"
    >
      <span
        className={cn(
          "grid place-items-center size-full rounded-full border text-[9px] font-medium tabular-nums",
          running
            ? "bg-blue-100 border-blue-400 text-blue-700"
            : activated
              ? "bg-blue-50 border-blue-200 text-blue-500"
              : "bg-stone-50 border-stone-200 text-stone-400",
        )}
      >
        {index + 1}
      </span>
      {running && (
        <span
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-blue-500 animate-pulse-dot"
          style={pulseStyle}
          aria-hidden
        />
      )}

    </button>
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
      aria-label={isLeft ? "Previous instance" : "Next instance"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "left-0" : "right-0",
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
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

// Deliberately no leading-zero HOUR padding (unlike formatTime's 00:00:00) —
// the quick-action tile is much narrower than a full card, and stopwatch-
// style "1:23:45" comfortably fits where "01:23:45" would overflow. Minutes
// are always 2 digits though (00:45, not 0:45) — that place changes every
// minute, so leaving it unpadded made the pill's own digit count (and the
// button riding along with it) visibly hop by one character width on every
// single-to-double-digit rollover, not just the rare hour-gain crossing.
function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${s.toString().padStart(2, "0")}` : `${mm}:${s.toString().padStart(2, "0")}`;
}

function formatShortTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
