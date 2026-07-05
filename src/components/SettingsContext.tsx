import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

export type AlarmSoundStyle = "gentle" | "normal" | "heavy";

export const ALARM_SOUND_OPTIONS: { value: AlarmSoundStyle; label: string }[] = [
  { value: "gentle", label: "Gentle" },
  { value: "normal", label: "Normal" },
  { value: "heavy", label: "Heavy" },
];

const DEFAULT_ALARM_SOUND: AlarmSoundStyle = "normal";

const DEFAULT_KEEP_ACTIVE_CARD_CENTERED = false;

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
}

function loadStored(): StoredShape {
  const fallback: StoredShape = {
    values: DEFAULTS,
    alarmSound: DEFAULT_ALARM_SOUND,
    keepActiveCardCentered: DEFAULT_KEEP_ACTIVE_CARD_CENTERED,
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
  const [keepActiveCardCentered, setKeepActiveCardCentered] = useState(DEFAULT_KEEP_ACTIVE_CARD_CENTERED);

  useEffect(() => {
    const stored = loadStored();
    setValues(stored.values);
    setAlarmSound(stored.alarmSound);
    setKeepActiveCardCentered(stored.keepActiveCardCentered);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored: StoredShape = { values, alarmSound, keepActiveCardCentered };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [values, alarmSound, keepActiveCardCentered]);

  const setValue = useCallback((key: string, value: number) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setValues(DEFAULTS);
    setAlarmSound(DEFAULT_ALARM_SOUND);
    setKeepActiveCardCentered(DEFAULT_KEEP_ACTIVE_CARD_CENTERED);
  }, []);
  const resetOne = useCallback((key: string) => {
    setValues((v) => ({ ...v, [key]: DEFAULTS[key] }));
  }, []);

  const value = useMemo(
    () => ({
      values, setValue, resetAll, resetOne, alarmSound, setAlarmSound,
      keepActiveCardCentered, setKeepActiveCardCentered,
    }),
    [values, setValue, resetAll, resetOne, alarmSound, keepActiveCardCentered],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
