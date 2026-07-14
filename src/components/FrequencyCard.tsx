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
import { cn } from "@/lib/utils";

export interface FrequencyCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  minCount?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

export function FrequencyCard({
  id,
  title,
  phase = "Intervention",
  description,
  minCount = 5,
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
}: FrequencyCardProps) {
  const cardKey = id ?? title;
  const [count, setCount] = useCardState(cardKey, "count", 0);
  const [bumpKey, setBumpKey] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const { markDirty, resetSignal, sessionRunning } = useCardSession();
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setCount(0);
    setFlash(false);
    setBumpKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  const isComplete = count >= minCount;
  useReportCardStatus(cardKey, count > 0, isComplete);
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
        details={
          <>
            <DrawerQuickFacts
              icon={<FrequencyIcon />}
              dataTypeLabel="Frequency (count)"
              phase={phase}
              stats={[
                { label: "Minimum count", value: minCount },
                { label: "Recorded", value: count },
              ]}
            />
            {teachingProcedure && (
              <div className="mt-4">
                <TeachingProcedureAccordion data={teachingProcedure} kind="frequency" />
              </div>
            )}
          </>
        }
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2.5" : "gap-1.5")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dec();
              }}
              disabled={!sessionRunning || count === 0}
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
              disabled={!sessionRunning}
              aria-label="Increment"
              className={cn(
                "btn-bevel-solid shrink-0 rounded-full grid place-items-center text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
              )}
            >
              <Plus className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
          </div>
        }
      >
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
              disabled={!sessionRunning}
              className="cursor-text disabled:cursor-not-allowed"
              aria-label={`Current count is ${count}. Tap to edit.`}
            >
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
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<FrequencyIcon />}
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
        toolbarHeight={toolbarHeight}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
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
                  disabled={!sessionRunning}
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
              disabled={!sessionRunning || count === 0}
              ariaLabel="Decrement"
              onClick={dec}
            />
            <ListActionButton
              icon={Plus}
              variant="blue-solid"
              disabled={!sessionRunning}
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
            dataTypeLabel="Frequency (count)"
            phase={phase}
            stats={[
              { label: "Minimum count", value: minCount },
              { label: "Recorded", value: count },
            ]}
          />
          {teachingProcedure && (
            <div className="mt-4">
              <TeachingProcedureAccordion data={teachingProcedure} kind="frequency" />
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
              <button
              type="button"
              onClick={open}
              disabled={!sessionRunning}
              className="flex flex-col items-center justify-center min-w-[6rem] cursor-text rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={`Current count is ${count}. Tap to edit.`}
            >
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
                  <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-blue-400/80" aria-hidden />
                )}
                <NumberPadIcon
                  className={cn(
                    "pointer-events-none absolute -right-3.5 -top-1 size-3 transition-colors",
                    isEditing ? "text-blue-400" : "text-muted-foreground/50",
                  )}
                  aria-hidden
                />
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
          disabled={!sessionRunning}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "btn-bevel-solid size-14 shrink-0 aspect-square rounded-full grid place-items-center text-white transition-colors disabled:opacity-40",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-6" strokeWidth={3} />
        </motion.button>
      </div>
    </CardShell>
  );
}
