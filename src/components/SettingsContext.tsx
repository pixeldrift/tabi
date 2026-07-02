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

/**
 * Tunable knobs for the animations built to spec from the roadmap (session
 * start, data-submitted, schedule collapse/mode/edit-mode, alert swipe, and
 * the Duration pulse beat). Scoped to new/rebuilt animations rather than
 * every existing motion value in the app, so this stays a small, legible
 * prototyping panel instead of a sprawling refactor.
 */
export const SETTINGS: SettingDef[] = [
  // Session start
  {
    key: "sessionStartDurationMs",
    label: "Overall duration",
    group: "Session start",
    min: 400,
    max: 1600,
    step: 20,
    default: 900,
    unit: "ms",
    description: "Odometer roll, blue flash, pill shrink, header collapse.",
  },
  {
    key: "sessionStartStaggerMs",
    label: "Element stagger",
    group: "Session start",
    min: 0,
    max: 300,
    step: 10,
    default: 80,
    unit: "ms",
    description: "Delay between each element joining the sequence.",
  },
  // Data submitted
  {
    key: "dataSubmitExitDurationMs",
    label: "Card exit duration",
    group: "Data submitted",
    min: 200,
    max: 800,
    step: 20,
    default: 400,
    unit: "ms",
  },
  {
    key: "dataSubmitStaggerMs",
    label: "Card exit stagger",
    group: "Data submitted",
    min: 20,
    max: 200,
    step: 10,
    default: 60,
    unit: "ms",
  },
  {
    key: "dataSubmitEnterDurationMs",
    label: "Blank sheet enter duration",
    group: "Data submitted",
    min: 200,
    max: 800,
    step: 20,
    default: 450,
    unit: "ms",
  },
  // Schedule: appointment collapse/expand
  {
    key: "apptCollapseDurationMs",
    label: "Roll duration",
    group: "Schedule: collapse/expand",
    min: 150,
    max: 600,
    step: 10,
    default: 320,
    unit: "ms",
  },
  {
    key: "apptCollapseStiffness",
    label: "Spring stiffness",
    group: "Schedule: collapse/expand",
    min: 100,
    max: 600,
    step: 10,
    default: 320,
    unit: "",
  },
  {
    key: "apptCollapseDamping",
    label: "Spring damping",
    group: "Schedule: collapse/expand",
    min: 10,
    max: 50,
    step: 1,
    default: 32,
    unit: "",
  },
  // Schedule: collapsed/proportional mode transition
  {
    key: "modeTransitionDurationMs",
    label: "Transition duration",
    group: "Schedule: mode switch",
    min: 100,
    max: 500,
    step: 10,
    default: 220,
    unit: "ms",
  },
  // Schedule: pencil edit-mode sequence
  {
    key: "editModeDurationMs",
    label: "Sequence duration",
    group: "Schedule: edit mode",
    min: 150,
    max: 600,
    step: 10,
    default: 350,
    unit: "ms",
  },
  {
    key: "editModeStaggerMs",
    label: "Element stagger",
    group: "Schedule: edit mode",
    min: 0,
    max: 200,
    step: 10,
    default: 60,
    unit: "ms",
  },
  // Alerts: swipe gestures
  {
    key: "swipeThresholdPx",
    label: "Commit threshold",
    group: "Alerts: swipe",
    min: 40,
    max: 160,
    step: 4,
    default: 88,
    unit: "px",
  },
  {
    key: "swipeSpringStiffness",
    label: "Spring stiffness",
    group: "Alerts: swipe",
    min: 200,
    max: 600,
    step: 10,
    default: 400,
    unit: "",
  },
  {
    key: "swipeSpringDamping",
    label: "Spring damping",
    group: "Alerts: swipe",
    min: 10,
    max: 40,
    step: 1,
    default: 30,
    unit: "",
  },
  // Duration card pulse beat
  {
    key: "pulseBeatMs",
    label: "Pulse beat period",
    group: "Duration pulse",
    min: 200,
    max: 2000,
    step: 50,
    default: 1000,
    unit: "ms",
    description: "Phase-locked to the session clock, not each card's own mount time.",
  },
];

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
