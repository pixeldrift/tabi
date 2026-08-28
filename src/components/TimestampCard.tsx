import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Stamp } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { HORIZONTAL_FADE_MASK } from "./IntervalCard";
import { cn } from "@/lib/utils";

export interface TimestampCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
}

function formatStampTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatStampDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  // the color change is instant on tap, then re-enables it once flash clears
  // so the fade-back is a smooth 700ms ease rather than an instant snap.
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  const logNow = () => {
    if (!canRecordData) return;
    markDirty();
    const ts = Date.now();
    setEntries((prev) => [...prev, ts]);
    setViewIdx(entries.length);
    setFlash(true);
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 450);
  };

  const goTo = (idx: number) => {
    setViewIdx(Math.max(0, Math.min(entries.length - 1, idx)));
  };

  const hasData = entries.length > 0;
  useReportCardStatus(cardKey, hasData, hasData, {
    title,
    kind: "timestamp",
    value: String(entries.length),
    unit: entries.length === 1 ? "Entry" : "Entries",
  });

  const viewedEntry = entries[viewIdx];
  // Most recent few entries, oldest first so they read left-to-right in
  // the order they actually happened, nearest one sitting right next to
  // the live pill they just "peeled off" of.
  const recent = entries.slice(-4);

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
      >
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "font-display font-bold tabular-nums leading-none",
              large ? "text-2xl" : "text-lg",
            )}
          >
            {entries.length}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              logNow();
            }}
            disabled={!canRecordData}
            aria-label="Log now"
            className={cn(
              "btn-bevel grid place-items-center rounded-full text-white transition-colors active:scale-95 disabled:opacity-40",
              "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
              large ? "size-10" : "size-8",
            )}
          >
            <Stamp className={large ? "size-4" : "size-3.5"} />
          </button>
        </div>
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
                <span className="flex-1 tabular-nums text-sm text-foreground/80">
                  {formatStampTime(ts)}
                </span>
                <span className="tabular-nums text-sm text-muted-foreground shrink-0">
                  {formatStampDate(ts)}
                </span>
              </li>
            ))}
          </ol>
        }
      >
        <div className="relative px-2 pt-2 pb-4">
          <div className="flex flex-col items-center gap-1">
            <span
              style={{ transition: flash ? "none" : "color 700ms ease-out" }}
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                flash ? "text-blue-600" : "text-muted-foreground",
              )}
            >
              {formatStampDate(now)}
            </span>
            <div className="flex items-center gap-2 w-full">
              {/* The last few stamped entries, fading out toward the left
                  edge (same HORIZONTAL_FADE_MASK IntervalCard's own timeline
                  already uses) — a newly logged entry appears right next to
                  the live pill and pushes the older ones left as it lands,
                  reading as "peeling off" the live pill into a short
                  history. */}
              <div className="flex-1 min-w-0 overflow-hidden" style={HORIZONTAL_FADE_MASK}>
                <div className="flex items-center justify-end gap-1.5 px-1">
                  <AnimatePresence initial={false}>
                    {recent.map((ts, i) => {
                      const isNewest = i === recent.length - 1;
                      return (
                        <motion.div
                          key={ts}
                          layout
                          initial={{ opacity: 0, x: 20, scale: 0.85 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          style={{
                            transition:
                              isNewest && flash
                                ? "none"
                                : "color 700ms ease-out, background-color 700ms ease-out, border-color 700ms ease-out",
                          }}
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium tabular-nums whitespace-nowrap",
                            isNewest && flash
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-stone-200 bg-stone-50 text-muted-foreground",
                          )}
                        >
                          {formatStampTime(ts)}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
              <div className="shrink-0 flex items-stretch rounded-full border-2 border-border bg-white overflow-hidden h-[52px] w-[190px]">
                <div className="flex-1 flex items-center gap-2 pl-2 pr-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-300 text-white text-xs font-semibold tabular-nums">
                    {entries.length + 1}
                  </span>
                  <span
                    style={{ transition: flash ? "none" : "color 700ms ease-out" }}
                    className={cn(
                      "flex-1 text-center font-display text-lg tabular-nums leading-none",
                      flash ? "text-blue-600" : "text-stone-400",
                    )}
                  >
                    {formatStampTime(now)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logNow}
            disabled={!canRecordData}
            className="btn-bevel mt-3 flex items-center justify-center gap-1.5 rounded-full h-9 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95 disabled:opacity-40"
          >
            Log Now
            <Stamp className="size-3.5" />
          </button>

          <div className="relative mt-3 h-10 flex items-center justify-center">
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
            {hasData && viewedEntry !== undefined ? (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">
                Entry{" "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {viewIdx + 1}
                </span>{" "}
                of{" "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {entries.length}
                </span>
                {" — "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {formatStampTime(viewedEntry)}
                </span>
                {" · "}
                <span className="normal-case tracking-normal tabular-nums text-foreground">
                  {formatStampDate(viewedEntry)}
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
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-9 text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "left-0" : "right-0",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
        {isLeft ? (
          <path d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z" />
        ) : (
          <path d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z" />
        )}
      </svg>
    </motion.button>
  );
}
