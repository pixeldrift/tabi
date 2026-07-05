import { useState } from "react";
import { Heart, EyeOff, Pencil, Search, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  PercentCorrectIcon,
  FrequencyIcon,
  RateIcon,
  DurationIcon,
  TaskAnalysisIcon,
} from "@/components/icons/DataTypeIcons";
import { ListViewIcon, CardViewIcon, GridViewIcon, FilterIcon, DrawerHandleIcon } from "@/components/icons/ToolbarIcons";
import { useDataToolbar, type CardKind, type DisplayMode, type LoggedFilter } from "./DataToolbarContext";
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
  { mode: "grid", label: "Grid", icon: (p) => <GridViewIcon {...p} /> },
];

const LOGGED_OPTIONS: { value: LoggedFilter; label: string }[] = [
  { value: "all", label: "Clear" },
  { value: "logged", label: "Data logged" },
  { value: "no-data", label: "No data" },
];

export interface DataToolbarProps {
  stickyTop: number;
  availableKinds: CardKind[];
  availablePhases: string[];
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  drawerDisabled?: boolean;
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
  drawerOpen,
  onToggleDrawer,
  drawerDisabled = false,
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
    setIncompleteOnly,
    setLoggedFilter,
    setFavoritesOnly,
    setShowHidden,
    clearFilters,
  } = useDataToolbar();
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilterCount =
    filters.kinds.size +
    filters.phases.size +
    (filters.incompleteOnly ? 1 : 0) +
    (filters.logged !== "all" ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.showHidden ? 1 : 0);

  return (
    <div
      // z-[60] (above the details Sheet's z-50 overlay/panel, which are
      // portaled to the document body and so compare z-index globally, not
      // against this component's own local stacking context) — otherwise
      // the whole toolbar, including the drawer pull tab itself, disappears
      // under the Sheet the instant it opens, with no way to pull it shut
      // again short of the Sheet's own close button.
      className="sticky z-[60] ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] overflow-x-hidden bg-background border-b border-stone-200/70 py-1.5 px-4"
      style={{ top: stickyTop }}
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
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
          <PopoverContent side="bottom" align="start" className="w-72 p-3">
            <FilterPopoverContent
              availableKinds={availableKinds}
              availablePhases={availablePhases}
              filters={filters}
              toggleKindFilter={toggleKindFilter}
              togglePhaseFilter={togglePhaseFilter}
              setIncompleteOnly={setIncompleteOnly}
              setLoggedFilter={setLoggedFilter}
              setFavoritesOnly={setFavoritesOnly}
              setShowHidden={setShowHidden}
              clearFilters={clearFilters}
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

        {/* Search */}
        <div className="relative flex-1 min-w-0">
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

        {/* Details drawer pull tab */}
        <button
          type="button"
          onClick={onToggleDrawer}
          disabled={drawerDisabled}
          aria-label={drawerOpen ? "Close details drawer" : "Open details drawer"}
          aria-expanded={drawerOpen}
          title={drawerOpen ? "Close details drawer" : "Open details drawer"}
          className={cn(
            "grid place-items-center size-7 shrink-0 rounded-full border transition-colors disabled:opacity-30 disabled:pointer-events-none",
            drawerOpen
              ? "btn-bevel bg-blue-500 border-blue-500 text-white"
              : "border-stone-200 text-blue-500 hover:text-blue-600 hover:bg-blue-50",
          )}
        >
          <DrawerHandleIcon className={cn("size-3.5 transition-transform duration-200", drawerOpen && "rotate-180")} />
        </button>
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
  setIncompleteOnly,
  setLoggedFilter,
  setFavoritesOnly,
  setShowHidden,
  clearFilters,
}: {
  availableKinds: CardKind[];
  availablePhases: string[];
  filters: ReturnType<typeof useDataToolbar>["filters"];
  toggleKindFilter: (k: CardKind) => void;
  togglePhaseFilter: (p: string) => void;
  setIncompleteOnly: (v: boolean) => void;
  setLoggedFilter: (v: LoggedFilter) => void;
  setFavoritesOnly: (v: boolean) => void;
  setShowHidden: (v: boolean) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700">
          Clear all
        </button>
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

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Data logged</h4>
        <div className="flex rounded-full border border-stone-200 p-0.5 gap-0.5">
          {LOGGED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLoggedFilter(opt.value)}
              aria-pressed={filters.logged === opt.value}
              className={cn(
                "flex-1 rounded-full py-1 text-[11px] font-medium transition-colors",
                filters.logged === opt.value ? "bg-blue-500 text-white" : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <SwitchRow
        label="Incomplete goals only"
        description="Only show cards that haven't met their minimum yet."
        checked={filters.incompleteOnly}
        onCheckedChange={setIncompleteOnly}
      />
      <SwitchRow
        icon={<Heart className="size-3.5" />}
        label="Favorites only"
        checked={filters.favoritesOnly}
        onCheckedChange={setFavoritesOnly}
      />
      <SwitchRow
        icon={<EyeOff className="size-3.5" />}
        label="Show hidden"
        description="Hidden cards stay out of the list until this is on — like Hide Shy Layers in After Effects."
        checked={filters.showHidden}
        onCheckedChange={setShowHidden}
      />
    </div>
  );
}

function SwitchRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const id = `filter-switch-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </label>
        {description && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  );
}
