import type { ReactNode } from "react";
import { Check, X, HandHelping, CircleSlash2, Play, Pause, Minus, Plus } from "lucide-react";
import { renderBreakableTitle } from "./BreakableTitle";
import { ListActionBadge, ListActionButton } from "./ListRowActions";
import { useDurationChip, formatCompactTime } from "./DurationCard";
import { useRateChip } from "./RateCard";
import { useTimestampChip } from "./TimestampCard";
import { useTrialChip, ListPromptLevelButton } from "./TrialCard";
import { useFrequencyChip } from "./FrequencyCard";
import { useRatingChip, ListRatingButton } from "./RatingCard";
import { useTaskAnalysisChip, ListTaskAnalysisPromptLevelButton } from "./TaskAnalysisCard";
import { useChecklistChip, ListChecklistButton } from "./ChecklistCard";
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

export interface BookmarkChipProps {
  card: CardConfig;
  /** False when this card is currently filtered out of the main list — a
   *  genuine unmount, not just scrolled off-screen (see getVisibleCards).
   *  Only Duration's chip needs this: starting a timer with nothing else
   *  mounted anywhere to tick it would silently do nothing. */
  mounted: boolean;
  /** True when this card is the shared activeId — same highlight the main
   *  list's own CardShell/MiniTileShell already give the active card. */
  active: boolean;
  /** A single tap anywhere on the chip that isn't one of its own scoring
   *  controls (those all stopPropagation) — links the bar's own selection
   *  to the main list's, so activating a card from either place highlights
   *  the other and updates whichever drawer is open. Deliberately doesn't
   *  scroll the main list on its own (see routes/index.tsx's own
   *  suppression around this) — the whole point of the bar is not having
   *  to leave your place in it. */
  onSelect: () => void;
  /** A double tap — same discoverable idiom as DataToolbar's own
   *  "double-tap to clear filters" — scrolls the main list to and
   *  activates the real card, the deliberate escape hatch for when you do
   *  want to leave the bar and see the full card. */
  onJumpToCard: () => void;
}

/** Dispatches to the one kind-specific chip component for this card —
 *  mirrors routes/index.tsx's own renderCard switch, and for the same
 *  reason: each branch is a distinct component so hooks stay unconditional
 *  within each (a card's `kind` never changes at runtime, but keeping each
 *  kind's useXChip call in its own component avoids ever having to reason
 *  about that). */
export function BookmarkChip({ card, mounted, active, onSelect, onJumpToCard }: BookmarkChipProps) {
  switch (card.kind) {
    case "trial":
      return (
        <TrialChip card={card} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard} />
      );
    case "frequency":
      return (
        <FrequencyChip
          card={card}
          active={active}
          onSelect={onSelect}
          onJumpToCard={onJumpToCard}
        />
      );
    case "rate":
      return (
        <RateChip card={card} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard} />
      );
    case "duration":
      return (
        <DurationChip
          card={card}
          mounted={mounted}
          active={active}
          onSelect={onSelect}
          onJumpToCard={onJumpToCard}
        />
      );
    case "task-analysis":
      return (
        <TaskAnalysisChip
          card={card}
          active={active}
          onSelect={onSelect}
          onJumpToCard={onJumpToCard}
        />
      );
    case "rating":
      return (
        <RatingChip card={card} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard} />
      );
    case "timestamp":
      return (
        <TimestampChip
          card={card}
          active={active}
          onSelect={onSelect}
          onJumpToCard={onJumpToCard}
        />
      );
    case "checklist":
      return (
        <ChecklistChip
          card={card}
          active={active}
          onSelect={onSelect}
          onJumpToCard={onJumpToCard}
        />
      );
  }
}

/** Props every kind-specific chip component forwards straight through to
 *  ChipShell, unread itself. */
interface ChipSelectionProps {
  active: boolean;
  onSelect: () => void;
  onJumpToCard: () => void;
}

/** Shared shell: the card's title above its own kind's real data-logging
 *  controls below — no per-kind icon (removed to make room for those
 *  controls instead of a decorative glyph) and no popover reveal of its
 *  own. Every kind's controls are reused directly from the List display
 *  mode's own floating action row (see ListRowActions.tsx and each card's
 *  own exported List*Button), laid out the same way List mode arranges
 *  them too — the badge (tally/trial number) leftmost, then buttons in
 *  reading order. Rounded like a small grid tile (`rounded-[14px]` —
 *  MiniTileShell's own small-density radius, smaller than its large tile's
 *  18px), but wide enough (`w-36`) to fit a badge and the widest control
 *  row (Trial's with No Response, or Task Analysis's) on one line rather
 *  than wrapping — a wrapped second line read as broken/misaligned rather
 *  than intentional. `justify-end` on the row's own flex-1 wrapper keeps
 *  it pinned to a shared bottom edge regardless of title height: the
 *  strip's cross-axis stretch (`align-items: stretch`) matches every
 *  chip's box to its tallest sibling, and only the space above the row
 *  (not the row itself) absorbs that difference, so a 1-line and 2-line
 *  title still leave their control row starting at the same position
 *  instead of each sitting immediately under its own (differently tall)
 *  title. */
