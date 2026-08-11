import { forwardRef, useRef, useState, type ReactNode } from "react";
import { Play, Pause, Check, X, HandHelping, Star } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { KIND_META } from "./DataToolbar";
import { useDurationChip, formatCompactTime } from "./DurationCard";
import { useRateChip } from "./RateCard";
import { useTimestampChip } from "./TimestampCard";
import { useTrialChip } from "./TrialCard";
import { useFrequencyChip } from "./FrequencyCard";
import { useRatingChip } from "./RatingCard";
import { useTaskAnalysisChip } from "./TaskAnalysisCard";
import { ACTION_BUTTON_COLORS } from "@/lib/actionButtonColors";
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

export interface BookmarkChipProps {
  card: CardConfig;
  /** False when this card is currently filtered out of the main list — a
   *  genuine unmount, not just scrolled off-screen (see getVisibleCards).
   *  Only Duration's chip needs this: starting a timer with nothing else
   *  mounted anywhere to tick it would silently do nothing. */
  mounted: boolean;
  /** Scrolls to and activates the given card on the Data tab — the same
   *  handleNavigateToCard used by notifications' own "View Card" — for
   *  cases the chip deliberately doesn't try to compress into itself (a
   *  Trial/Task Analysis step that needs a prompt-level picker). */
  onJumpToCard: (id: string) => void;
}

/** Dispatches to the one kind-specific chip component for this card —
 *  mirrors routes/index.tsx's own renderCard switch, and for the same
 *  reason: each branch is a distinct component so hooks stay unconditional
 *  within each (a card's `kind` never changes at runtime, but keeping each
 *  kind's useXChip call in its own component avoids ever having to reason
 *  about that). */
export function BookmarkChip({ card, mounted, onJumpToCard }: BookmarkChipProps) {
  switch (card.kind) {
    case "trial":
      return <TrialChip card={card} onJumpToCard={onJumpToCard} />;
    case "frequency":
      return <FrequencyChip card={card} />;
    case "rate":
      return <RateChip card={card} />;
    case "duration":
      return <DurationChip card={card} mounted={mounted} />;
    case "task-analysis":
      return <TaskAnalysisChip card={card} onJumpToCard={onJumpToCard} />;
    case "rating":
      return <RatingChip card={card} />;
    case "timestamp":
      return <TimestampChip card={card} />;
  }
}

const CHIP_TITLE_TIP = "Start a session to record data";

/** The chip's own compact tile — icon + 2-line title + a live value badge,
 *  ~72px tall x 96px wide per the plan's "smallest possible interface"
 *  requirement. `onClick` is either a direct single-tap action (Duration/
 *  Rate/Frequency, which only ever have one thing to do) or a Popover
 *  trigger (everything else, which needs to disambiguate between multiple
 *  buttons) — see the individual kind components below for which. */
interface ChipTileProps {
  onClick: () => void;
  icon: ReactNode;
  title: string;
  badge?: string;
  disabled?: boolean;
  /** Why this chip is disabled, shown as its title/tooltip — defaults to
   *  the generic "no active session" reason, but Duration's chip overrides
   *  it with a more specific one when that's not actually why (see
   *  DurationChip below). */
  disabledReason?: string;
  /** Border/badge accent reflecting the card's current scored state — e.g.
   *  green once a Trial's current slot reads "correct". Omitted (neutral)
   *  when there's no single current state to reflect, like Frequency's
   *  plain running tally. */
  statusColor?: "green" | "red" | "amber" | "blue" | null;
}

