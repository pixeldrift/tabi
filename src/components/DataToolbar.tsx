import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardX,
  Frown,
  Heart,
  EyeOff,
  Pencil,
  Search,
  Star,
  Target,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PercentCorrectIcon } from "@/components/icons/PercentCorrectIcon";
import { FrequencyIcon } from "@/components/icons/FrequencyIcon";
import { RateIcon } from "@/components/icons/RateIcon";
import { DurationIcon } from "@/components/icons/DurationIcon";
import { TaskAnalysisIcon } from "@/components/icons/TaskAnalysisIcon";
import { FilterIcon } from "@/components/icons/FilterIcon";
import { useDataToolbar, DISPLAY_MODES, type CardKind } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  CardKind,
  { label: string; icon: (props: { className?: string }) => React.ReactNode }
> = {
  trial: { label: "Percent Correct", icon: (p) => <PercentCorrectIcon {...p} /> },
  frequency: { label: "Frequency", icon: (p) => <FrequencyIcon {...p} /> },
  rate: { label: "Rate", icon: (p) => <RateIcon {...p} /> },
  duration: { label: "Duration", icon: (p) => <DurationIcon {...p} /> },
  "task-analysis": { label: "Task Analysis", icon: (p) => <TaskAnalysisIcon {...p} /> },
  rating: { label: "Rating", icon: (p) => <Star {...p} /> },
};

export interface DataToolbarProps {
  stickyTop: number;
  availableKinds: CardKind[];
  availablePhases: string[];
  /** Rendered below the main bar row, inside the same sticky container —
   *  e.g. the Data tab's "Start session to record data" banner, so the two
   *  stack under one shared `top` offset instead of needing a second one
   *  computed for whatever sits below the toolbar. */
  children?: React.ReactNode;
}