function ChipShell({
  title,
  active,
  onSelect,
  onJumpToCard,
  children,
}: { title: string; children: ReactNode } & ChipSelectionProps) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onJumpToCard}
      title="Double-tap to open the full card"
      className={cn(
        // select-none: without it, the double-tap that jumps to the full
        // card also selects the title text underneath it (an ordinary
        // double-click's own default browser behavior), flashing a text
        // selection highlight for a gesture that has nothing to do with
        // text at all.
        "flex w-36 shrink-0 cursor-pointer select-none flex-col gap-1 rounded-[14px] border px-2 py-1.5 transition-colors",
        active
          ? "border-blue-400/80 bg-card ring-2 ring-inset ring-blue-400/80"
          : "border-border bg-card opacity-80 hover:opacity-95",
      )}
    >
      <h3 className="line-clamp-2 w-full break-words text-[10.5px] font-medium leading-tight text-foreground">
        {renderBreakableTitle(title)}
      </h3>
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="flex items-center gap-1">{children}</div>
      </div>
    </div>
  );
}

function TrialChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "trial" }> } & ChipSelectionProps) {
  const {
    current,
    currentResult,
    currentPromptLevel,
    needsPromptLevelPicker,
    isMaxReached,
    setResult,
    pickPromptLevel,
    canRecordData,
  } = useTrialChip(card.id, card.maxTrials, card.minTrials, card.promptLevels);
  const disabled = !canRecordData || (isMaxReached && currentResult === null);
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListActionBadge value={current + 1} />
      {needsPromptLevelPicker ? (
        <ListPromptLevelButton
          levels={card.promptLevels!}
          selectedLevel={currentPromptLevel}
          selected={currentResult === "incorrect"}
          disabled={disabled}
          onPick={pickPromptLevel}
        />
      ) : (
        <ListActionButton
          icon={X}
          variant="red"
          selected={currentResult === "incorrect"}
          disabled={disabled}
          ariaLabel="Error"
          onClick={() => setResult("incorrect")}
        />
      )}
      {card.noResponse && (
        <ListActionButton
          icon={CircleSlash2}
          variant="amber"
          selected={currentResult === "no-response"}
          disabled={disabled}
          ariaLabel="No Response"
          onClick={() => setResult("no-response")}
        />
      )}
      <ListActionButton
        icon={Check}
        variant="green"
        selected={currentResult === "correct"}
        disabled={disabled}
        ariaLabel="Correct"
        onClick={() => setResult("correct")}
      />
    </ChipShell>
  );
}

function FrequencyChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "frequency" }> } & ChipSelectionProps) {
  const { count, increment, decrement, canRecordData } = useFrequencyChip(card.id);
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListActionBadge value={count} weight="bold" />
      <ListActionButton
        icon={Minus}
        variant="neutral"
        disabled={!canRecordData || count === 0}
        ariaLabel="Decrement"
        onClick={decrement}
      />
      <ListActionButton
        icon={Plus}
        variant="blue-solid"
        disabled={!canRecordData}
        ariaLabel="Increment"
        onClick={increment}
      />
    </ChipShell>
  );
}

function RateChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "rate" }> } & ChipSelectionProps) {
  const { count, increment, decrement, canRecordData } = useRateChip(card.id);
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListActionBadge value={count} weight="bold" />
      <ListActionButton
        icon={Minus}
        variant="neutral"
        disabled={!canRecordData || count === 0}
        ariaLabel="Decrement"
        onClick={decrement}
      />
      <ListActionButton
        icon={Plus}
        variant="blue-solid"
        disabled={!canRecordData}
        ariaLabel="Increment"
        onClick={increment}
      />
    </ChipShell>
  );
}

