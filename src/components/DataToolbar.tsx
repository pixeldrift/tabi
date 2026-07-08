import { useEffect, useRef, useState } from "react";
import { Heart, EyeOff, Pencil, Search, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PercentCorrectIcon } from "@/components/icons/PercentCorrectIcon";
import { FrequencyIcon } from "@/components/icons/FrequencyIcon";
import { RateIcon } from "@/components/icons/RateIcon";
import { DurationIcon } from "@/components/icons/DurationIcon";
import { TaskAnalysisIcon } from "@/components/icons/TaskAnalysisIcon";
import { ListViewIcon } from "@/components/icons/ListViewIcon";
import { CardViewIcon } from "@/components/icons/CardViewIcon";
import { GridViewIcon } from "@/components/icons/GridViewIcon";
import { SmallGridViewIcon } from "@/components/icons/SmallGridViewIcon";
import { FilterIcon } from "@/components/icons/FilterIcon";
import { useDataToolbar, type CardKind, type DisplayMode } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

const KIND_META: Record<CardKind, { label: string; icon: (props: { className?: string }) => React.ReactNode }> = {
  trial: { label: "Percent Correct", icon: (p) => <PercentCorrectIcon {...p} /> },
  frequency: { label: "Frequency", icon: (p) => <FrequencyIcon {...p} /> },
  rate: { label: "Rate", icon: (p) => <RateIcon {...p} /> },
  duration: { label: "Duration", icon: (p) => <DurationIcon {...p} /> },
  "task-analysis": { label: "Task Analysis", icon: (p) => <TaskAnalysisIcon {...p} /> },
  rating: { label: "Rating", icon: (p) => <Star {...p} /> },
};

const DISPLAY_MODES: { mode: DisplayMode; label: string; icon: (props: { className?: string }) => React.ReactNode }[] = [
  { mode: "list", label: "List", icon: (p) => <ListViewIcon {...p} /> },
  { mode: "card", label: "Card", icon: (p) => <CardViewIcon {...p} /> },
  { mode: "grid-large", label: "Large Grid", icon: (p) => <GridViewIcon {...p} /> },
  { mode: "grid-small", label: "Small Grid", icon: (p) => <SmallGridViewIcon {...p} /> },
];

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
    setWithData,
    setNoData,
    setTrialsReached,
    setIncompleteTrials,
    setFavoritesOnly,
    setShowHidden,
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
      const wrapper = content?.parentElement;
      if (!btn || !content || !wrapper) return;
      const currentTransform = new DOMMatrixReadOnly(getComputedStyle(wrapper).transform);
      const centeredLeft = window.innerWidth / 2 - content.offsetWidth / 2;
      wrapper.style.transform = `translate(${centeredLeft}px, ${currentTransform.m42}px)`;
      const btnRect = btn.getBoundingClientRect();
      setFilterArrowLeft(btnRect.left + btnRect.width / 2 - centeredLeft);
    };
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [filterOpen]);

  const activeFilterCount =
    filters.kinds.size +
    filters.phases.size +
    // Each pair only counts as an active filter when exactly one side is
    // selected — both or neither applies no constraint (see the popover).
    (filters.withData !== filters.noData ? 1 : 0) +
    (filters.trialsReached !== filters.incompleteTrials ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.showHidden ? 1 : 0);

  return (
    <div
      // Named so the drawer's own top offset can be measured off this
      // element's rendered bottom edge (see useElementBottom) — the drawer
      // is bounded to below the toolbar rather than the full viewport.
      data-toolbar
      className="sticky z-[60] ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] overflow-x-hidden bg-background border-b border-stone-200/70 py-1.5 px-4"
      style={{ top: stickyTop }}
    >
      <div className="flex items-center gap-1.5 max-w-3xl mx-auto">
        {/* View mode segmented toggle */}
        <div className="flex items-center rounded-full border border-stone-200 bg-stone-100/60 p-0.5 shrink-0">
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
              title="Filter cards"
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
            className="group z-[70] w-[308px] p-3"
          >
            <FilterPopoverContent
              availableKinds={availableKinds}
              availablePhases={availablePhases}
              filters={filters}
              toggleKindFilter={toggleKindFilter}
              togglePhaseFilter={togglePhaseFilter}
              setWithData={setWithData}
              setNoData={setNoData}
              setTrialsReached={setTrialsReached}
              setIncompleteTrials={setIncompleteTrials}
              setFavoritesOnly={setFavoritesOnly}
              setShowHidden={setShowHidden}
              clearFilters={clearFilters}
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
            className="w-full h-7 rounded-full border border-stone-200 bg-white pl-7 pr-6 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
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
  setWithData,
  setNoData,
  setTrialsReached,
  setIncompleteTrials,
  setFavoritesOnly,
  setShowHidden,
  clearFilters,
}: {
  availableKinds: CardKind[];
  availablePhases: string[];
  filters: ReturnType<typeof useDataToolbar>["filters"];
  toggleKindFilter: (k: CardKind) => void;
  togglePhaseFilter: (p: string) => void;
  setWithData: (v: boolean) => void;
  setNoData: (v: boolean) => void;
  setTrialsReached: (v: boolean) => void;
  setIncompleteTrials: (v: boolean) => void;
  setFavoritesOnly: (v: boolean) => void;
  setShowHidden: (v: boolean) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700">
          Clear all
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

      {/* Each row below is two independent toggles, not a mutually exclusive
          pair — selecting both or neither applies no constraint (shows
          all), rather than one turning the other off. */}
      <div className="flex gap-1.5">
        <ToggleChip
          label="With Data"
          selected={filters.withData}
          onClick={() => setWithData(!filters.withData)}
        />
        <ToggleChip
          label="No Data"
          selected={filters.noData}
          onClick={() => setNoData(!filters.noData)}
        />
      </div>

      <div className="flex gap-1.5">
        <ToggleChip
          label="Trials Reached"
          selected={filters.trialsReached}
          onClick={() => setTrialsReached(!filters.trialsReached)}
        />
        <ToggleChip
          label="Incomplete Trials"
          selected={filters.incompleteTrials}
          onClick={() => setIncompleteTrials(!filters.incompleteTrials)}
        />
      </div>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Data type</h4>
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
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Phase</h4>
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

