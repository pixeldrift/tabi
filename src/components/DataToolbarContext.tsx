import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CardKind = "trial" | "frequency" | "rate" | "duration" | "task-analysis" | "rating";

export type DisplayMode = "list" | "card" | "grid";

/** Mutually exclusive: has any data been logged this session, has none yet,
 *  or the filter is off (show both). */
export type LoggedFilter = "all" | "logged" | "no-data";

export interface DataToolbarFilters {
  /** Empty set = no kind filter applied (show all kinds). */
  kinds: Set<CardKind>;
  /** Empty set = no phase filter applied (show all phases). */
  phases: Set<string>;
  incompleteOnly: boolean;
  logged: LoggedFilter;
  favoritesOnly: boolean;
  /** Mirrors After Effects' "Hide Shy Layers" master switch: OFF (false)
   *  hides shy/hidden cards from the list; ON (true) reveals them alongside
   *  everything else. */
  showHidden: boolean;
}

const DEFAULT_FILTERS: DataToolbarFilters = {
  kinds: new Set(),
  phases: new Set(),
  incompleteOnly: false,
  logged: "all",
  favoritesOnly: false,
  showHidden: false,
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
  setIncompleteOnly: (v: boolean) => void;
  setLoggedFilter: (v: LoggedFilter) => void;
  setFavoritesOnly: (v: boolean) => void;
  setShowHidden: (v: boolean) => void;
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
  reportCardStatus: (id: string, status: { hasData: boolean; isComplete: boolean }) => void;
}

const DataToolbarContext = createContext<DataToolbarContextValue | null>(null);

export function useDataToolbar() {
  const ctx = useContext(DataToolbarContext);
  if (!ctx) throw new Error("useDataToolbar must be used inside DataToolbarProvider");
  return ctx;
}

export function DataToolbarProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [editMode, setEditModeState] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<DataToolbarFilters>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrderState] = useState<string[]>([]);
  const [hasData, setHasData] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<Record<string, boolean>>({});

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

  const setIncompleteOnly = useCallback((v: boolean) => {
    setFilters((f) => ({ ...f, incompleteOnly: v }));
  }, []);
  const setLoggedFilter = useCallback((v: LoggedFilter) => {
    setFilters((f) => ({ ...f, logged: v }));
  }, []);
  const setFavoritesOnly = useCallback((v: boolean) => {
    setFilters((f) => ({ ...f, favoritesOnly: v }));
  }, []);
  const setShowHidden = useCallback((v: boolean) => {
    setFilters((f) => ({ ...f, showHidden: v }));
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

  const reportCardStatus = useCallback((id: string, status: { hasData: boolean; isComplete: boolean }) => {
    setHasData((prev) => (prev[id] === status.hasData ? prev : { ...prev, [id]: status.hasData }));
    setCompletion((prev) => (prev[id] === status.isComplete ? prev : { ...prev, [id]: status.isComplete }));
  }, []);

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
      setIncompleteOnly,
      setLoggedFilter,
      setFavoritesOnly,
      setShowHidden,
      clearFilters,
      favorites,
      toggleFavorite,
      hidden,
      toggleHidden,
      order,
      setOrder,
      hasData,
      completion,
      reportCardStatus,
    }),
    [
      displayMode, editMode, setEditMode, searchQuery, filters,
      toggleKindFilter, togglePhaseFilter, setIncompleteOnly, setLoggedFilter, setFavoritesOnly, setShowHidden, clearFilters,
      favorites, toggleFavorite, hidden, toggleHidden, order, setOrder, hasData, completion, reportCardStatus,
    ],
  );

  return <DataToolbarContext.Provider value={value}>{children}</DataToolbarContext.Provider>;
}

/** Cards call this with their own live "has any data been recorded" /
 *  "has this met its own minimum" booleans so the toolbar's Logged/No data
 *  and Incomplete-goals filters have something to read — only the card
 *  itself knows what counts as "data" or "complete" for its own type. */
export function useReportCardStatus(id: string, hasData: boolean, isComplete: boolean) {
  const { reportCardStatus } = useDataToolbar();
  useEffect(() => {
    reportCardStatus(id, { hasData, isComplete });
  }, [id, hasData, isComplete, reportCardStatus]);
}
