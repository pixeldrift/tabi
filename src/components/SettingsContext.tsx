import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DisplayMode } from "./DataToolbarContext";
import type { StatusTab } from "./StatusBar";

export interface SettingDef {
  key: string;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: "ms" | "px" | "s" | "min" | "";
  description?: string;
}

// Add entries here as specific properties are requested.
export const SETTINGS: SettingDef[] = [
  {
    key: "snoozeMinutes",
    label: "Snooze time",
    group: "Notifications",
    min: 1,
    max: 10,
    step: 1,
    default: 1,
    unit: "min",
    description: "How long a snoozed alert stays quiet before it reappears.",
  },
  {
    key: "notificationDurationSeconds",
    label: "Notification duration",
    group: "Notifications",
    min: 3,
    max: 20,
    step: 1,
    default: 7,
    unit: "s",
    description: "How long a notification banner stays before it auto-dismisses.",
  },
];

export type SettingsValues = Record<string, number>;

export type AlarmSoundStyle = "chime" | "alert" | "alarm";

export const ALARM_SOUND_OPTIONS: { value: AlarmSoundStyle; label: string }[] = [
  { value: "chime", label: "Chime" },
  { value: "alert", label: "Alert" },
  { value: "alarm", label: "Alarm" },
];

const DEFAULT_ALARM_SOUND: AlarmSoundStyle = "alert";

const DEFAULT_KEEP_ACTIVE_CARD_CENTERED = false;

const DEFAULT_BOOKMARK_BAR_VISIBLE = true;

// The guided welcome tour (TourContext.tsx). `tourHintsEnabled` defaults
// off — auto-launching on a fresh load isn't needed when both WelcomeScreen's
// "Preview guided tour" button and Settings' own "Replay welcome tour" button
// already reach it in one tap; a user who wants the tour on every fresh load
// can still flip this Settings switch back on themselves. `tourCompleted`
// stays defaulted true regardless (its own original reason still applies —
// this demo's "first load" isn't really anyone's first look at the app, so
// flipping tourHintsEnabled back on later shouldn't itself auto-fire the
// tour on THAT reload) — it flips true again the first time the tour is
// finished or skipped through the normal flow, and a full "Reset all"
// re-arms both to these same defaults.
const DEFAULT_TOUR_HINTS_ENABLED = false;
const DEFAULT_TOUR_COMPLETED = true;

// The "Did you know?" tip rotation (TipContext.tsx). Unlike the tour,
// there's no "completed" concept to gate on — tips are meant to keep
// resurfacing every visit, so `tipsEnabled` just suppresses the auto-show
// entirely when off. `tipBag`/`lastShownTipId` are the shuffle bag's own
// persisted state (see tipShuffleBag.ts) — persisted rather than kept in
// memory specifically so the anti-repeat guarantee survives a reload
// landing right as the bag empties, not just a same-session reshuffle.
const DEFAULT_TIPS_ENABLED = true;
const DEFAULT_TIP_BAG: string[] = [];
const DEFAULT_LAST_SHOWN_TIP_ID: string | null = null;

// Which of the header's five tabs the app opens on — matches this same
// file's own defaultDataView just below (adopted once on mount, then left
// alone for the rest of that session — see IndexInner's own comment).
const DEFAULT_TAB: StatusTab = "data";

const DEFAULT_DATA_VIEW: DisplayMode = "card";

export type ColorTheme = "default" | "alt";

export const COLOR_THEME_OPTIONS: { value: ColorTheme; label: string; description: string }[] = [
  {
    value: "default",
    label: "Default",
    description:
      "Sand, sage, rust, slate, ochre & mustard — an earthy palette, still evolving. A future dark mode will likely build on this same toggle.",
  },
  {
    value: "alt",
    label: "Alternate",
    description: "Warm cream and ink — the original palette.",
  },
];

const DEFAULT_COLOR_THEME: ColorTheme = "default";

// Clinic hours the Schedule tab's grid is bounded to — 24h "HH:MM".
export const DEFAULT_DAY_START = "08:00";
export const DEFAULT_DAY_END = "18:00";

const DEFAULTS: SettingsValues = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));

// Exported so __root.tsx's blocking pre-paint script (which sets
// data-theme before hydration, avoiding a flash of the wrong palette) reads
// the same key rather than a second hardcoded copy of it.
export const STORAGE_KEY = "aba-daba-settings-v2";