export function DataToolbar({
  stickyTop,
  availableKinds,
  availablePhases,
  children,
}: DataToolbarProps) {
  const {
    displayMode,
    setDisplayMode,
    editMode,
    setEditMode,
    searchQuery,
    setSearchQuery,
    filters,
    toggleKindFilter,
    togglePhaseFilter,
    cycleDataFilter,
    cycleCompletionFilter,
    setFavoritesOnly,
    setShowHidden,
    cycleBehaviorFilter,
    clearFilters,
  } = useDataToolbar();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterContentRef = useRef<HTMLDivElement>(null);
  const [filterArrowLeft, setFilterArrowLeft] = useState(16);

  // Re-centers the popover horizontally on the viewport after Radix
  // positions it (which otherwise hugs the button's own left-of-center
  // spot) by overriding the position wrapper's own transform directly —
  // `alignOffset` can't get it there: Radix clamps that so the popover
  // always keeps some overlap with whatever it's anchored to, nowhere near
  // enough to reach screen-center from here. The vertical offset Radix
  // already computed is preserved; only the horizontal one is replaced.
  // Since the box's horizontal position is no longer tied to the button,
  // the arrow's own offset is measured against the button's real position
  // rather than using a fixed value.
  useEffect(() => {
    if (!filterOpen) return;
    const update = () => {
      const btn = filterBtnRef.current;
      const content = filterContentRef.current;
      const wrapper = content?.parentElement as HTMLElement | null;
      if (!btn || !content || !wrapper) return;
      const currentTransform = new DOMMatrixReadOnly(getComputedStyle(wrapper).transform);
      const centeredLeft = window.innerWidth / 2 - content.offsetWidth / 2;
      wrapper.style.transform = `translate(${centeredLeft}px, ${currentTransform.m42}px)`;
      const btnRect = btn.getBoundingClientRect();
      setFilterArrowLeft(btnRect.left + btnRect.width / 2 - centeredLeft);
    };
    // Two things make a single one-shot pass unreliable here: (1) Radix
    // portals PopoverContent in asynchronously, so `filterContentRef.current`
    // is often still null on this effect's very first run — refs are
    // re-read fresh on every frame below instead of captured once; and (2)
    // Radix/Floating UI keeps re-measuring and re-asserting its OWN position
    // across the first several frames after mount (content size settling,
    // the open animation), silently clobbering a write from a frame or two
    // ago. Polling for a couple dozen frames plus a short settle timeout
    // makes sure ours is both applied at all and the one that sticks.
    const rafIds: number[] = [];
    let frame = 0;
    const loop = () => {
      update();
      frame += 1;
      if (frame < 20) rafIds.push(requestAnimationFrame(loop));
    };
    rafIds.push(requestAnimationFrame(loop));
    const settleId = window.setTimeout(update, 300);
    window.addEventListener("resize", update);
    return () => {
      rafIds.forEach(cancelAnimationFrame);
      window.clearTimeout(settleId);
      window.removeEventListener("resize", update);
    };
  }, [filterOpen]);

  const activeFilterCount =
    filters.kinds.size +
    filters.phases.size +
    (filters.dataFilter !== "all" ? 1 : 0) +
    (filters.completionFilter !== "all" ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.showHidden ? 1 : 0) +
    (filters.behaviorFilter !== "both" ? 1 : 0);

  return (
    <div
      // Named so the drawer's own top offset can be measured off this
      // element's rendered bottom edge (see useElementBottom) — the drawer
      // is bounded to below the toolbar (including the "Start session"
      // banner below the row, when it's showing) rather than the full
      // viewport.
      data-toolbar
      className="sticky z-[60] ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] overflow-x-hidden bg-background border-b border-stone-200/70"
      style={{ top: stickyTop }}
    >
      {/* Named separately from data-toolbar above — this is just the row's
       *  own box (its py-1.5/px-4 padding, not the banner below), so
       *  anything that should match "the filter bar" itself (the drawer's
       *  pull tab, its sticky header) can measure this instead of the
       *  outer toolbar, which grows by the banner's variable height. */}
      <div data-toolbar-row className="py-1.5 px-4">
        <div className="flex items-center gap-1.5 max-w-3xl mx-auto">
          {/* View mode segmented toggle — nudged left within the toolbar's own
           *  px-4 padding, since its rounded pill reads with more empty edge
           *  space than the toolbar's other controls at the same inset. */}
          <div className="flex items-center -ml-1 rounded-full border border-stone-200 bg-stone-100/60 p-0.5 shrink-0">
            {DISPLAY_MODES.map(({ mode, label, icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDisplayMode(mode)}
                aria-pressed={displayMode === mode}
                aria-label={`${label} view`}
                title={`${label} view`}
                className={cn(
                  "grid place-items-center size-6 rounded-full transition-colors",
                  displayMode === mode
                    ? "btn-bevel bg-blue-500 text-white"
                    : "text-stone-500 hover:text-stone-800",
                )}
              >
                {icon({ className: "size-3.5" })}
              </button>
            ))}
          </div>

          {/* Filter */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                ref={filterBtnRef}
                type="button"
                aria-label="Filter cards"
                title="Filter cards — double-tap to clear"
                // Double-click/tap clears every active filter without having
                // to open the popover first — the two intervening single
                // clicks still toggle the popover open then closed, but that
                // happens too fast to notice.
                onDoubleClick={clearFilters}
                className={cn(
                  "relative grid place-items-center size-7 shrink-0 rounded-full border transition-colors",
                  activeFilterCount > 0
                    ? "border-blue-400 bg-blue-50 text-blue-600"
                    : "border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100",
                )}
              >
                <FilterIcon className="size-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 grid place-items-center size-3.5 rounded-full bg-blue-500 text-white text-[9px] font-semibold leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            {/* z-[70]: the arrow straddles the seam with the trigger, poking
              up slightly into the toolbar's own row — the toolbar itself is
              z-[60] (see its own className comment), so the popover needs to
              paint above that or the sticky bar's opaque background hides
              the arrow (and the top sliver of the box) behind it. */}
            <PopoverContent
              ref={filterContentRef}
              side="bottom"
              align="center"
              sideOffset={8}
              className="group z-[70] w-64 p-3"
            >
              <FilterPopoverContent
                availableKinds={availableKinds}
                availablePhases={availablePhases}
                filters={filters}
                toggleKindFilter={toggleKindFilter}
                togglePhaseFilter={togglePhaseFilter}
                cycleDataFilter={cycleDataFilter}
                cycleCompletionFilter={cycleCompletionFilter}
                setFavoritesOnly={setFavoritesOnly}
                setShowHidden={setShowHidden}
                clearFilters={clearFilters}
                onClose={() => setFilterOpen(false)}
              />
              {/* Arrow — points back at the filter button, same rotated-square
                idiom as NumberKeypad's popup. Since the box is no longer
                positioned relative to the button, its left offset is
                measured (see the effect above) rather than a fixed value. */}
              <div
                className={cn(
                  "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-stone-300 bg-popover",
                  "-top-[7px] border-l-2 border-t-2",
                  "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[7px]",
                  "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
                  "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
                )}
                style={{ left: filterArrowLeft }}
              />
            </PopoverContent>
          </Popover>

          {/* Interfering behavior / target goal 3-way filter — cycles both
            (default, no constraint) -> interfering-only -> target-only ->
            back to both on each click, rather than the independent-pair
            toggles used elsewhere in the popover, since only one of these
            three states can be active at a time. */}
          <button
            type="button"
            onClick={cycleBehaviorFilter}
            aria-pressed={filters.behaviorFilter !== "both"}
            aria-label={
              filters.behaviorFilter === "interfering"
                ? "Showing interfering behaviors only — click to show target goals only"
                : filters.behaviorFilter === "target"
                  ? "Showing target goals only — click to show all cards"
                  : "Showing all cards — click to show interfering behaviors only"
            }
            title={
              filters.behaviorFilter === "interfering"
                ? "Interfering behaviors only"
                : filters.behaviorFilter === "target"
                  ? "Target goals only"
                  : "Filter: interfering behaviors / target goals"
            }
            className={cn(
              "grid place-items-center size-7 shrink-0 rounded-full border transition-colors",
              filters.behaviorFilter !== "both"
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100",
            )}
          >
            {filters.behaviorFilter === "target" ? (
              <Target className="size-3.5" />
            ) : (
              <Frown className="size-3.5" />
            )}
          </button>

          {/* Edit mode */}
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            aria-pressed={editMode}
            aria-label={editMode ? "Done editing" : "Edit cards"}
            title={editMode ? "Done editing" : "Edit cards"}
            className={cn(
              "grid place-items-center size-7 shrink-0 rounded-full border transition-colors",
              editMode
                ? "btn-bevel bg-blue-500 border-blue-500 text-white"
                : "border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100",
            )}
          >
            <Pencil className="size-3.5" />
          </button>

          {/* Search — trimmed a bit short of the row's full width (mr-6) so
            the details drawer's tab, now pinned to the top of the drawer
            and overlapping this row, has clear space to sit in. min-w-8
            (not min-w-0) keeps a sliver of usable tap target once the
            fourth view-mode pill above claims its share of this shrink-0
            row's space, rather than letting it collapse to nothing first. */}
          <div className="relative flex-1 min-w-8 mr-6">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search cards"
              // 16px (text-base) on phones — iOS Safari auto-zooms the whole
              // page on focus for any input whose computed font-size is under
              // that, regardless of the viewport meta tag's own scale limits
              // in current iOS versions. Desktop/tablet (sm+) doesn't have
              // that behavior, so it reverts to the toolbar's own compact size.
              className="w-full h-7 rounded-full border border-stone-200 bg-white pl-7 pr-6 text-base sm:text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center size-4 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function FilterPopoverContent({
  availableKinds,
  availablePhases,
  filters,
  toggleKindFilter,
  togglePhaseFilter,
  cycleDataFilter,
  cycleCompletionFilter,
  setFavoritesOnly,
  setShowHidden,
  clearFilters,
  onClose,
}: {
  availableKinds: CardKind[];
  availablePhases: string[];
  filters: ReturnType<typeof useDataToolbar>["filters"];
  toggleKindFilter: (k: CardKind) => void;
  togglePhaseFilter: (p: string) => void;
  cycleDataFilter: () => void;
  cycleCompletionFilter: () => void;
  setFavoritesOnly: (v: boolean) => void;
  setShowHidden: (v: boolean) => void;
  clearFilters: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Three equal-width columns so "Clear all" lands dead-center of the
          row regardless of "Filters"/the close button's own widths, not
          just centered between wherever those two happen to end. */}
      <div className="grid grid-cols-3 items-center">
        <h3 className="justify-self-start text-sm font-semibold">Filters</h3>
        <button
          type="button"
          onClick={clearFilters}
          className="justify-self-center text-xs text-blue-600 hover:text-blue-700"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="justify-self-end -mr-1 -mt-1 rounded-full p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex gap-1.5">
        <ToggleChip
          icon={<Heart className="size-3" />}
          label="Favorites"
          selected={filters.favoritesOnly}
          onClick={() => setFavoritesOnly(!filters.favoritesOnly)}
        />
        <ToggleChip
          icon={<EyeOff className="size-3" />}
          label="Hidden"
          selected={filters.showHidden}
          onClick={() => setShowHidden(!filters.showHidden)}
        />
      </div>

      {/* Single three-way cycling chips (all -> one state -> the other ->
          all) — same idiom as the behaviorFilter button in the main toolbar
          row, replacing what used to be two independent toggle pairs. */}
      <div className="flex gap-1.5">
        <ToggleChip
          icon={
            filters.dataFilter === "no-data" ? (
              <ClipboardX className="size-3" />
            ) : (
              <ClipboardCheck className="size-3" />
            )
          }
          label={
            filters.dataFilter === "no-data"
              ? "No Data"
              : filters.dataFilter === "with-data"
                ? "With Data"
                : "Data"
          }
          selected={filters.dataFilter !== "all"}
          onClick={cycleDataFilter}
        />
        <ToggleChip
          icon={
            filters.completionFilter === "incomplete" ? (
              <CircleDashed className="size-3" />
            ) : (
              <CheckCircle2 className="size-3" />
            )
          }
          label={
            filters.completionFilter === "incomplete"
              ? "Incomplete"
              : filters.completionFilter === "reached"
                ? "Reached"
                : "Trials"
          }
          selected={filters.completionFilter !== "all"}
          onClick={cycleCompletionFilter}
        />
      </div>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Data type
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {availableKinds.map((kind) => {
            const meta = KIND_META[kind];
            const selected = filters.kinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKindFilter(kind)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-blue-400 bg-blue-500 text-white"
                    : "border-stone-200 text-stone-600 hover:bg-stone-100",
                )}
              >
                {meta.icon({ className: "size-3" })}
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Phase
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {availablePhases.map((phase) => {
            const selected = filters.phases.has(phase);
            return (
              <button
                key={phase}
                type="button"
                onClick={() => togglePhaseFilter(phase)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-blue-400 bg-blue-500 text-white"
                    : "border-stone-200 text-stone-600 hover:bg-stone-100",
                )}
              >
                {phase}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ToggleChip({
  icon,
  label,
  selected,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
        selected
          ? "border-blue-400 bg-blue-500 text-white"
          : "border-stone-200 text-stone-600 hover:bg-stone-100",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