// forwardRef (not a plain function component taking an `anchorRef` prop) —
// ChipPopover below renders this as PopoverAnchor's `asChild` child, and
// Radix's Slot clones that child to attach ITS OWN ref for its own Popper
// positioning math. Slot's cloning only reaches a real DOM node through
// forwardRef; a plain function component silently swallows the ref (React
// warns "function components cannot be given refs"), leaving Radix's own
// positioning blind to where the anchor actually is — which is exactly
// what was sending every chip's popover off-screen before this fix.
const ChipTile = forwardRef<HTMLButtonElement, ChipTileProps>(function ChipTile(
  { onClick, icon, title, badge, disabled, disabledReason, statusColor },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? (disabledReason ?? CHIP_TITLE_TIP) : undefined}
      className={cn(
        "flex h-[72px] w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1 text-center transition-colors",
        statusColor === "green" && "border-green-300 bg-green-50",
        statusColor === "red" && "border-red-300 bg-red-50",
        statusColor === "amber" && "border-amber-300 bg-amber-50",
        statusColor === "blue" && "border-blue-300 bg-blue-50",
        !statusColor && "border-border bg-card hover:bg-stone-50",
        disabled && "opacity-40 cursor-not-allowed hover:bg-card",
      )}
    >
      <span className="text-stone-500">{icon}</span>
      <span className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground">
        {title}
      </span>
      {badge && (
        <span className="text-[10px] font-semibold text-stone-600 tabular-nums">{badge}</span>
      )}
    </button>
  );
});

/** Popover-backed counterpart to ChipTile's own direct-tap variant, for
 *  kinds whose chip needs to offer more than one action (so a plain tap
 *  can't say which one was meant) — same rotated-square-arrow idiom as
 *  TrialCard's own prompt-level picker and DataToolbar's filter popover. A
 *  reveal rather than growing the chip in place, so neighboring chips never
 *  reflow when one opens. */
function ChipPopover({
  icon,
  title,
  badge,
  disabled,
  statusColor,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: string;
  disabled?: boolean;
  statusColor?: "green" | "red" | "amber" | "blue" | null;
  /** Render-prop (not plain ReactNode) so the jump-to-card body can close
   *  the popover itself once it's navigated away — a plain Correct/Error
   *  tap deliberately leaves the popover open (multiple quick corrections
   *  in a row is the whole point), but "Open card" moving attention
   *  elsewhere on the page should close it behind you. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <ChipTile
          ref={anchorRef}
          onClick={() => setOpen((o) => !o)}
          icon={icon}
          title={title}
          badge={badge}
          disabled={disabled}
          statusColor={statusColor}
        />
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="bottom"
        align="center"
        sideOffset={8}
        // The chip anchor lives inside the bar's own overflow-x-auto scroll
        // strip — Radix/floating-ui's default collision boundary walks up
        // to the nearest scrollable ancestor, which is that strip (barely
        // taller than a chip itself), so without an explicit boundary it
        // was computing available space against THAT tiny box instead of
        // the viewport and placing the popover off-screen. Pointing it at
        // the doc body instead makes it collide-check against the real
        // viewport, same as every other popover in the app already gets by
        // default outside a scroll container.
        collisionBoundary={typeof document !== "undefined" ? document.body : undefined}
        collisionPadding={{ top: 8, bottom: 8, left: 8, right: 8 }}
        // z-[70]: matches TrialCard/DataToolbar's own popovers — the sticky
        // toolbar (z-[60], which this bar docks inside) would otherwise
        // paint over this once the chip sits near it.
        className="group z-[70] w-auto min-w-[9rem] rounded-2xl border-2 border-border bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        {children(() => setOpen(false))}
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-border bg-card",
            "-top-[7px] border-l-2 border-t-2",
            "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[7px]",
            "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
            "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Shared body for Trial/Task Analysis's chip when the current trial/step
 *  needs a prompt-level picker — deferred to the real card instead of
 *  reimplementing that picker in miniature (see useTrialChip/
 *  useTaskAnalysisChip's own comments on why). */
function JumpToCardBody({
  cardId,
  onJumpToCard,
  onClose,
}: {
  cardId: string;
  onJumpToCard: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-36 space-y-1.5 p-1">
      <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
        This one needs a prompt level — open the card to score it.
      </p>
      <button
        type="button"
        onClick={() => {
          onClose();
          onJumpToCard(cardId);
        }}
        className="w-full rounded-lg bg-blue-500 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-blue-600"
      >
        Open card
      </button>
    </div>
  );
}

function TrialChip({
  card,
  onJumpToCard,
}: {
  card: Extract<CardConfig, { kind: "trial" }>;
  onJumpToCard: (id: string) => void;
}) {
  const { current, currentResult, needsPromptLevelPicker, isMaxReached, setResult, canRecordData } =
    useTrialChip(card.id, card.maxTrials, card.minTrials, card.promptLevels);
  const disabled = !canRecordData || (isMaxReached && currentResult === null);
  const statusColor =
    currentResult === "correct"
      ? "green"
      : currentResult === "incorrect"
        ? "red"
        : currentResult === "no-response"
          ? "amber"
          : null;
  const Icon = KIND_META.trial.icon;
  return (
    <ChipPopover
      icon={<Icon className="size-4" />}
      title={card.title}
      badge={`Trial ${current + 1}`}
      disabled={disabled}
      statusColor={statusColor}
    >
      {(close) =>
        needsPromptLevelPicker ? (
          <JumpToCardBody cardId={card.id} onJumpToCard={onJumpToCard} onClose={close} />
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setResult("incorrect")}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                currentResult === "incorrect"
                  ? ACTION_BUTTON_COLORS.red.selectedClasses
                  : ACTION_BUTTON_COLORS.red.classes,
              )}
            >
              <X className="size-4" strokeWidth={3} />
            </button>
            {card.noResponse && (
              <button
                type="button"
                onClick={() => setResult("no-response")}
                className={cn(
                  "grid size-9 place-items-center rounded-full border transition-colors",
                  currentResult === "no-response"
                    ? ACTION_BUTTON_COLORS.amber.selectedClasses
                    : ACTION_BUTTON_COLORS.amber.classes,
                )}
              >
                <span className="text-xs font-semibold">–</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setResult("correct")}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                currentResult === "correct"
                  ? ACTION_BUTTON_COLORS.green.selectedClasses
                  : ACTION_BUTTON_COLORS.green.classes,
              )}
            >
              <Check className="size-4" strokeWidth={3} />
            </button>
          </div>
        )
      }
    </ChipPopover>
  );
}

