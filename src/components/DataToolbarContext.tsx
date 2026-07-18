import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListViewIcon } from "@/components/icons/ListViewIcon";
import { CardViewIcon } from "@/components/icons/CardViewIcon";
import { GridViewIcon } from "@/components/icons/GridViewIcon";
import { SmallGridViewIcon } from "@/components/icons/SmallGridViewIcon";
import { useSettings } from "./SettingsContext";
import { playSoundEffect } from "@/lib/soundEffects";

export type CardKind = "trial" | "frequency" | "rate" | "duration" | "task-analysis" | "rating" | "timestamp";

export type DisplayMode = "list" | "card" | "grid-large" | "grid-small";

/** Single source of truth for each view mode's label + icon, shared by the
 *  Data toolbar's segmented toggle and the Settings "Default data view"
 *  picker so the two never drift apart. */
export const DISPLAY_MODES: { mode: DisplayMode; label: string; icon: (props: { className?: string }) => React.ReactNode }[] = [
  { mode: "list", label: "List", icon: (p) => <ListViewIcon {...p} /> },
  { mode: "card", label: "Card", icon: (p) => <CardViewIcon {...p} /> },
  { mode: "grid-large", label: "Large Grid", icon: (p) => <GridViewIcon {...p} /> },
  { mode: "grid-small", label: "Small Grid", icon: (p) => <SmallGridViewIcon {...p} /> },
];

export interface DataToolbarFilters {
  /** Empty set = no kind filter applied (show all kinds). */
  kinds: Set<CardKind>;
  /** Empty set = no phase filter applied (show all phases). */
  phases: Set<string>;
  /** Single three-way cycling toggles (all -> one state -> the other -> all),
   *  same idiom as behaviorFilter below — replaced what used to be two
   *  independent booleans apiece. */
  dataFilter: "all" | "with-data" | "no-data";
  completionFilter: "all" | "reached" | "incomplete";
  favoritesOnly: boolean;
  /** Mirrors After Effects' "Hide Shy Layers" master switch: OFF (false)
   *  hides shy/hidden cards from the list; ON (true) reveals them alongside
   *  everything else. */
  showHidden: boolean;
  /** Interfering-behavior vs. target-goal filter — a single three-way
   *  cycling toggle (not a pair of independent booleans like the ones
   *  above), since only one of the three states can be active at a time. */
  behaviorFilter: "both" | "interfering" | "target";
}

const DEFAULT_FILTERS: DataToolbarFilters = {
  kinds: new Set(),
  phases: new Set(),
  dataFilter: "all",
  completionFilter: "all",
  favoritesOnly: false,
  showHidden: false,
  behaviorFilter: "both",
};

interface PersistedShape {
  favorites: string[];
  hidden: string[];
  order: string[];
}

const STORAGE_KEY = "aba-daba-data-toolbar-v1";

function loadPersisted(): PersistedShape {
  const fallback: PersistedShape = { favorites: [], hidden: [], order: [] };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return {
      favorites: parsed.favorites ?? [],
      hidden: parsed.hidden ?? [],
      order: parsed.order ?? [],
    };
  } catch {
    return fallback;
  }
}

interface DataToolbarContextValue {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filters: DataToolbarFilters;
  toggleKindFilter: (kind: CardKind) => void;
  togglePhaseFilter: (phase: string) => void;
  /** Cycles dataFilter: all -> with-data -> no-data -> all. */
  cycleDataFilter: () => void;
  /** Cycles completionFilter: all -> reached -> incomplete -> all. */
  cycleCompletionFilter: () => void;
  setFavoritesOnly: (v: boolean) => void;
  setShowHidden: (v: boolean) => void;
  /** Cycles behaviorFilter: both -> interfering -> target -> both. */
  cycleBehaviorFilter: () => void;
  clearFilters: () => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  hidden: Set<string>;
  toggleHidden: (id: string) => void;
  /** Explicit card-id order; empty when no manual reorder has happened yet
   *  (callers should fall back to the natural declaration order). */
  order: string[];
  setOrder: (ids: string[]) => void;
  /** Whether each card currently has any recorded data, and whether it's
   *  met its own minimum — reported up by the card components themselves
   *  (see useReportCardStatus), since only they know their own local
   *  session state. */
  hasData: Record<string, boolean>;
  completion: Record<string, boolean>;
  /** Each card's own title, kind, and its single key figure — a value
   *  (e.g. "75%", "3", "1.2") plus the unit describing it (e.g.
   *  "% Correct", "Total Count", "Times per Minute") — same reporting path
   *  as hasData/completion above, for the pre-submission review screen
   *  (see StatusBar's endOpen dialog). Kept as a value/unit pair rather
   *  than one pre-joined string so the review screen can style the number
   *  distinctly (large/bold) from its label. */
  cardMeta: Record<string, { title: string; kind: CardKind; value: string; unit: string }>;
  reportCardStatus: (
    id: string,
    status: {
      hasData: boolean;
      isComplete: boolean;
      title: string;
      kind: CardKind;
      value: string;
      unit: string;
    },
  ) => void;
}

const DataToolbarContext = createContext<DataToolbarContextValue | null>(null);

export function useDataToolbar() {
  const ctx = useContext(DataToolbarContext);
  if (!ctx) throw new Error("useDataToolbar must be used inside DataToolbarProvider");
  return ctx;
}

