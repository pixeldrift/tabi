import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause } from "lucide-react";
import { CardShell } from "./CardShell";
import { DurationIcon } from "./icons/DataTypeIcons";
import { TimeKeypad } from "./TimeKeypad";
import { useCardSession, useRegisterActiveTimer, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

const PULSE_BEAT_MS = 1000;

export interface DurationCardProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Minimum cumulative duration, in seconds. */
  minDurationSec?: number;
  isActive?: boolean;
  onActivate?: () => void;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
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
  detailsOpen,
  onDetailsOpenChange,
}: DurationCardProps) {
  const [instances, setInstances] = useState<number[]>([0]);
  const [viewIdx, setViewIdx] = useState(0);
  const [liveMs, setLiveMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const runningIdxRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const { sessionRunning, getElapsedMsNow, subscribeTick } = useSession();
  const { markDirty, resetSignal } = useCardSession();
  useRegisterActiveTimer({ id: `duration:${title}`, label: title, active: running && sessionRunning, elementRef: cardRef, source: "duration", onActivate });
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

  useEffect(() => {
    if (resetSignal === 0) return;
    clearPendingStart();
    setInstances([0]);
    setViewIdx(0);
    setLiveMs(0);
    setRunning(false);
    runningIdxRef.current = null;
  }, [resetSignal]);


  // Tick in unison with the master session timer.
  useEffect(() => {
    if (!running || !sessionRunning) return;
    return subscribeTick((d) => setLiveMs((ms) => ms + d));
  }, [running, sessionRunning, subscribeTick]);

  const instanceMs = (idx: number) => {
    if (idx < 0 || idx >= instances.length) return 0;
    if (running && runningIdxRef.current === idx) {
      return instances[idx] + liveMs;
    }
    return instances[idx];
  };

  const totalMs = instances.reduce((a, b) => a + b, 0) + (running ? liveMs : 0);
  const totalSec = totalMs / 1000;
  const isComplete = totalSec >= minDurationSec;
  const remaining = Math.max(0, Math.ceil(minDurationSec - totalSec));
  useReportCardStatus(id ?? title, totalMs > 0, isComplete);

  const flushLive = () => {
    if (running && runningIdxRef.current !== null) {
      const idx = runningIdxRef.current;
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
      runningIdxRef.current = null;
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
    if (running && runningIdxRef.current === idx) {
      const wasLast = idx === instances.length - 1;
      flushLive();
      setRunning(false);
      runningIdxRef.current = null;
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
        runningIdxRef.current = null;
      }
      setViewIdx(idx);
      const msUntilNextSecond = 1000 - (getElapsedMsNow() % 1000 || 1000);
      pendingStartRef.current = window.setTimeout(() => {
        pendingStartRef.current = null;
        runningIdxRef.current = idx;
        setRunning(true);
        setPulseDelayMs(-(getElapsedMsNow() % PULSE_BEAT_MS));
      }, msUntilNextSecond);
    }
  };

  const togglePause = () => toggleInstance(viewIdx);

  const setInstanceMs = (idx: number, ms: number) => {
    markDirty();
    if (running && runningIdxRef.current === idx) {
      flushLive();
      setRunning(false);
      runningIdxRef.current = null;
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

  const isViewingRunning = running && runningIdxRef.current === viewIdx;
  const isIdxRunning = (i: number) => running && runningIdxRef.current === i;
  const isActivated = (i: number) => instances[i] > 0 || isIdxRunning(i);

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
      detailsOpen={detailsOpen}
      onDetailsOpenChange={onDetailsOpenChange}
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
            return (
              <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span
                  className={cn(
                    "grid place-items-center size-6 rounded-full text-[11px] font-medium shrink-0 transition-colors",
                    isRunning
                      ? "bg-blue-500 text-white"
                      : hasData
                        ? "bg-blue-100 text-blue-700"
                        : "bg-stone-100 text-foreground/60",
                  )}
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
                      aria-label={`Edit time for instance ${i + 1}`}
                      className={cn(
                        "flex-1 text-left tabular-nums text-sm rounded-md transition-colors hover:text-blue-600",
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
                  aria-label={isRunning ? "Pause this instance" : "Start this instance"}
                  className={cn(
                    "btn-bevel grid size-7 shrink-0 place-items-center rounded-full text-white transition-colors",
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
              style={{ gap: GAP, translateY: "-50%" }}
              animate={{ x: trackOffset }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
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
              {instances.filter((v, i) => v > 0 || (running && runningIdxRef.current === i)).length}
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
  onToggle,
  onEditTime,
  pulseStyle,
}: {
  index: number;
  ms: number;
  running: boolean;
  activated: boolean;
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
                className={cn(
                  "font-display text-2xl tabular-nums leading-none transition-colors",
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
        aria-label={running ? "Pause this instance" : "Start this instance"}
        className="btn-bevel grid w-12 place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
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

function formatShortTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