function FrequencyChip({ card }: { card: Extract<CardConfig, { kind: "frequency" }> }) {
  const { count, increment, canRecordData } = useFrequencyChip(card.id);
  const Icon = KIND_META.frequency.icon;
  return (
    <ChipTile
      onClick={increment}
      icon={<Icon className="size-4" />}
      title={card.title}
      badge={`${count}`}
      disabled={!canRecordData}
    />
  );
}

function RateChip({ card }: { card: Extract<CardConfig, { kind: "rate" }> }) {
  const { count, increment, canRecordData } = useRateChip(card.id);
  const Icon = KIND_META.rate.icon;
  return (
    <ChipTile
      onClick={increment}
      icon={<Icon className="size-4" />}
      title={card.title}
      badge={`${count}`}
      disabled={!canRecordData}
    />
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
  // Distinguishes the two different reasons this chip can be disabled —
  // ChipTile's own default tooltip only covers "no active session," which
  // would otherwise misreport the real reason here whenever the session IS
  // active but this specific card just isn't mounted anywhere to tick it.
  const disabledReason = canRecordData && needsMount ? "Open this card to start timing" : undefined;
  return (
    <ChipTile
      onClick={toggle}
      icon={running ? <Pause className="size-4" /> : <Play className="size-4" />}
      title={card.title}
      badge={formatCompactTime(displayMs)}
      disabled={disabled}
      disabledReason={disabledReason}
      statusColor={running ? "blue" : null}
    />
  );
}

function TaskAnalysisChip({
  card,
  onJumpToCard,
}: {
  card: Extract<CardConfig, { kind: "task-analysis" }>;
  onJumpToCard: (id: string) => void;
}) {
  const {
    current,
    currentStatus,
    canScoreCurrent,
    needsPromptLevelPicker,
    setStep,
    canRecordData,
  } = useTaskAnalysisChip(card.id, card.steps.length, card.promptLevels);
  const disabled = !canRecordData || !canScoreCurrent;
  const statusColor =
    currentStatus === "independent"
      ? "green"
      : currentStatus === "error"
        ? "red"
        : currentStatus === "prompted"
          ? "amber"
          : null;
  const Icon = KIND_META["task-analysis"].icon;
  return (
    <ChipPopover
      icon={<Icon className="size-4" />}
      title={card.title}
      badge={`Step ${current + 1}/${card.steps.length}`}
      disabled={disabled}
      statusColor={statusColor}
    >
      {(close) =>
        needsPromptLevelPicker ? (
          <JumpToCardBody cardId={card.id} onJumpToCard={onJumpToCard} onClose={close} />
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setStep("error")}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                currentStatus === "error"
                  ? ACTION_BUTTON_COLORS.red.selectedClasses
                  : ACTION_BUTTON_COLORS.red.classes,
              )}
            >
              <X className="size-4" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => setStep("prompted")}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                currentStatus === "prompted"
                  ? ACTION_BUTTON_COLORS.amber.selectedClasses
                  : ACTION_BUTTON_COLORS.amber.classes,
              )}
            >
              <HandHelping className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setStep("independent")}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                currentStatus === "independent"
                  ? ACTION_BUTTON_COLORS.green.selectedClasses
                  : ACTION_BUTTON_COLORS.green.classes,
              )}
            >
              <Check className="size-4" strokeWidth={3} />
            </button>
          </div>
        )
      }
    </ChipPopover>
  );
}

