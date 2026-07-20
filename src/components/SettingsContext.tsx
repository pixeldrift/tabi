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

const DEFAULT_DATA_VIEW: DisplayMode = "card";

// Clinic hours the Schedule tab's grid is bounded to — 24h "HH:MM".
export const DEFAULT_DAY_START = "08:00";
export const DEFAULT_DAY_END = "18:00";

const DEFAULTS: SettingsValues = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));

const STORAGE_KEY = "aba-daba-settings-v2";

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
  /** Clinic hours (24h "HH:MM") the Schedule tab's grid is bounded to. */
  dayStart: string;
  setDayStart: (v: string) => void;
  dayEnd: string;
  setDayEnd: (v: string) => void;
  /** View mode the Data tab starts in each time the app loads. Changing it
   *  doesn't affect the view already showing in an open session — see
   *  DataToolbarProvider's own comment on why it's adopted only once. */
  defaultDataView: DisplayMode;
  setDefaultDataView: (v: DisplayMode) => void;
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
  dayStart: string;
  dayEnd: string;
  defaultDataView: DisplayMode;
}

function loadStored(): StoredShape {
  const fallback: StoredShape = {
    values: DEFAULTS,
    alarmSound: DEFAULT_ALARM_SOUND,
    keepActiveCardCentered: DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
    dayStart: DEFAULT_DAY_START,
    dayEnd: DEFAULT_DAY_END,
    defaultDataView: DEFAULT_DATA_VIEW,
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
      dayStart: parsed.dayStart ?? DEFAULT_DAY_START,
      dayEnd: parsed.dayEnd ?? DEFAULT_DAY_END,
      defaultDataView: parsed.defaultDataView ?? DEFAULT_DATA_VIEW,
    };
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from defaults for a stable SSR/first-paint value, then adopt
  // localStorage on mount to avoid hydration mismatches.
  const [values, setValues] = useState<SettingsValues>(DEFAULTS);
  const [alarmSound, setAlarmSound] = useState<AlarmSoundStyle>(DEFAULT_ALARM_SOUND);
  const [keepActiveCardCentered, setKeepActiveCardCentered] = useState(
    DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
  );
  const [dayStart, setDayStart] = useState(DEFAULT_DAY_START);
  const [dayEnd, setDayEnd] = useState(DEFAULT_DAY_END);
  const [defaultDataView, setDefaultDataView] = useState<DisplayMode>(DEFAULT_DATA_VIEW);

  useEffect(() => {
    const stored = loadStored();
    setValues(stored.values);
    setAlarmSound(stored.alarmSound);
    setKeepActiveCardCentered(stored.keepActiveCardCentered);
    setDayStart(stored.dayStart);
    setDayEnd(stored.dayEnd);
    setDefaultDataView(stored.defaultDataView);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored: StoredShape = {
      values,
      alarmSound,
      keepActiveCardCentered,
      dayStart,
      dayEnd,
      defaultDataView,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [values, alarmSound, keepActiveCardCentered, dayStart, dayEnd, defaultDataView]);

  const setValue = useCallback((key: string, value: number) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setValues(DEFAULTS);
    setAlarmSound(DEFAULT_ALARM_SOUND);
    setKeepActiveCardCentered(DEFAULT_KEEP_ACTIVE_CARD_CENTERED);
    setDayStart(DEFAULT_DAY_START);
    setDayEnd(DEFAULT_DAY_END);
    setDefaultDataView(DEFAULT_DATA_VIEW);
  }, []);
  const resetOne = useCallback((key: string) => {
    setValues((v) => ({ ...v, [key]: DEFAULTS[key] }));
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
      dayStart,
      setDayStart,
      dayEnd,
      setDayEnd,
      defaultDataView,
      setDefaultDataView,
    }),
    [
      values,
      setValue,
      resetAll,
      resetOne,
      alarmSound,
      keepActiveCardCentered,
      dayStart,
      dayEnd,
      defaultDataView,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
