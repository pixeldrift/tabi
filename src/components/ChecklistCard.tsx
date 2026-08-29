import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { ChecklistIcon } from "./icons/ChecklistIcon";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  label: string;
  /** Secondary detail revealed under this item only in the card's own
   *  expanded view (see ChecklistRow's own `showDescription`) — omit for an
   *  item with nothing more to say than its own label. */
  description?: string;
}

export interface ChecklistCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  items: ChecklistItem[];
  isActive?: boolean;
  onActivate?: () => void;
}

/** Everything the bookmark bar's Checklist chip needs — `checked` is a
 *  plain boolean-per-item array (no running trial list, same "single
 *  overwritable state" shape RatingCard's own chip hook uses), safe to
 *  write straight through the store even while the real ChecklistCard is
 *  also mounted elsewhere. Indexes past the persisted array's own current
 *  length (e.g. an item added after this session's first check) read as
 *  unchecked rather than throwing. */
export function useChecklistChip(cardKey: string, items: ChecklistItem[]) {
  const [checked, setChecked] = useCardState<boolean[]>(cardKey, "checked", () =>
    items.map(() => false),
  );
  const { markDirty, canRecordData } = useCardSession();
  const toggle = (index: number) => {
    markDirty();
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };
  const checkedCount = items.reduce((n, _, i) => n + (checked[i] ? 1 : 0), 0);
  const reset = () => setChecked(items.map(() => false));
  return { checked, toggle, checkedCount, canRecordData, reset };
}

/** One checklist row's own square box — deliberately square, not
 *  `rounded-full`, so it reads as a real checkbox rather than another of
 *  this app's usual circular toggle pills, while still using the exact same
 *  blue-500/btn-bevel "on" language every other filled control here already
 *  does. A small fixed pixel radius rather than the theme's own `rounded-md`
 *  (14px, this app's `--radius` runs large) — at this box's small size that
 *  scale rounds every corner into a full circle instead of a square one, so
 *  a literal value is used to stay square regardless of the shared theme's
 *  own radius. Purely presentational; the actual tap target is the whole
 *  row button around it (see ChecklistRow). */
function ChecklistBox({ checked, size = "size-5" }: { checked: boolean; size?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px] border-2 transition-colors",
        size,
        checked
          ? "btn-bevel bg-blue-500 border-blue-600 text-white"
          : // A visible white-on-gray outline, not the old dimmed gray-on-gray
            // fill — that read as a disabled control rather than an empty one
            // waiting to be tapped, the same problem IntervalCard's own idle
            // Correct/Incorrect buttons avoid by staying light-tinted rather
            // than grayscale.
            "border-stone-300 bg-white",
      )}
    >
      {/* Always rendered, not just once checked — a faint checkmark on an
       *  otherwise-empty box is what tells you it's a real checkbox to tap,
       *  rather than a plain decorative square. */}
      <Check className={cn("size-3.5", !checked && "text-stone-400")} strokeWidth={3} />
    </span>
  );
}

/** One item row, shared by the card's own standard/expanded views — the
 *  only difference between them is `showDescription`, not the interaction
 *  itself (tapping anywhere on the row toggles it either way). */
function ChecklistRow({
  item,
  checked,
  disabled,
  showDescription,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  disabled?: boolean;
  showDescription: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className="flex w-full flex-col rounded-lg px-1 py-1 text-left transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
    >
      {/* items-center (not items-start) so the box lands on the label's own
       *  line — its own line box sits close enough to that single line's
       *  x-height to read as centered on the text, not the whole row,
       *  which matters once a description line is showing underneath. */}
      <span className="flex w-full items-center gap-2.5">
        <ChecklistBox checked={checked} />
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug",
            checked ? "text-foreground" : "text-foreground/80",
          )}
        >
          {item.label}
        </span>
      </span>
      {showDescription && item.description && (
        // Indented to align under the label, not the box — size-5 box
        // (1.25rem) + the row's own gap-2.5 (0.625rem).
        <span className="mt-0.5 block pl-[1.875rem] text-xs leading-snug text-muted-foreground">
          {item.description}
        </span>
      )}
    </button>
  );
}

