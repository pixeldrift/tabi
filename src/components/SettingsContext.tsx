import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface SettingDef {
  key: string;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: "ms" | "px" | "";
  description?: string;
}

// Empty for now — add entries here as specific properties are requested.
export const SETTINGS: SettingDef[] = [];

export type SettingsValues = Record<string, number>;

const DEFAULTS: SettingsValues = Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));

const STORAGE_KEY = "aba-daba-animation-settings-v1";

interface SettingsContextValue {
  values: SettingsValues;
  setValue: (key: string, value: number) => void;
  resetAll: () => void;
  resetOne: (key: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

function loadStored(): SettingsValues {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as SettingsValues;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from defaults for a stable SSR/first-paint value, then adopt
  // localStorage on mount to avoid hydration mismatches.
  const [values, setValues] = useState<SettingsValues>(DEFAULTS);

  useEffect(() => {
    setValues(loadStored());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, [values]);

  const setValue = useCallback((key: string, value: number) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const resetAll = useCallback(() => setValues(DEFAULTS), []);
  const resetOne = useCallback((key: string) => {
    setValues((v) => ({ ...v, [key]: DEFAULTS[key] }));
  }, []);

  const value = useMemo(
    () => ({ values, setValue, resetAll, resetOne }),
    [values, setValue, resetAll, resetOne],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
