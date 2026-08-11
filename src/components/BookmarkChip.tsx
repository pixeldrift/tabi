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
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

export interface BookmarkChipProps {
  card: CardConfig;
  /** False when this card is currently filtered out of the main list — a
   *  genuine unmount, not just scrolled off-screen (see getVisibleCards).
   *  Only Duration's chip needs this: starting a timer with nothing else
   *  mounted anywhere to tick it would silently do nothing. */
  mounted: boolean;
}

/** Dispatches to the one kind-specific chip component for this card —
 *  mirrors routes/index.tsx's own renderCard switch, and for the same
 *  reason: each branch is a distinct component so hooks stay unconditional
 *  within each (a card's `kind` never changes at runtime, but keeping each
 *  kind's useXChip call in its own component avoids ever having to reason
 *  about that). */
export function BookmarkChip({ card, mounted }: BookmarkChipProps) {
  switch (card.kind) {
    case "trial":
      return <TrialChip card={card} />;
    case "frequency":
      return <FrequencyChip card={card} />;
    case "rate":
      return <RateChip card={card} />;
    case "duration":
      return <DurationChip card={card} mounted={mounted} />;
    case "task-analysis":
      return <TaskAnalysisChip card={card} />;
    case "rating":
      return <RatingChip card={card} />;
    case "timestamp":
      return <TimestampChip card={card} />;
  }
}

/** Shared shell: the card's title above its own kind's real data-logging
 *  controls below — no per-kind icon (removed to make room for those
 *  controls instead of a decorative glyph) and no popover reveal of its
 *  own. Every kind's controls are reused directly from the List display
 *  mode's own floating action row (see ListRowActions.tsx and each card's
 *  own exported List*Button) — a plain direct-tap action for Frequency/
 *  Rate/Duration, or an already-self-contained mini-popover button for the
 *  cases that need to disambiguate (Trial/Task Analysis's prompt-level
 *  picker, Rating's star picker), same as a List row already gets. Width
 *  is fixed (not content-sized) so the bar's chips read as a uniform
 *  scrollable row rather than jumping around per kind — sized to
 *  comfortably fit the widest control row (Trial's badge + up to 3
 *  buttons). */
function ChipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-36 shrink-0 flex-col items-start gap-1.5 rounded-xl border border-border bg-card px-2 py-1.5">
      <h3 className="line-clamp-2 w-full break-words text-[11px] font-medium leading-tight text-foreground">
        {renderBreakableTitle(title)}
      </h3>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function TrialChip({ card }: { card: Extract<CardConfig, { kind: "trial" }> }) {
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
    <ChipShell title={card.title}>
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

function FrequencyChip({ card }: { card: Extract<CardConfig, { kind: "frequency" }> }) {
  const { count, increment, decrement, canRecordData } = useFrequencyChip(card.id);
  return (
    <ChipShell title={card.title}>
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

function RateChip({ card }: { card: Extract<CardConfig, { kind: "rate" }> }) {
  const { count, increment, decrement, canRecordData } = useRateChip(card.id);
  return (
    <ChipShell title={card.title}>
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
}: {
  card: Extract<CardConfig, { kind: "duration" }>;
  mounted: boolean;
}) {
  const { running, displayMs, toggle, canRecordData } = useDurationChip(card.id);
  // Starting a timer with nothing mounted anywhere to tick it would
  // silently do nothing (see useDurationChip's own comment) — but stopping
  // an already-running one is always safe, since that just banks whatever
  // liveMs was last ticked to, regardless of who's mounted right now.
  const needsMount = !running && !mounted;
  const disabled = !canRecordData || needsMount;
  const disabledReason = canRecordData && needsMount ? "Open this card to start timing" : undefined;
  return (
    <ChipShell title={card.title}>
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
          onClick={toggle}
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

function TaskAnalysisChip({ card }: { card: Extract<CardConfig, { kind: "task-analysis" }> }) {
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
    <ChipShell title={card.title}>
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

function RatingChip({ card }: { card: Extract<CardConfig, { kind: "rating" }> }) {
  const { rating, min, max, pick, canRecordData } = useRatingChip(card.id, card.max, card.min);
  return (
    <ChipShell title={card.title}>
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

function TimestampChip({ card }: { card: Extract<CardConfig, { kind: "timestamp" }> }) {
  const { currentIndex, currentStatus, score, canRecordData } = useTimestampChip(
    card.id,
    card.intervalMin,
    card.intervalCount,
  );
  const positiveLabel = card.positiveLabel ?? "Correct";
  const negativeLabel = card.negativeLabel ?? "Incorrect";
  return (
    <ChipShell title={card.title}>
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
