import { createContext, useContext, useState, type ReactNode } from "react";

// Kept separate from ScheduleView's other state (schedule items, edit mode,
// layout mode, etc.) — this is the one slice ClientInfoPane's Related
// Service Times row also needs, so it's the one slice worth sharing rather
// than lifting all of ScheduleView's local state into a context it doesn't
// otherwise need.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type Day = (typeof DAYS)[number];

export type AlertMode = "off" | "visual" | "audio";

export type AlertSettings = {
  mode: AlertMode;
  allowSnooze: boolean;
  autofade: boolean;
};
export type PrimingSettings = AlertSettings & { minutesPrior: number };

export type ApptTag = "Co-Treat" | "Handoff Session";

export type Appointment = {
  id: string;
  start: string; // "HH:MM" 24h
  end: string;
  days: Day[];
  type: string;
  provider: string;
  tag?: ApptTag;
  alertCfg?: AlertSettings;
  priming?: PrimingSettings;
};

// Same show's universe as the rest of the cast (StaffDirectory,
// ClientInfoPane) — Vanessa (SLP) and Jeremy (OT) are Phineas's actual
// related-service providers, not generic placeholder names.
export const PHINEAS_APPTS: Appointment[] = [
  {
    id: "ap1",
    start: "11:00",
    end: "11:30",
    days: ["Mon", "Wed"],
    type: "Speech Therapy",
    provider: "Vanessa Doofenshmirtz",
    tag: "Co-Treat",
  },
  {
    id: "ap2",
    start: "13:00",
    end: "13:30",
    days: ["Tue", "Thu"],
    type: "Occupational Therapy",
    provider: "Jeremy Johnson",
    tag: "Handoff Session",
  },
];

interface ScheduleContextValue {
  /** Phineas' Schedule's own appointments, kept in sync by ScheduleView
   *  whenever they change — read by ClientInfoPane's Related Service Times
   *  row so that section reflects whatever's actually on the Schedule tab
   *  instead of a second, separately-maintained list. */
  phineasAppointments: Appointment[];
  setPhineasAppointments: (appts: Appointment[]) => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [phineasAppointments, setPhineasAppointments] = useState<Appointment[]>(PHINEAS_APPTS);
  return (
    <ScheduleContext.Provider value={{ phineasAppointments, setPhineasAppointments }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleData() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useScheduleData must be used within a ScheduleProvider");
  return ctx;
}