function DurationChip({
  card,
  mounted,
  active,
  onSelect,
  onJumpToCard,
}: {
  card: Extract<CardConfig, { kind: "duration" }>;
  mounted: boolean;
} & ChipSelectionProps) {
  const { running, displayMs, viewIdx, toggle, canRecordData } = useDurationChip(card.id);
  // Starting a timer with nothing mounted anywhere to tick it would
  // silently do nothing (see useDurationChip's own comment) — but stopping
  // an already-running one is always safe, since that just banks whatever
  // liveMs was last ticked to, regardless of who's mounted right now.
  const needsMount = !running && !mounted;
  const disabled = !canRecordData || needsMount;
  const disabledReason = canRecordData && needsMount ? "Open this card to start timing" : undefined;
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      {/* Same position-marker badge every other kind's chip leads with
          (Trial's trial number, Task Analysis's step number, ...) — the
          instance being viewed, not a tally, so `weight="regular"` (the
          colon-suffixed style) rather than "bold". */}
      <ListActionBadge value={viewIdx + 1} />
      {/* Same time-pill-plus-play/pause idea as the List row's own Duration
          pill (see DurationCard's listMode actions), just without that
          row's own TimeKeypad direct-edit affordance or instance
          navigation — the chip only ever shows/controls whichever instance
          is currently being viewed. */}
      <div
        className={cn(
          "flex items-stretch h-7 rounded-full overflow-hidden border-2 bg-white transition-colors",
          running ? "border-blue-500" : "border-border",
        )}
      >
        <span className="flex items-center justify-center px-2 text-[12px] font-bold tabular-nums min-w-[3rem]">
          {formatCompactTime(displayMs)}
        </span>
        <button
          type="button"
          // stopPropagation — same as every reused ListActionButton already
          // does — so toggling the timer doesn't also bubble up as a tap-
          // to-select on the chip's own root.
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          disabled={disabled}
          title={disabled ? (disabledReason ?? undefined) : undefined}
          aria-label={running ? "Pause" : "Start"}
          className="grid place-items-center w-7 text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 disabled:opacity-40"
        >
          {running ? (
            <Pause className="size-3" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="size-3 translate-x-px" fill="currentColor" strokeWidth={0} />
          )}
        </button>
      </div>
    </ChipShell>
  );
}

function TaskAnalysisChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "task-analysis" }> } & ChipSelectionProps) {
  const {
    current,
    currentStatus,
    currentPromptLevel,
    canScoreCurrent,
    needsPromptLevelPicker,
    setStep,
    pickPromptLevel,
    canRecordData,
  } = useTaskAnalysisChip(card.id, card.steps.length, card.promptLevels);
  const disabled = !canRecordData || !canScoreCurrent;
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListActionBadge value={current + 1} />
      <ListActionButton
        icon={X}
        variant="red"
        selected={currentStatus === "error"}
        disabled={disabled}
        ariaLabel="Error"
        onClick={() => setStep("error")}
      />
      {needsPromptLevelPicker ? (
        <ListTaskAnalysisPromptLevelButton
          levels={card.promptLevels!}
          selectedLevel={currentPromptLevel}
          selected={currentStatus === "prompted"}
          disabled={disabled}
          onPick={pickPromptLevel}
        />
      ) : (
        <ListActionButton
          icon={HandHelping}
          // Same thinning TaskAnalysisCard's own OPTIONS array applies to
          // this icon (see ListActionButton's own comment) — HandHelping
          // reads heavier than X/Check at the same strokeWidth.
          strokeWidth={1.75}
          variant="amber"
          selected={currentStatus === "prompted"}
          disabled={disabled}
          ariaLabel="Prompted"
          onClick={() => setStep("prompted")}
        />
      )}
      <ListActionButton
        icon={Check}
        variant="green"
        selected={currentStatus === "independent"}
        disabled={disabled}
        ariaLabel="Independent"
        onClick={() => setStep("independent")}
      />
    </ChipShell>
  );
}

function RatingChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "rating" }> } & ChipSelectionProps) {
  const { rating, min, max, pick, canRecordData } = useRatingChip(card.id, card.max, card.min);
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListRatingButton
        rating={rating}
        numStars={max - min}
        min={min}
        disabled={!canRecordData}
        onPick={pick}
      />
    </ChipShell>
  );
}

function ChecklistChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "checklist" }> } & ChipSelectionProps) {
  const { checked, toggle, checkedCount, canRecordData } = useChecklistChip(card.id, card.items);
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListChecklistButton
        items={card.items}
        checked={checked}
        checkedCount={checkedCount}
        disabled={!canRecordData}
        onToggle={toggle}
      />
    </ChipShell>
  );
}

function TimestampChip({
  card,
  active,
  onSelect,
  onJumpToCard,
}: { card: Extract<CardConfig, { kind: "timestamp" }> } & ChipSelectionProps) {
  const { currentIndex, currentStatus, score, canRecordData } = useTimestampChip(
    card.id,
    card.intervalMin,
    card.intervalCount,
  );
  const positiveLabel = card.positiveLabel ?? "Correct";
  const negativeLabel = card.negativeLabel ?? "Incorrect";
  return (
    <ChipShell title={card.title} active={active} onSelect={onSelect} onJumpToCard={onJumpToCard}>
      <ListActionBadge value={currentIndex + 1} />
      <ListActionButton
        icon={X}
        variant="red"
        selected={currentStatus === "incorrect"}
        disabled={!canRecordData}
        ariaLabel={negativeLabel}
        onClick={() => score("incorrect")}
      />
      <ListActionButton
        icon={Check}
        variant="green"
        selected={currentStatus === "correct"}
        disabled={!canRecordData}
        ariaLabel={positiveLabel}
        onClick={() => score("correct")}
      />
    </ChipShell>
  );
}
