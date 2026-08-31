import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge, ListActionButton, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { FrequencyIcon } from "./icons/FrequencyIcon";
import { NumberPadIcon } from "./icons/NumberPadIcon";
import { NumberKeypad } from "./NumberKeypad";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export interface FrequencyCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  minCount?: number;
  /** Interfering behaviors get zero counted as real, complete data the
   *  moment the session has actually run — see zeroCountsAsData below —
   *  since fewer (down to none) is the whole point of a reduction goal,
   *  unlike an acquisition target's minCount. */
  behaviorRole?: "interfering";
  isActive?: boolean;
  onActivate?: () => void;
}

/** Everything the bookmark bar's Frequency chip needs — `count` is a plain
 *  tap-driven tally, safe to write straight through the store even while
 *  the real FrequencyCard is also mounted elsewhere (no ticking effect to
 *  duplicate, unlike Duration/Rate/Interval). Mirrors the real card's own
 *  inc()/dec() exactly (including the floor-at-zero clamp and the distinct
 *  tallyUp/tallyDown sounds) so the chip's reused ListActionButton pair
 *  behaves identically to the List display mode's own Minus/Plus row. */
export function useFrequencyChip(cardKey: string) {
  const [count, setCount] = useCardState(cardKey, "count", 0);
  const { markDirty, canRecordData } = useCardSession();
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
  return { count, increment, decrement, canRecordData };
}

export function FrequencyCard({
  id,
  title,
  phase = "Intervention",
  description,
  minCount = 5,
  behaviorRole,
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
}: FrequencyCardProps) {
  const cardKey = id ?? title;
  const [count, setCount] = useCardState(cardKey, "count", 0);
  const [bumpKey, setBumpKey] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const { markDirty, resetSignal, canRecordData, hasElapsedTime } = useCardSession();
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setCount(0);
    setFlash(false);
    setBumpKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // For a reduction goal, zero is the desired outcome, not "nothing
  // happened here" — once there was real session time to observe it in,
  // a still-zero tally is complete, gradeable data in its own right,
  // same as Rate's own interfering-behavior cards already treat any
  // elapsed clock time (see RateCard's isComplete comment).
  const zeroCountsAsData = behaviorRole === "interfering" && hasElapsedTime;
  const isComplete = count >= minCount || zeroCountsAsData;
  useReportCardStatus(cardKey, count > 0 || zeroCountsAsData, isComplete, {
    title,
    kind: "frequency",
    value: `${count}`,
    unit: "Total Count",
  });
  const remaining = Math.max(0, minCount - count);

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
        details={
          <>
            <DrawerQuickFacts
              icon={<FrequencyIcon />}
              kind="frequency"
              dataTypeLabel="Frequency (count)"
              phase={phase}
              stats={[
                { label: "Minimum count", value: minCount },
                { label: "Tally", value: count },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="frequency"
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
              // No stopPropagation — tallying is this tile's own primary
              // data-entry action; tapping it on a not-yet-active tile
              // should select the tile in the same tap.
              onClick={dec}
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
              // No stopPropagation — see the Decrement button above.
              onClick={inc}
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
        {/* relative inline-flex wraps just the number — same technique as
            RateCard's own tile number: the keypad icon hangs off it via
            absolute positioning instead of sitting in normal flex flow, so
            its width doesn't shift the number off the tile's true center. */}
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
                // No stopPropagation — editing the count directly is a real
                // interaction with this tile's own data, same as the
                // increment/decrement buttons beside it.
                onClick={open}
                disabled={!canRecordData}
                className="relative cursor-text disabled:cursor-not-allowed"
                aria-label={`Current count is ${count}. Tap to edit.`}
              >
                <NumberPadIcon
                  className={cn(
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 transition-colors",
                    large ? "-left-4" : "-left-3.5",
                    isEditing ? "text-muted-foreground/40" : "text-blue-400",
                    large ? "size-3.5" : "size-3",
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
                      // text-[Npx] (arbitrary) has to come before leading-none
                      // here, not after — tailwind-merge treats an arbitrary
                      // text-size class as conflicting with leading-none and
                      // keeps whichever is LAST, so leading-none listed first
                      // was silently dropped from the rendered class list,
                      // leaving this number a taller-than-intended default
                      // line-height and throwing off its vertical centering
                      // against Trial/Rate's own tile number.
                      "block font-display tabular-nums",
                      large ? "text-[38px]" : "text-[28px]",
                      "leading-none",
                      flash ? "text-blue-600" : "text-foreground",
                    )}
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
              </button>
            )}
          </NumberKeypad>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<FrequencyIcon />}
        kind="frequency"
        dataTypeLabel="Frequency"
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
              icon={<FrequencyIcon />}
              kind="frequency"
              dataTypeLabel="Frequency (count)"
              phase={phase}
              stats={[
                { label: "Minimum count", value: minCount },
                { label: "Tally", value: count },
              ]}
            />
            {(teachingProcedure || description) && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  description={description}
                  data={teachingProcedure}
                  kind="frequency"
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
                  aria-label={`Current count is ${count}. Tap to edit.`}
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
    <CardShell
      title={title}
      phase={phase}
      dataType="Frequency"
      dataTypeIcon={<FrequencyIcon />}
      kind="frequency"
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
      isComplete={isComplete}
      helperText={
        isComplete ? (
          "Minimum count reached. This data can now be graphed."
        ) : (
          <span>
            Record at least <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "occurrence" : "occurrences"}.
          </span>
        )
      }
      details={
        <>
          <DrawerQuickFacts
            icon={<FrequencyIcon />}
            kind="frequency"
            dataTypeLabel="Frequency (count)"
            phase={phase}
            stats={[
              { label: "Minimum count", value: minCount },
              { label: "Tally", value: count },
            ]}
          />
          {(teachingProcedure || description) && (
            <div className="mt-4">
              <TeachingProcedureAccordion
                description={description}
                data={teachingProcedure}
                kind="frequency"
              />
            </div>
          )}
        </>
      }
    >
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={dec}
          disabled={count === 0}
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
            <button
              type="button"
              onClick={open}
              disabled={!canRecordData}
              className="flex flex-col items-center justify-center min-w-[6rem] cursor-text rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={`Current count is ${count}. Tap to edit.`}
            >
              <div className="relative">
                <NumberPadIcon
                  className={cn(
                    "pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 size-3 transition-opacity",
                    isEditing ? "opacity-0" : "text-blue-400 opacity-100",
                  )}
                  aria-hidden
                />
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
              <span
                className={cn(
                  "mt-1 text-[11px] uppercase tracking-wider transition-colors",
                  isEditing ? "text-blue-500" : "text-muted-foreground",
                )}
              >
                Instances
              </span>
            </button>
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
  );
}