interface SettingsContextValue {
  values: SettingsValues;
  setValue: (key: string, value: number) => void;
  resetAll: () => void;
  resetOne: (key: string) => void;
  alarmSound: AlarmSoundStyle;
  setAlarmSound: (style: AlarmSoundStyle) => void;
  /** Smoothly scrolls the Data tab so the active card stays centered
   *  whenever it changes — the "now" button's always-on behavior, but
   *  opt-in here since it's a bigger, more opinionated motion. */
  keepActiveCardCentered: boolean;
  setKeepActiveCardCentered: (v: boolean) => void;
  /** Whether the Data tab's bookmark bar (the pinned favorites/interfering-
   *  behaviors quick-score shelf below the toolbar) is showing. Three ways
   *  to flip it: the bar's own inline close X, the toolbar's persistent
   *  reopen icon, and this setting's own switch — all three read/write this
   *  one value. */
  bookmarkBarVisible: boolean;
  setBookmarkBarVisible: (v: boolean) => void;
  /** Clinic hours (24h "HH:MM") the Schedule tab's grid is bounded to. */
  dayStart: string;
  setDayStart: (v: string) => void;
  dayEnd: string;
  setDayEnd: (v: string) => void;
  /** Which tab the app opens on each time it loads. Changing it doesn't
   *  jump an open session to a different tab — see IndexInner's own
   *  comment on why it's adopted only once, same idiom as defaultDataView
   *  just below. */
  defaultTab: StatusTab;
  setDefaultTab: (v: StatusTab) => void;
  /** View mode the Data tab starts in each time the app loads. Changing it
   *  doesn't affect the view already showing in an open session — see
   *  DataToolbarProvider's own comment on why it's adopted only once. */
  defaultDataView: DisplayMode;
  setDefaultDataView: (v: DisplayMode) => void;
  /** Which color palette the app renders in — see the `[data-theme="alt"]`
   *  block in styles.css. Applied to `<html data-theme>` by a blocking
   *  inline script in __root.tsx (so the very first paint already has it,
   *  no flash) and kept in sync afterward by SettingsProvider's own effect
   *  below. */
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
  /** Whether the guided welcome tour should auto-launch on the next
   *  welcome→main transition. Off just suppresses the automatic launch —
   *  "Replay welcome tour" in Settings can still start it manually either
   *  way. */
  tourHintsEnabled: boolean;
  setTourHintsEnabled: (v: boolean) => void;
  /** Set once the tour has been finished or skipped at least once, so it
   *  doesn't auto-launch again on every reload. */
  tourCompleted: boolean;
  setTourCompleted: (v: boolean) => void;
  /** Whether the "Did you know?" tip rotation should auto-show on the next
   *  welcome→main transition. Off just suppresses the automatic show —
   *  "Show a tip now" in Settings can still trigger one manually either
   *  way. */
  tipsEnabled: boolean;
  setTipsEnabled: (v: boolean) => void;
  /** Remaining shuffled tip ids for the current cycle (see
   *  drawNextTipId in tipShuffleBag.ts). */
  tipBag: string[];
  /** The most recently shown tip id, so a fresh reshuffle can't
   *  immediately repeat it. */
  lastShownTipId: string | null;
  /** Every real draw updates `tipBag`/`lastShownTipId` together — one
   *  setter means one state update (and one save-effect firing) per draw
   *  instead of two independent ones landing separately. */
  recordTipDraw: (id: string, remainingBag: string[]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

interface StoredShape {
  values: SettingsValues;
  alarmSound: AlarmSoundStyle;
  keepActiveCardCentered: boolean;
  bookmarkBarVisible: boolean;
  dayStart: string;
  dayEnd: string;
  defaultTab: StatusTab;
  defaultDataView: DisplayMode;
  colorTheme: ColorTheme;
  tourHintsEnabled: boolean;
  tourCompleted: boolean;
  tipsEnabled: boolean;
  tipBag: string[];
  lastShownTipId: string | null;
}

function loadStored(): StoredShape {
  const fallback: StoredShape = {
    values: DEFAULTS,
    alarmSound: DEFAULT_ALARM_SOUND,
    keepActiveCardCentered: DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
    bookmarkBarVisible: DEFAULT_BOOKMARK_BAR_VISIBLE,
    dayStart: DEFAULT_DAY_START,
    dayEnd: DEFAULT_DAY_END,
    defaultTab: DEFAULT_TAB,
    defaultDataView: DEFAULT_DATA_VIEW,
    colorTheme: DEFAULT_COLOR_THEME,
    tourHintsEnabled: DEFAULT_TOUR_HINTS_ENABLED,
    tourCompleted: DEFAULT_TOUR_COMPLETED,
    tipsEnabled: DEFAULT_TIPS_ENABLED,
    tipBag: DEFAULT_TIP_BAG,
    lastShownTipId: DEFAULT_LAST_SHOWN_TIP_ID,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    return {
      values: { ...DEFAULTS, ...parsed.values },
      alarmSound: parsed.alarmSound ?? DEFAULT_ALARM_SOUND,
      keepActiveCardCentered: parsed.keepActiveCardCentered ?? DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
      bookmarkBarVisible: parsed.bookmarkBarVisible ?? DEFAULT_BOOKMARK_BAR_VISIBLE,
      dayStart: parsed.dayStart ?? DEFAULT_DAY_START,
      dayEnd: parsed.dayEnd ?? DEFAULT_DAY_END,
      defaultTab: parsed.defaultTab ?? DEFAULT_TAB,
      defaultDataView: parsed.defaultDataView ?? DEFAULT_DATA_VIEW,
      colorTheme: parsed.colorTheme ?? DEFAULT_COLOR_THEME,
      tourHintsEnabled: parsed.tourHintsEnabled ?? DEFAULT_TOUR_HINTS_ENABLED,
      tourCompleted: parsed.tourCompleted ?? DEFAULT_TOUR_COMPLETED,
      tipsEnabled: parsed.tipsEnabled ?? DEFAULT_TIPS_ENABLED,
      tipBag: parsed.tipBag ?? DEFAULT_TIP_BAG,
      lastShownTipId: parsed.lastShownTipId ?? DEFAULT_LAST_SHOWN_TIP_ID,
    };
  } catch {
    return fallback;
  }
}

/** Mirrors __root.tsx's own blocking inline script (which sets this
 *  attribute before first paint, reading the same localStorage key
 *  directly, so there's no flash of the wrong theme on load) — this is
 *  what keeps it in sync after that, both on mount (a harmless no-op,
 *  already matching) and on every later toggle. */
function applyColorThemeToDom(theme: ColorTheme) {
  if (typeof document === "undefined") return;
  if (theme === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from defaults for a stable SSR/first-paint value, then adopt
  // localStorage on mount to avoid hydration mismatches.
  const [values, setValues] = useState<SettingsValues>(DEFAULTS);
  const [alarmSound, setAlarmSound] = useState<AlarmSoundStyle>(DEFAULT_ALARM_SOUND);
  const [keepActiveCardCentered, setKeepActiveCardCentered] = useState(
    DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
  );
  const [bookmarkBarVisible, setBookmarkBarVisible] = useState(DEFAULT_BOOKMARK_BAR_VISIBLE);
  const [dayStart, setDayStart] = useState(DEFAULT_DAY_START);
  const [dayEnd, setDayEnd] = useState(DEFAULT_DAY_END);
  const [defaultTab, setDefaultTab] = useState<StatusTab>(DEFAULT_TAB);
  const [defaultDataView, setDefaultDataView] = useState<DisplayMode>(DEFAULT_DATA_VIEW);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(DEFAULT_COLOR_THEME);
  const [tourHintsEnabled, setTourHintsEnabled] = useState(DEFAULT_TOUR_HINTS_ENABLED);
  const [tourCompleted, setTourCompleted] = useState(DEFAULT_TOUR_COMPLETED);
  const [tipsEnabled, setTipsEnabled] = useState(DEFAULT_TIPS_ENABLED);
  const [tipBag, setTipBag] = useState<string[]>(DEFAULT_TIP_BAG);
  const [lastShownTipId, setLastShownTipId] = useState<string | null>(DEFAULT_LAST_SHOWN_TIP_ID);

  useEffect(() => {
    const stored = loadStored();
    setValues(stored.values);
    setAlarmSound(stored.alarmSound);
    setKeepActiveCardCentered(stored.keepActiveCardCentered);
    setBookmarkBarVisible(stored.bookmarkBarVisible);
    setDayStart(stored.dayStart);
    setDayEnd(stored.dayEnd);
    setDefaultTab(stored.defaultTab);
    setDefaultDataView(stored.defaultDataView);
    setColorThemeState(stored.colorTheme);
    setTourHintsEnabled(stored.tourHintsEnabled);
    setTourCompleted(stored.tourCompleted);
    setTipsEnabled(stored.tipsEnabled);
    setTipBag(stored.tipBag);
    setLastShownTipId(stored.lastShownTipId);
    // Already applied pre-paint by __root.tsx's blocking script — this is
    // just keeping the two in sync, a no-op in the common case.
    applyColorThemeToDom(stored.colorTheme);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored: StoredShape = {
      values,
      alarmSound,
      keepActiveCardCentered,
      bookmarkBarVisible,
      dayStart,
      dayEnd,
      defaultTab,
      defaultDataView,
      colorTheme,
      tourHintsEnabled,
      tourCompleted,
      tipsEnabled,
      tipBag,
      lastShownTipId,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [
    values,
    alarmSound,
    keepActiveCardCentered,
    bookmarkBarVisible,
    dayStart,
    dayEnd,
    defaultTab,
    defaultDataView,
    colorTheme,
    tourHintsEnabled,
    tourCompleted,
    tipsEnabled,
    tipBag,
    lastShownTipId,
  ]);

  const setValue = useCallback((key: string, value: number) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const setColorTheme = useCallback((v: ColorTheme) => {
    setColorThemeState(v);
    applyColorThemeToDom(v);
  }, []);

  const resetAll = useCallback(() => {
    setValues(DEFAULTS);
    setAlarmSound(DEFAULT_ALARM_SOUND);
    setKeepActiveCardCentered(DEFAULT_KEEP_ACTIVE_CARD_CENTERED);
    setBookmarkBarVisible(DEFAULT_BOOKMARK_BAR_VISIBLE);
    setDayStart(DEFAULT_DAY_START);
    setDayEnd(DEFAULT_DAY_END);
    setDefaultTab(DEFAULT_TAB);
    setDefaultDataView(DEFAULT_DATA_VIEW);
    setColorTheme(DEFAULT_COLOR_THEME);
    setTourHintsEnabled(DEFAULT_TOUR_HINTS_ENABLED);
    setTourCompleted(DEFAULT_TOUR_COMPLETED);
    setTipsEnabled(DEFAULT_TIPS_ENABLED);
    setTipBag(DEFAULT_TIP_BAG);
    setLastShownTipId(DEFAULT_LAST_SHOWN_TIP_ID);
  }, [setColorTheme]);
  const resetOne = useCallback((key: string) => {
    setValues((v) => ({ ...v, [key]: DEFAULTS[key] }));
  }, []);
  const recordTipDraw = useCallback((id: string, remainingBag: string[]) => {
    setLastShownTipId(id);
    setTipBag(remainingBag);
  }, []);

  const value = useMemo(
    () => ({
      values,
      setValue,
      resetAll,
      resetOne,
      alarmSound,
      setAlarmSound,
      keepActiveCardCentered,
      setKeepActiveCardCentered,
      bookmarkBarVisible,
      setBookmarkBarVisible,
      dayStart,
      setDayStart,
      dayEnd,
      setDayEnd,
      defaultTab,
      setDefaultTab,
      defaultDataView,
      setDefaultDataView,
      colorTheme,
      setColorTheme,
      tourHintsEnabled,
      setTourHintsEnabled,
      tourCompleted,
      setTourCompleted,
      tipsEnabled,
      setTipsEnabled,
      tipBag,
      lastShownTipId,
      recordTipDraw,
    }),
    [
      values,
      setValue,
      resetAll,
      resetOne,
      alarmSound,
      keepActiveCardCentered,
      bookmarkBarVisible,
      dayStart,
      dayEnd,
      defaultTab,
      defaultDataView,
      colorTheme,
      setColorTheme,
      tourHintsEnabled,
      tourCompleted,
      tipsEnabled,
      tipBag,
      lastShownTipId,
      recordTipDraw,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