export function DataToolbarProvider({ children }: { children: ReactNode }) {
  const { defaultDataView } = useSettings();
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(defaultDataView);
  // Settings loads its persisted value asynchronously (see SettingsProvider),
  // so the very first render here still sees the pre-hydration default. Once
  // it lands, adopt it — but only until the user actually touches the
  // toggle themselves, so picking a new "default" mid-session doesn't yank
  // the view out from under them.
  const userChangedDisplayMode = useRef(false);
  useEffect(() => {
    if (!userChangedDisplayMode.current) setDisplayModeState(defaultDataView);
  }, [defaultDataView]);
  const setDisplayMode = useCallback((mode: DisplayMode) => {
    userChangedDisplayMode.current = true;
    setDisplayModeState(mode);
  }, []);
  const [editMode, setEditModeState] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<DataToolbarFilters>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrderState] = useState<string[]>([]);
  const [hasData, setHasData] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<Record<string, boolean>>({});
  const [cardMeta, setCardMeta] = useState<
    Record<string, { title: string; kind: CardKind; value: string; unit: string }>
  >({});

  useEffect(() => {
    const stored = loadPersisted();
    setFavorites(new Set(stored.favorites));
    setHidden(new Set(stored.hidden));
    setOrderState(stored.order);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored: PersistedShape = { favorites: [...favorites], hidden: [...hidden], order };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [favorites, hidden, order]);

  const setEditMode = useCallback((v: boolean) => {
    setEditModeState(v);
  }, []);

  const toggleKindFilter = useCallback((kind: CardKind) => {
    setFilters((f) => {
      const next = new Set(f.kinds);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return { ...f, kinds: next };
    });
  }, []);

  const togglePhaseFilter = useCallback((phase: string) => {
    setFilters((f) => {
      const next = new Set(f.phases);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return { ...f, phases: next };
    });
  }, []);

  const cycleDataFilter = useCallback(() => {
    setFilters((f) => ({
      ...f,
      dataFilter: f.dataFilter === "all" ? "with-data" : f.dataFilter === "with-data" ? "no-data" : "all",
    }));
  }, []);
  const cycleCompletionFilter = useCallback(() => {
    setFilters((f) => ({
      ...f,
      completionFilter: f.completionFilter === "all" ? "reached" : f.completionFilter === "reached" ? "incomplete" : "all",
    }));
  }, []);
  const setFavoritesOnly = useCallback((v: boolean) => {
    setFilters((f) => ({ ...f, favoritesOnly: v }));
  }, []);
  const setShowHidden = useCallback((v: boolean) => {
    setFilters((f) => ({ ...f, showHidden: v }));
  }, []);
  const cycleBehaviorFilter = useCallback(() => {
    setFilters((f) => ({
      ...f,
      behaviorFilter:
        f.behaviorFilter === "both" ? "interfering" : f.behaviorFilter === "interfering" ? "target" : "both",
    }));
  }, []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleHidden = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setOrder = useCallback((ids: string[]) => setOrderState(ids), []);

  const reportCardStatus = useCallback(
    (
      id: string,
      status: {
        hasData: boolean;
        isComplete: boolean;
        title: string;
        kind: CardKind;
        value: string;
        unit: string;
      },
    ) => {
      setHasData((prev) => (prev[id] === status.hasData ? prev : { ...prev, [id]: status.hasData }));
      setCompletion((prev) => (prev[id] === status.isComplete ? prev : { ...prev, [id]: status.isComplete }));
      setCardMeta((prev) => {
        const existing = prev[id];
        if (
          existing?.title === status.title &&
          existing?.kind === status.kind &&
          existing?.value === status.value &&
          existing?.unit === status.unit
        )
          return prev;
        return { ...prev, [id]: { title: status.title, kind: status.kind, value: status.value, unit: status.unit } };
      });
    },
    [],
  );

  const value = useMemo<DataToolbarContextValue>(
    () => ({
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
      favorites,
      toggleFavorite,
      hidden,
      toggleHidden,
      order,
      setOrder,
      hasData,
      completion,
      cardMeta,
      reportCardStatus,
    }),
    [
      displayMode, editMode, setEditMode, searchQuery, filters,
      toggleKindFilter, togglePhaseFilter, cycleDataFilter, cycleCompletionFilter,
      setFavoritesOnly, setShowHidden, cycleBehaviorFilter, clearFilters,
      favorites, toggleFavorite, hidden, toggleHidden, order, setOrder, hasData, completion, cardMeta, reportCardStatus,
    ],
  );

  return <DataToolbarContext.Provider value={value}>{children}</DataToolbarContext.Provider>;
}

/** Cards call this with their own live "has any data been recorded" /
 *  "has this met its own minimum" booleans, plus a title/kind and their
 *  single key figure as a value/unit pair (e.g. value "75", unit
 *  "% Correct") so the toolbar's dataFilter/completionFilter and the
 *  pre-submission review screen (StatusBar's endOpen dialog) have
 *  something to read — only the card itself knows what counts as "data" or
 *  "complete" for its own type, and which figure is the meaningful one to
 *  headline for its kind. */
export function useReportCardStatus(
  id: string,
  hasData: boolean,
  isComplete: boolean,
  info: { title: string; kind: CardKind; value: string; unit: string },
) {
  const { reportCardStatus } = useDataToolbar();
  const { title, kind, value, unit } = info;
  // Chimes once per genuine incomplete -> complete transition, never on
  // mount (a card that loads already complete, e.g. resuming a previous
  // session, shouldn't announce it) and never on the reverse edge (a reset
  // or an edit that un-completes a card isn't a "success").
  const wasCompleteRef = useRef(isComplete);
  useEffect(() => {
    reportCardStatus(id, { hasData, isComplete, title, kind, value, unit });
    if (isComplete && !wasCompleteRef.current) playSoundEffect("success");
    wasCompleteRef.current = isComplete;
  }, [id, hasData, isComplete, title, kind, value, unit, reportCardStatus]);
}
