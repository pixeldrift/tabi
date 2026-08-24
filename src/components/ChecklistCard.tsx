import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { ChecklistIcon } from "./icons/ChecklistIcon";
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
        checked ? "btn-bevel bg-blue-500 border-blue-600 text-white" : "border-stone-300 bg-white",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

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
      >
        {/* No per-item checkboxes at this density — there's no room for up
            to a handful of rows, and every other tile at this size is a
            read-only glance anyway (tapping it opens the details drawer,
            same as any other kind's tile). Just the fraction, large enough
            to read at a glance like Frequency's own tally. */}
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              "font-display leading-none tabular-nums text-foreground",
              large ? "text-[34px]" : "text-[26px]",
            )}
          >
            {checkedCount}
            <span className="text-foreground/40">/{items.length}</span>
          </span>
          <span className="text-[10px] text-muted-foreground">{percent}% checked</span>
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
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
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
        side="top"
        align="end"
        collisionPadding={8}
        // Same fix as ListPromptLevelButton's own comment in TrialCard.tsx —
        // needed for any popover anchored inside the bookmark bar's own
        // overflow-x-auto strip, and harmless for the List row's own
        // (non-scrolling) case too.
        collisionBoundary={typeof document !== "undefined" ? document.body : undefined}
        className="group z-[70] w-64 max-h-72 overflow-y-auto rounded-2xl border-2 border-blue-300 bg-card p-2 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col gap-0.5">
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
        <div
          className={cn(
            "absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-blue-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
        />
      </PopoverContent>
    </Popover>
  );
}