function RatingChip({ card }: { card: Extract<CardConfig, { kind: "rating" }> }) {
  const { rating, min, max, pick, canRecordData } = useRatingChip(card.id, card.max, card.min);
  const stars = Array.from({ length: max - min }, (_, i) => min + i + 1);
  return (
    <ChipPopover
      icon={<Star className="size-4" />}
      title={card.title}
      badge={rating > 0 ? `${rating}/${max}` : undefined}
      disabled={!canRecordData}
    >
      {() => (
        <div className="flex max-w-[9rem] flex-wrap gap-1">
          {stars.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              aria-label={`Score ${value}`}
              className={cn(
                "grid size-7 place-items-center rounded-full border transition-colors",
                rating === value
                  ? ACTION_BUTTON_COLORS.amber.selectedClasses
                  : ACTION_BUTTON_COLORS.amber.classes,
              )}
            >
              <span className="text-[11px] font-semibold">{value}</span>
            </button>
          ))}
        </div>
      )}
    </ChipPopover>
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
  const statusColor =
    currentStatus === "correct" ? "green" : currentStatus === "incorrect" ? "red" : null;
  const Icon = KIND_META.timestamp.icon;
  return (
    <ChipPopover
      icon={<Icon className="size-4" />}
      title={card.title}
      badge={`Int ${currentIndex + 1}`}
      disabled={!canRecordData}
      statusColor={statusColor}
    >
      {() => (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => score("incorrect")}
            title={negativeLabel}
            className={cn(
              "grid size-9 place-items-center rounded-full border transition-colors",
              currentStatus === "incorrect"
                ? ACTION_BUTTON_COLORS.red.selectedClasses
                : ACTION_BUTTON_COLORS.red.classes,
            )}
          >
            <X className="size-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => score("correct")}
            title={positiveLabel}
            className={cn(
              "grid size-9 place-items-center rounded-full border transition-colors",
              currentStatus === "correct"
                ? ACTION_BUTTON_COLORS.green.selectedClasses
                : ACTION_BUTTON_COLORS.green.classes,
            )}
          >
            <Check className="size-4" strokeWidth={3} />
          </button>
        </div>
      )}
    </ChipPopover>
  );
}
