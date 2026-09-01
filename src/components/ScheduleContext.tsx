import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { useSettings } from "./SettingsContext";

// Kept separate from ScheduleView's other state (schedule items, edit mode,
// layout mode, etc.) — this is the one slice ClientInfoPane's Related
// Service Times row also needs, so it's the one slice worth sharing rather
// than lifting all of ScheduleView's local state into a context it doesn't
// otherwise need. `now`/`bumpTime` below are the other slice worth sharing,
// for the same reason: IntervalCard's checkpoint-mode alerts need the
// exact same simulated demo clock the Schedule tab itself shows and lets
// you tap forward, not a second, independently-real one that could
// (and, before this, did) disagree with it.

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Randomizes to somewhere within the clinic's own configured hours (not a
// genuinely random hour) so a demo opened at, say, 2am still lands on a
// plausible mid-session time — see ScheduleView's own former copy of this
// (now moved here so the same clock can be shared) for the fuller history.
function randomDemoTime(dayStartTime: string, dayEndTime: string): Date {
  const d = new Date();
  const startMin = toMin(dayStartTime);
  const endMin = toMin(dayEndTime);
  const m = startMin + Math.floor(Math.random() * (endMin - startMin));
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

// Rooms are really assigned per client per day by whoever schedules the
// clinic's rooms — there's no real per-day assignment data to read here, so
// this just picks one of a fixed pool and holds it for the demo, the same
// "randomize once per mount" idiom as randomDemoTime above.
const ASSIGNED_ROOM_COUNT = 10;
function randomDemoRoom(): string {
  return `Room ${1 + Math.floor(Math.random() * ASSIGNED_ROOM_COUNT)}`;
}

/** The token ScheduleView's own location data (and its "Assigned Room" entry
 *  in the LOCATIONS picklist) stores in place of a literal room name —
 *  resolved to the real assigned room only at display time (see
 *  ScheduleView's own resolveLocation), so a schedule item stays pointed at
 *  "whichever room I'm in today" rather than freezing today's answer into
 *  its own data. */
export const ASSIGNED_ROOM_TOKEN = "Assigned Room";

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
  /** The demo's one shared "current time" — randomized once per mount
   *  within the clinic's configured hours (see randomDemoTime above), then
   *  only ever moved by an explicit `bumpTime()` call (the Schedule tab's
   *  own "tap to advance 10 minutes" control), never by a real ticking
   *  clock. Anything in the app that needs to know "what time is it
   *  right now" for demo purposes — the Schedule tab's own alert-firing
   *  and "now" line, IntervalCard's checkpoint-mode alerts — reads this
   *  one value, so they can never disagree with each other the way a
   *  real `new Date()` read independently in two places could (and did). */
  now: Date;
  bumpTime: () => void;
  /** Today's real room for whichever schedule item stores ASSIGNED_ROOM_
   *  TOKEN as its location — randomized once per mount the same way `now`
   *  is (see randomDemoRoom above), standing in for the real per-client
   *  daily room assignment this app has no actual data source for yet. */
  assignedRoom: string;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [phineasAppointments, setPhineasAppointments] = useState<Appointment[]>(PHINEAS_APPTS);
  const { dayStart: dayStartTime, dayEnd: dayEndTime } = useSettings();
  // Deterministic on first render — server and client render this the same
  // way — then randomized immediately after via a layout effect, before
  // paint, so nothing ever visibly flashes the placeholder (same "0 now,
  // corrected client-side" pattern useStickyTop uses for the same reason).
  const [now, setNow] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  useLayoutEffect(() => {
    setNow(randomDemoTime(dayStartTime, dayEndTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Same deterministic-then-randomized-on-mount idiom as `now` above, for
  // the same reason: an SSR/first-render value that can't disagree with the
  // client, corrected before paint so nothing flashes.
  const [assignedRoom, setAssignedRoom] = useState("Room 1");
  useLayoutEffect(() => {
    setAssignedRoom(randomDemoRoom());
  }, []);
  const bumpTime = () => {
    setNow((prev) => {
      const d = new Date(prev);
      d.setMinutes(d.getMinutes() + 10);
      return d;
    });
  };
  return (
    <ScheduleContext.Provider
      value={{ phineasAppointments, setPhineasAppointments, now, bumpTime, assignedRoom }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleData() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useScheduleData must be used within a ScheduleProvider");
  return ctx;
}
