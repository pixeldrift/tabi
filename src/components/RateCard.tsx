import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link2, Minus, Pause, Play, Plus } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { MiniTileShell } from "./MiniTileShell";
import { useCardState, useResetGuard } from "./CardDataStore";
import { NumberPadIcon, RateIcon } from "./icons/DataTypeIcons";
import { NumberKeypad } from "./NumberKeypad";
import { TimeKeypad } from "./TimeKeypad";
import { useCardSession, useRegisterActiveTimer, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export interface RateCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Required observation window, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
  /** When true, the timer is linked to the session timer: no play/pause, lock icon, gray display. */
  locked?: boolean;
}

export function RateCard({
  id,
  title,
  phase = "Intervention",
  description,
  minDurationSec = 60,
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
  locked = false,
  tileDensity,
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
  const { markDirty, resetSignal } = useCardSession();
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
  useReportCardStatus(cardKey, count > 0 || elapsed > 0, elapsed / 1000 >= minDurationSec);

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
  };
  const dec = () => {
    setDir(-1);
    setCount((c) => Math.max(0, c - 1));
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
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
              <Row label="Data type" value="Rate (per minute)" />
              <Row label="Required window" value={`${minDurationSec}s`} />
              <Row label="Count" value={String(count)} />
              <Row label="Elapsed" value={formatTime(elapsed)} />
            </dl>
          }
          actions={
            <div className={cn("flex items-center justify-center", large ? "gap-2.5" : "gap-1.5")}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dec();
                }}
                disabled={count === 0}
                aria-label="Decrement"
                className={cn(
                  "btn-bevel shrink-0 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 active:scale-95 transition disabled:opacity-30",
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
                aria-label="Increment"
                className={cn(
                  "btn-bevel-solid shrink-0 rounded-full grid place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
                  large ? "size-[42px]" : "size-7",
                )}
              >
                <Plus className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
              </button>
            </div>
          }
        >
          {/* The pulsing stopwatch is absolutely positioned off to the left
              rather than sharing flex flow with the number, so the number's
              own box — not the icon+number pair — is what ends up centered
              in the tile (matching the full card's own centered count). */}
          <div className="relative inline-flex items-center">
            {ticking && (
              <RateIcon
                className={cn(
                  "absolute right-full top-1/2 -translate-y-1/2 text-blue-500 animate-pulse-scale",
                  large ? "size-5 mr-[7px]" : "size-[15px] mr-[5px]",
                )}
              />
            )}
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
          </div>
        </MiniTileShell>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="w-full max-w-md scroll-mt-32">
    <CardShell
      title={title}
      phase={phase}
      dataType="Rate / Min"
      dataTypeIcon={<RateIcon />}
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
      editing={editing}
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Rate (per minute)" />
          <Row label="Required window" value={`${minDurationSec}s`} />
          <Row label="Count" value={String(count)} />
          <Row label="Elapsed" value={formatTime(elapsed)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={dec}
          disabled={count === 0}
          aria-label="Decrement"
          className="btn-bevel size-12 shrink-0 aspect-square rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
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
                className="relative overflow-hidden rounded-lg px-2 py-0.5 cursor-text"
                aria-label={`Current tally is ${count}. Tap to edit.`}
              >
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
                  <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-blue-400/80" aria-hidden />
                )}
                <NumberPadIcon
                  className={cn(
                    "pointer-events-none absolute -right-3.5 -top-1 size-3 transition-colors",
                    isEditing ? "text-blue-400" : "text-muted-foreground/50",
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors",
                  isEditing ? "text-blue-500" : "text-muted-foreground",
                )}
              >
                <span>{count === 1 ? "Time in" : "Times in"}</span>
                <span className="inline-flex items-center">
                  {locked ? (
                    <>
                      <span
                        aria-label="Elapsed time (linked to session)"
                        className="inline-flex items-center border border-stone-300 bg-stone-100 pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full text-muted-foreground"
                      >
                        {formatTime(elapsed)}
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
                            aria-label="Edit elapsed time"
                            className={cn(
                              "inline-flex items-center border border-blue-500 bg-white pl-1.5 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums normal-case tracking-normal rounded-l-full cursor-text hover:bg-blue-50 transition-colors",
                              running ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {formatTime(elapsed)}
                          </button>
                        )}
                      </TimeKeypad>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle();
                        }}
                        aria-label={running ? "Pause timer" : "Resume timer"}
                        className="btn-bevel grid size-5 place-items-center rounded-r-full bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors"
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
            </div>
          )}
        </NumberKeypad>


        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "btn-bevel-solid size-14 shrink-0 aspect-square rounded-full grid place-items-center text-white transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-6" strokeWidth={3} />
        </motion.button>
      </div>
    </CardShell>
    </div>
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