export function ChecklistCard({
  id,
  title,
  phase = "Intervention",
  description,
  items,
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
}: ChecklistCardProps) {
  const cardKey = id ?? title;
  const { checked, toggle, checkedCount, canRecordData, reset } = useChecklistChip(cardKey, items);
  const [expanded, setExpanded] = useState(false);
  // Which item the grid tile's own one-at-a-time view is showing — only
  // that density needs this (List/Card mode already show every item at
  // once), same "current" idea as TaskAnalysisCard's own per-instance
  // stepper, just without the instance dimension checklists don't have.
  const [current, setCurrent] = useCardState(cardKey, "current", 0);
  const goTo = (idx: number) => setCurrent(Math.max(0, Math.min(idx, items.length - 1)));
  const { resetSignal } = useCardSession();
  // Checking anything at all is the whole of "has this been touched" — same
  // "picked or not, nothing partial" reasoning RatingCard's own hasData/
  // isComplete collapse to (see docs/CARD-TYPES.md §4): a checklist has no
  // natural minimum to fall short of, every item is independently optional.
  useReportCardStatus(cardKey, checkedCount > 0, checkedCount > 0, {
    title,
    kind: "checklist",
    value: `${checkedCount}/${items.length}`,
    unit: "Checked",
  });
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    reset();
    setCurrent(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // Tile-only: check the currently-viewed item, then — mirroring
  // TaskAnalysisCard's own setStep(advance) — auto-advance to the next one
  // shortly after, but only on a genuine check, not on toggling one back
  // off (nothing to "move on" from there).
  const checkCurrentAndAdvance = () => {
    const wasChecked = Boolean(checked[current]);
    toggle(current);
    if (!wasChecked) {
      window.setTimeout(() => goTo(current + 1), 260);
    }
  };

  const percent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const summary = `${checkedCount} of ${items.length} checked · ${percent}%`;

  const quickFacts = (
    <DrawerQuickFacts
      icon={<ChecklistIcon />}
      kind="checklist"
      dataTypeLabel="Checklist"
      phase={phase}
      stats={[
        { label: "Items", value: items.length },
        { label: "Checked", value: `${checkedCount} / ${items.length}` },
      ]}
    />
  );
  const teachingBlock = (teachingProcedure || description) && (
    <div className="mt-4">
      <TeachingProcedureAccordion
        description={description}
        data={teachingProcedure}
        kind="checklist"
      />
    </div>
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
        progress={percent}
        isComplete={checkedCount > 0}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={
          <>
            {quickFacts}
            {teachingBlock}
          </>
        }
        actions={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              checkCurrentAndAdvance();
            }}
            disabled={!canRecordData}
            aria-label={checked[current] ? "Uncheck item" : "Check item"}
            className={cn(
              "shrink-0 rounded-[9px] grid place-items-center border-2 transition-colors disabled:opacity-40",
              large ? "size-10" : "size-7",
              checked[current]
                ? "btn-bevel bg-blue-500 border-blue-600 text-white"
                : // Same "not yet scored" treatment as ChecklistBox.
                  "border-stone-300 bg-white hover:bg-stone-50",
            )}
          >
            {/* Same faint always-on checkmark as ChecklistBox — a hint this
             *  is a real checkbox, not a decorative square. */}
            <Check
              className={cn(
                large ? "size-[19px]" : "size-3.5",
                !checked[current] && "text-stone-400",
              )}
              strokeWidth={3}
            />
          </button>
        }
      >
        {/* One item at a time, same idea as TaskAnalysisCard's own tile
         *  stepper — the dot row gives the overview a static fraction
         *  can't (which items, not just how many), and the checkbox in
         *  `actions` above scores whichever one is centered, auto-advancing
         *  on a genuine check. Small density drops the nav arrows and the
         *  ratio line entirely (see below) — there's only room for the dots
         *  and the label before it reads as crowded, and swiping still
         *  covers navigation either way. */}
        <div className="w-full flex flex-col items-center gap-1">
          {/* `relative` anchors the large-density-only nav arrows to just
              this dots row's own height, so they land vertically centered
              on the dots specifically rather than on the dots+label stack
              as a whole — and the label's own SwipeStrip below no longer
              needs to reserve a side gutter for them, since they're not
              sharing its row any more. */}
          <div className="relative w-full flex items-center justify-center gap-1.5">
            {/* Large density only — pushed out to the tile's own edges
             *  (not hugging the label) since there's room to spare at that
             *  size; small density relies on swiping/the dots alone. */}
            {large && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(current - 1);
                  }}
                  disabled={current === 0}
                  aria-label="Previous item"
                  className="absolute -left-2 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(current + 1);
                  }}
                  disabled={current >= items.length - 1}
                  aria-label="Next item"
                  className="absolute -right-2 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            )}
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                aria-label={`Go to item ${i + 1}`}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === current ? (large ? "size-2.5" : "size-2") : large ? "size-1.5" : "size-1",
                  checked[i] ? "bg-blue-500" : "bg-stone-300",
                )}
                style={{ opacity: i === current ? 1 : 0.6 }}
              />
            ))}
          </div>
          <div className="relative w-full">
            {/* Real touch/drag swiping between items, same SwipeStrip every
             *  other kind's tile already uses — synced to the same
             *  current/goTo state the dots and (large-only) arrows drive,
             *  so all three stay in agreement regardless of which one last
             *  moved it. */}
            <SwipeStrip
              count={items.length}
              current={current}
              onCurrentChange={goTo}
              variant="paged"
              className="w-full"
              itemWrapperClassName="w-full flex items-center justify-center"
            >
              {(i) => (
                <p
                  className={cn(
                    "text-center line-clamp-2 font-semibold",
                    large ? "text-[13px] leading-tight" : "text-[11px] leading-[1.05]",
                    checked[i] ? "text-foreground" : "text-foreground/80",
                  )}
                >
                  {items[i]?.label}
                </p>
              )}
            </SwipeStrip>
          </div>
          {large && (
            <span className="text-[10px] text-muted-foreground">
              {checkedCount}/{items.length} checked
            </span>
          )}
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<ChecklistIcon />}
        kind="checklist"
        dataTypeLabel="Checklist"
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
        progress={percent}
        isComplete={checkedCount > 0}
        details={
          <>
            {quickFacts}
            {teachingBlock}
          </>
        }
        actions={
          <ListChecklistButton
            items={items}
            checked={checked}
            checkedCount={checkedCount}
            disabled={!canRecordData}
            onToggle={toggle}
          />
        }
      />
    );
  }

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Checklist"
      dataTypeIcon={<ChecklistIcon />}
      kind="checklist"
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
      progress={percent}
      isComplete={checkedCount > 0}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      details={
        <>
          {quickFacts}
          {teachingBlock}
        </>
      }
      expandedView={
        <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3">
          {items.map((item, i) => (
            <ChecklistRow
              key={i}
              item={item}
              checked={Boolean(checked[i])}
              disabled={!canRecordData}
              showDescription
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-0.5 px-3 pt-2 pb-3">
        {items.map((item, i) => (
          <ChecklistRow
            key={i}
            item={item}
            checked={Boolean(checked[i])}
            disabled={!canRecordData}
            showDescription={false}
            onToggle={() => toggle(i)}
          />
        ))}
        <span className="mt-1 px-1 text-xs text-muted-foreground">{summary}</span>
      </div>
    </CardShell>
  );
}

/** The List display mode's own compact action — same "one button opens a
 *  popover with the full picker" idiom as RatingCard's ListRatingButton,
 *  since a whole checklist's worth of rows (up to several) has nowhere near
 *  enough room in a list row's fixed action budget the way Trial's Error/
 *  Correct pair or Frequency's Minus/Plus do. Also reused as-is by the
 *  bookmark bar's own Checklist chip (see BookmarkChip.tsx), same as
 *  ListRatingButton is. */
export function ListChecklistButton({
  items,
  checked,
  checkedCount,
  disabled,
  onToggle,
}: {
  items: ChecklistItem[];
  checked: boolean[];
  checkedCount: number;
  disabled?: boolean;
  onToggle: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // margin=34, not the default 16: this popover's `align="end"` trigger
  // sits right at the box's own top-right corner — see StatusBar's
  // SaveIndicator popover for the identical fix and full reasoning
  // (16 isn't enough clearance for this rounded-2xl box's real 24px
  // radius plus the rotated arrow square's own ~8.5px half-width).
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef, 34);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          aria-label={`${checkedCount} of ${items.length} checked`}
          aria-haspopup
          className={cn(
            "btn-bevel relative shrink-0 h-7 rounded-full grid place-items-center border-[1.5px] px-2.5 transition-colors disabled:opacity-40",
            checkedCount > 0
              ? "bg-blue-500 border-blue-600 text-white"
              : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
          )}
        >
          <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
            <Check className="size-3" strokeWidth={3} />
            {checkedCount}/{items.length}
          </span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="top"
        align="end"
        // Same 8px every other keypad-style popover in the app explicitly
        // sets (TimeKeypad, TimeOfDayKeypad, NumberKeypad) — this one was
        // left at ui/popover.tsx's own default of 4, which the arrow below
        // wasn't sized for (its own -bottom-[7px]/border math assumes the
        // same 8px gap those other popovers actually get), leaving it
        // sitting too low with visible daylight on both sides instead of
        // bridging cleanly from the box down to the trigger.
        sideOffset={8}
        collisionPadding={8}
        // Same fix as ListPromptLevelButton's own comment in TrialCard.tsx —
        // needed for any popover anchored inside the bookmark bar's own
        // overflow-x-auto strip, and harmless for the List row's own
        // (non-scrolling) case too.
        collisionBoundary={typeof document !== "undefined" ? document.body : undefined}
        // relative, and no overflow/max-height of its own: this is the
        // actual bordered box the arrow below is positioned against (same
        // role as TimeOfDayKeypad/NumberKeypad's own inner "relative" box).
        // The scrollable item list lives in a separate inner div instead —
        // putting max-h-72/overflow-y-auto directly on THIS element (as it
        // used to be) left it both unpositioned (its own "position" was
        // never set, so the arrow's containing block silently fell back to
        // Radix's outer positioning wrapper instead of this box) and a
        // clip parent for its own overflowing children — clipping away the
        // arrow's -bottom-[7px] tip that's deliberately meant to poke out
        // past this box's border to form the seam.
        className="group relative z-[70] w-64 rounded-2xl border-2 border-blue-300 bg-card p-2 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {items.map((item, i) => (
            <ChecklistRow
              key={i}
              item={item}
              checked={Boolean(checked[i])}
              disabled={disabled}
              showDescription={false}
              onToggle={() => onToggle(i)}
            />
          ))}
        </div>
        {/* Arrow's left offset tracks the trigger's real position (see
            useSlidingArrowOffset) rather than staying hard-centered — see
            NumberKeypad's identical comment for why. */}
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
          style={{ left: arrowLeft ?? "50%" }}
        />
      </PopoverContent>
    </Popover>
  );
}
