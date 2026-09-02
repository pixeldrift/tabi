import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Pencil,
  Trash2,
  Bell,
  BellOff,
  BellRing,
  HandHelping,
  Copy,
  Check,
  X,
  PencilOff,
  Pin,
  Star,
  Rows3,
  TriangleAlert,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import locationBuildingPhoto from "@/assets/images/placeholders/location-building.jpg";
import roomBathroomPhoto from "@/assets/images/placeholders/room-bathroom.jpg";
import roomKitchenPhoto from "@/assets/images/placeholders/room-kitchen.jpg";
import roomTherapyPhoto from "@/assets/images/placeholders/room-therapy.jpg";
import roomTherapyPhoto2 from "@/assets/images/placeholders/room-therapy-2.jpg";
import roomTherapyPhoto3 from "@/assets/images/placeholders/room-therapy-3.jpg";
import roomTherapyPhoto4 from "@/assets/images/placeholders/room-therapy-4.jpg";
import roomPlayPhoto from "@/assets/images/placeholders/room-play.jpg";
import { CollapseIcon } from "./icons/CollapseIcon";
import { ProportionalRowsIcon } from "./icons/ProportionalRowsIcon";
import { SmileyIcon } from "./icons/SmileyIcon";
import { HandshakeIcon } from "./icons/HandshakeIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrubText } from "@/components/ScrubText";
import { useNotifications } from "@/components/NotificationContext";
import { useSession } from "@/components/SessionContext";
import { TimeOfDayKeypad, formatTimeOfDayForDisplay } from "@/components/TimeOfDayKeypad";
import { useStickyCompact } from "@/hooks/use-sticky-compact";
import { useKeyboardInset, keyboardInsetStyle } from "@/hooks/use-keyboard-inset";
import { useSettings } from "@/components/SettingsContext";
import {
  useScheduleData,
  PHINEAS_APPTS,
  DAYS,
  ASSIGNED_ROOM_TOKEN,
  ASSIGNED_ROOM_COUNT,
  type Day,
  type AlertMode,
  type AlertSettings,
  type PrimingSettings,
  type Appointment,
} from "@/components/ScheduleContext";
import {
  EDIT_MODE_DURATION_MS,
  EDIT_MODE_STAGGER_MS,
  APPT_COLLAPSE_STIFFNESS,
  APPT_COLLAPSE_DAMPING,
  APPT_COLLAPSE_DURATION_MS,
  MODE_TRANSITION_DURATION_MS,
} from "./ScheduleView.animations";

const LOCATIONS = [
  ASSIGNED_ROOM_TOKEN,
  "Kitchen",
  "Classroom",
  "Big Gym",
  "Small Gym",
  "Classroom Bathroom",
  "Learner Bathroom",
  "Solo Bathroom",
] as const;

// The building's full room directory for BuildingFloorPlan/AllRoomsDialog —
// every numbered treatment room in the assignment pool (see
// ASSIGNED_ROOM_COUNT's own comment) plus every named common area from
// LOCATIONS above (skipping its own first entry, ASSIGNED_ROOM_TOKEN — that
// one's a placeholder for "whichever numbered room," not a room of its own,
// and the numbered rooms below already cover the real ones it could resolve
// to).
const TREATMENT_ROOMS = Array.from({ length: ASSIGNED_ROOM_COUNT }, (_, i) => `Room ${i + 1}`);
const COMMON_AREAS = LOCATIONS.slice(1);
const ALL_ROOMS = [...TREATMENT_ROOMS, ...COMMON_AREAS];

const ACTIVITIES = [
  "Arrive/Pairing",
  "Sensory Play",
  "Snack",
  "Lunch",
  "Imaginative Play",
  "Social Group",
  "Arts and Crafts",
  "Gross Motor Play",
  "Peer Play",
  "Client Choice",
  "Discreet Trials",
  "Potty Time",
  "Cooking",
  "Cleanup",
  "Reading",
  "Pack Up/Dismissal",
  "Custom",
] as const;

const ACTIVITY_ICONS: Record<string, string> = {
  "Arrive/Pairing": "👋",
  "Sensory Play": "🫘",
  Snack: "🍎",
  Lunch: "🥪",
  "Imaginative Play": "🦄",
  "Social Group": "🙋",
  "Arts and Crafts": "🎨",
  "Gross Motor Play": "🏃",
  "Peer Play": "🧩",
  "Client Choice": "⭐",
  "Discreet Trials": "📋",
  "Potty Time": "💩",
  Cooking: "🍳",
  Cleanup: "🧹",
  Reading: "📖",
  "Pack Up/Dismissal": "🎒",
  Custom: "✨",
};

const LOCATION_ICONS: Record<string, string> = {
  [ASSIGNED_ROOM_TOKEN]: "🚪",
  Kitchen: "🍽️",
  Classroom: "📚",
  "Big Gym": "🏀",
  "Small Gym": "⛺️",
  "Classroom Bathroom": "🚽",
  "Learner Bathroom": "🚽",
  "Solo Bathroom": "🚽",
};

/** Same door icon as ASSIGNED_ROOM_TOKEN for any already-*resolved* numbered
 *  room ("Room 5", not the token itself) — LOCATION_ICONS has no entry for
 *  those since there are 10 of them and they're all the same kind of space,
 *  unlike the named common areas which each get their own icon above. */
function locationIcon(name: string): string {
  return LOCATION_ICONS[name] ?? (TREATMENT_ROOMS.includes(name) ? "🚪" : "📍");
}

// A schedule item's own `location` field can hold ASSIGNED_ROOM_TOKEN
// instead of a literal room name — this resolves it to today's real
// assigned room (see ScheduleContext's own comment on why that value is
// simulated) for anywhere the location is actually shown to someone,
// leaving the underlying data pointed at "whichever room I'm in today"
// rather than freezing today's answer into it. The icon lookup doesn't
// need this — ASSIGNED_ROOM_TOKEN already has its own entry in
// LOCATION_ICONS above, so it resolves to the same door icon either way.
function resolveLocation(location: string, assignedRoom: string): string {
  return location === ASSIGNED_ROOM_TOKEN ? assignedRoom : location;
}

// This demo's clinic chain — surfaced by RoomInfoDialog below so a
// therapist unfamiliar with a location (e.g. covering from another branch)
// can confirm where they actually are, not just which room number. Every
// entry shares the same "Tri-State Area" name the rest of this cast lives
// in (see PHINEAS_APPTS' own comment) — only the branch/address/photo
// differ. Main Branch (index 0) is the one this client's own schedule
// actually lives at, and the only one RoomInfoDialog opens into by default;
// the other four exist purely so "view other locations" has somewhere to
// go, sharing the same placeholder photo since this demo only has the one
// real exterior shot.
const CLINIC_LOCATIONS: { name: string; branch: string; address: string; photo: string }[] = [
  {
    name: "Tri-State Area Therapy",
    branch: "Main Branch",
    address: "123 Behavioral Analysis Rd., Danville",
    photo: locationBuildingPhoto,
  },
  {
    name: "Tri-State Area Therapy",
    branch: "Riverside Branch",
    address: "48 Riverside Pkwy, Danville",
    photo: locationBuildingPhoto,
  },
  {
    name: "Tri-State Area Therapy",
    branch: "Northgate Branch",
    address: "902 Northgate Ave, Danville",
    photo: locationBuildingPhoto,
  },
  {
    name: "Tri-State Area Therapy",
    branch: "Eastwood Branch",
    address: "215 Eastwood Blvd, Danville",
    photo: locationBuildingPhoto,
  },
  {
    name: "Tri-State Area Therapy",
    branch: "Lakeview Branch",
    address: "77 Lakeview Terrace, Danville",
    photo: locationBuildingPhoto,
  },
];

const APPOINTMENT_TYPES = [
  "Speech Therapy",
  "Occupational Therapy",
  "Physical Therapy",
  "Behavioral Consult",
  "Parent Meeting",
] as const;

const APPOINTMENT_TYPE_ICONS: Record<string, string> = {
  "Speech Therapy": "🗣️",
  "Occupational Therapy": "🍳",
  "Physical Therapy": "💪🏼",
  "Behavioral Consult": "🧠",
  "Parent Meeting": "🤝",
};

const DEFAULT_ALERT: AlertSettings = {
  mode: "visual",
  allowSnooze: true,
  autofade: true,
};
// A crossed alert/priming threshold detected more than this many simulated
// minutes after the fact doesn't pop the live banner — the schedule's own
// demo clock only advances when the "+10 min" button is tapped, so a normal
// single tap can detect a threshold up to ~10 simulated minutes "late" and
// that's still an on-time fire; several taps (or, in a real build, the tab
// sitting backgrounded a while) can jump `nowMin` past a whole run of
// thresholds at once, and none of those are still worth interrupting for by
// the time they're noticed. Pushed as history instead (see `live: false` on
// the alert-firing effect below) rather than dropped outright.
const STALE_ALERT_GRACE_MIN = 20;
// Defaults — TODO: surface in user settings.
const DEFAULT_PRIMING_MINUTES = 5;
const DEFAULT_PRIMING: PrimingSettings = {
  mode: "off",
  allowSnooze: true,
  autofade: true,
  minutesPrior: DEFAULT_PRIMING_MINUTES,
};

type ScheduleItem = {
  id: string;
  start: string; // "HH:MM" 24h
  end: string;
  activity: string;
  customName?: string;
  customIcon?: string;
  location: string;
  alert: AlertMode;
  alertCfg?: AlertSettings;
  priming?: PrimingSettings;
};

type Schedule = {
  name: string;
  items: ScheduleItem[];
  appointments: Appointment[];
  locked?: boolean;
};

const PX_PER_MIN = 3.6; // proportional: 5min smallest row ≈ 18px
const MIN_ROW_MIN = 5;
const COLLAPSED_ROW_PX = 36; // uniform row height in collapsed mode
// Proportional edit mode: how tall the before-first/after-last "Add
// Activity" affordance renders, capped well below its real (often much
// larger) span — just enough to hold the button, not the whole gap.
const EDGE_ADD_ACTIVITY_PX = 48;
// The "now" line always renders at full opacity — legibility over text is
// handled the other way around, by giving the row's own text a halo (see
// textHalo below) matching its background, rather than fading the line
// itself. That keeps the line reading as a strong, confident guide
// everywhere it crosses blank space, and only "cuts out" locally, right
// where a run of text actually sits, regardless of that text's own height
// or position within the row.
// The appointment overlay's own expanded-state background (bg-green-50) —
// its text only ever shows in that state (collapsed hides it entirely), so
// unlike an item row's text (which needs isCurrent's blue-50 vs. white),
// this one has no second case to account for.
const APPT_HALO_COLOR = "#f0fdf4";
const CLIENT_GROUP = "Group A"; // demo: this client belongs to Group A

const GROUP_A: ScheduleItem[] = [
  {
    id: "a1",
    start: "08:00",
    end: "08:30",
    activity: "Reading",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "a2",
    start: "08:30",
    end: "09:15",
    activity: "Discreet Trials",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
  {
    id: "a3",
    start: "09:15",
    end: "10:00",
    activity: "Gross Motor Play",
    location: "Big Gym",
    alert: "audio",
  },
  {
    id: "a4",
    start: "10:00",
    end: "10:30",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "a5",
    start: "10:30",
    end: "11:30",
    activity: "Social Group",
    location: "Classroom",
    alert: "audio",
  },
  {
    id: "a6",
    start: "11:30",
    end: "12:15",
    activity: "Sensory Play",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "off",
  },
  {
    id: "a7",
    start: "12:15",
    end: "13:00",
    activity: "Lunch",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "a8",
    start: "13:00",
    end: "14:00",
    activity: "Arts and Crafts",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "a9",
    start: "14:00",
    end: "15:00",
    activity: "Peer Play",
    location: "Small Gym",
    alert: "audio",
  },
  {
    id: "a10",
    start: "15:00",
    end: "15:30",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "a11",
    start: "15:30",
    end: "16:30",
    activity: "Imaginative Play",
    location: "Classroom",
    alert: "off",
  },
  {
    id: "a12",
    start: "16:30",
    end: "17:30",
    activity: "Client Choice",
    location: "Small Gym",
    alert: "off",
  },
  {
    id: "a13",
    start: "17:30",
    end: "18:00",
    activity: "Pack Up/Dismissal",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
];

const GROUP_B: ScheduleItem[] = [
  {
    id: "b1",
    start: "08:00",
    end: "08:30",
    activity: "Reading",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "b2",
    start: "08:30",
    end: "09:30",
    activity: "Imaginative Play",
    location: "Classroom",
    alert: "off",
  },
  {
    id: "b3",
    start: "09:30",
    end: "10:30",
    activity: "Discreet Trials",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
  {
    id: "b4",
    start: "10:30",
    end: "11:00",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "b5",
    start: "11:00",
    end: "12:00",
    activity: "Gross Motor Play",
    location: "Big Gym",
    alert: "audio",
  },
  {
    id: "b6",
    start: "12:00",
    end: "12:45",
    activity: "Lunch",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "b7",
    start: "12:45",
    end: "13:45",
    activity: "Client Choice",
    location: "Small Gym",
    alert: "off",
  },
  {
    id: "b8",
    start: "13:45",
    end: "14:45",
    activity: "Social Group",
    location: "Classroom",
    alert: "audio",
  },
  {
    id: "b9",
    start: "14:45",
    end: "15:15",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "b10",
    start: "15:15",
    end: "16:15",
    activity: "Arts and Crafts",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "b11",
    start: "16:15",
    end: "17:15",
    activity: "Peer Play",
    location: "Small Gym",
    alert: "audio",
  },
  {
    id: "b12",
    start: "17:15",
    end: "18:00",
    activity: "Pack Up/Dismissal",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
];

const GROUP_C: ScheduleItem[] = [
  {
    id: "c1",
    start: "08:00",
    end: "08:30",
    activity: "Reading",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "c2",
    start: "08:30",
    end: "09:30",
    activity: "Sensory Play",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "off",
  },
  {
    id: "c3",
    start: "09:30",
    end: "10:30",
    activity: "Social Group",
    location: "Classroom",
    alert: "audio",
  },
  {
    id: "c4",
    start: "10:30",
    end: "11:00",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "c5",
    start: "11:00",
    end: "12:00",
    activity: "Arts and Crafts",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "c6",
    start: "12:00",
    end: "12:45",
    activity: "Lunch",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "c7",
    start: "12:45",
    end: "13:45",
    activity: "Gross Motor Play",
    location: "Big Gym",
    alert: "audio",
  },
  {
    id: "c8",
    start: "13:45",
    end: "14:45",
    activity: "Discreet Trials",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
  {
    id: "c9",
    start: "14:45",
    end: "15:15",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "c10",
    start: "15:15",
    end: "16:15",
    activity: "Imaginative Play",
    location: "Classroom",
    alert: "off",
  },
  {
    id: "c11",
    start: "16:15",
    end: "17:15",
    activity: "Peer Play",
    location: "Small Gym",
    alert: "audio",
  },
  {
    id: "c12",
    start: "17:15",
    end: "18:00",
    activity: "Pack Up/Dismissal",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
];

// "Sensory Play" (formerly 11:15–11:45) was removed on purpose, leaving a
// real blank stretch mid-morning to demonstrate the edit mode's
// "Add Activity" gap buttons — which now render for any contiguous gap, not
// just the one before the first item or after the last.
const PHINEAS: ScheduleItem[] = [
  {
    id: "p1",
    start: "10:00",
    end: "10:20",
    activity: "Arrive/Pairing",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "visual",
  },
  {
    id: "p2",
    start: "10:20",
    end: "10:30",
    activity: "Potty Time",
    location: "Solo Bathroom",
    alert: "off",
  },
  {
    id: "p3",
    start: "10:30",
    end: "11:15",
    activity: "Discreet Trials",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
  {
    id: "p5",
    start: "11:45",
    end: "12:00",
    activity: "Potty Time",
    location: "Learner Bathroom",
    alert: "off",
  },
  {
    id: "p6",
    start: "12:00",
    end: "12:30",
    activity: "Lunch",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "p7",
    start: "12:30",
    end: "13:15",
    activity: "Gross Motor Play",
    location: "Big Gym",
    alert: "audio",
  },
  {
    id: "p8",
    start: "13:15",
    end: "13:30",
    activity: "Potty Time",
    location: "Classroom Bathroom",
    alert: "off",
  },
  {
    id: "p9",
    start: "13:30",
    end: "14:00",
    activity: "Snack",
    location: "Kitchen",
    alert: "visual",
  },
  {
    id: "p10",
    start: "14:00",
    end: "14:45",
    activity: "Imaginative Play",
    location: "Classroom",
    alert: "off",
  },
  {
    id: "p11",
    start: "14:45",
    end: "15:30",
    activity: "Peer Play",
    location: "Small Gym",
    alert: "audio",
  },
  {
    id: "p12",
    start: "15:30",
    end: "15:45",
    activity: "Potty Time",
    location: "Learner Bathroom",
    alert: "off",
  },
  {
    id: "p13",
    start: "15:45",
    end: "16:30",
    activity: "Client Choice",
    location: "Classroom",
    alert: "off",
  },
  {
    id: "p14",
    start: "16:30",
    end: "17:30",
    activity: "Reading",
    location: "Classroom",
    alert: "visual",
  },
  {
    id: "p15",
    start: "17:30",
    end: "18:00",
    activity: "Pack Up/Dismissal",
    location: ASSIGNED_ROOM_TOKEN,
    alert: "audio",
  },
];

const PRESETS: Schedule[] = [
  { name: "Phineas' Schedule", items: PHINEAS, appointments: PHINEAS_APPTS },
  { name: "Group A", items: GROUP_A, appointments: [], locked: true },
  { name: "Group B", items: GROUP_B, appointments: [], locked: true },
  { name: "Group C", items: GROUP_C, appointments: [], locked: true },
];

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
// `use24Hour` mirrors the Settings 24-hour toggle (see SettingsContext's
// `use24HourTime`) — `t` is already 24h "HH:MM" here, so that branch is a
// plain pass-through rather than a second conversion.
function fmt12(t: string, use24Hour: boolean) {
  if (use24Hour) return t;
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "p" : "a";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")}${period}`;
}

// Randomly pins ~half of every schedule's activities (autofade off) — a
// fresh draw each time this is called, used to seed the initial demo state
// client-side only (see the layout effect below), not inside a lazy
// `useState` initializer directly: this view now stays permanently mounted
// (routes/index.tsx) rather than only ever mounting client-side well after
// hydration, so a random value straight in the initializer mismatched
// between the server's own draw and the client's, tripping a hydration
// error.
function randomizeSchedules(): Schedule[] {
  return PRESETS.map((s) => ({
    ...s,
    items: s.items.map((it) => {
      if (Math.random() >= 0.5) return it;
      const mode: AlertMode = it.alert === "off" ? "visual" : it.alert;
      return {
        ...it,
        alert: mode,
        alertCfg: { mode, allowSnooze: true, autofade: false },
      };
    }),
  }));
}

function fromMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Real (wall-clock) epoch ms equivalent of a minutes-of-day value on the
// schedule's own simulated clock — anchored to the ACTUAL current time
// (Date.now()) and offset by how far `targetMin` sits from `simNowMin` on
// that simulated clock, rather than stamping `targetMin` onto today's real
// calendar date directly. This view's own `now` is a demo clock (seeded
// once, then randomized shortly after mount, and otherwise only advanced by
// tapping the "+10 min" button) that can sit anywhere relative to the
// device's actual clock — stamping a target minute onto a real calendar day
// and comparing THAT against a different, genuinely-real Date.now()
// elsewhere (NotificationBar's own live relativeTime badge ticks off the
// real clock) produced wildly wrong "ago" labels — e.g. "327 minutes ago"
// on an alert that had just fired — even though nothing was actually late.
// Offsetting from the real "now" instead keeps both sides of that
// comparison on the same clock: a fire at the instant a threshold is
// crossed always lands within a few ms of "Now".
function activityAtFromSimTime(targetMin: number, simNowMin: number): number {
  return Date.now() + (targetMin - simNowMin) * 60_000;
}

// Abbreviated to save room next to the time-entry boxes — "30mins",
// "1hr 15mins" — matching the boxes' own no-space "10:30a" convention.
function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}hr`);
  if (m > 0 || h === 0) parts.push(`${m}mins`);
  return parts.join(" ");
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart);
}

const INPUT_BLUE_CLS = "border-2 border-blue-400 focus-visible:ring-blue-400";

export function ScheduleView({
  scrollTargetId,
  onScrolledToTarget,
  contentRef,
}: {
  scrollTargetId?: string | null;
  onScrolledToTarget?: () => void;
  /** The app-shell's own internally-scrolling content pane this view
   *  renders inside — the schedule-switch reset scrolls it directly
   *  rather than the window, and the sticky toggles bar's compact-mode
   *  tracking measures pinning against this container. */
  contentRef: RefObject<HTMLElement | null>;
}) {
  const { dayStart: dayStartTime, dayEnd: dayEndTime, use24HourTime } = useSettings();
  // `now`/`bumpTime` live in ScheduleContext now, not here — shared with
  // IntervalCard's checkpoint-mode alerts so they read the exact same
  // simulated demo clock instead of a second, independently-real one that
  // could disagree with it. See that context's own comment.
  const { now, bumpTime, setPhineasAppointments, assignedRoom } = useScheduleData();
  // See randomizeSchedules' own comment for why this can't just be a random
  // draw straight in this lazy initializer.
  const [schedules, setSchedules] = useState<Schedule[]>(PRESETS);
  useLayoutEffect(() => {
    setSchedules(randomizeSchedules());
  }, []);

  const [activeName, setActiveName] = useState<string>("Phineas' Schedule");
  const active = schedules.find((s) => s.name === activeName) ?? schedules[0];
  const isLocked = !!active.locked;

  // Keeps ClientInfoPane's Related Service Times row in sync with whatever
  // is actually on Phineas' Schedule here — looked up by name rather than
  // just using `active` since the Schedule tab's own dropdown can have a
  // different preset (Group A/B/C) selected at any given moment.
  useEffect(() => {
    const phineasSchedule = schedules.find((s) => s.name === "Phineas' Schedule");
    if (phineasSchedule) setPhineasAppointments(phineasSchedule.appointments);
  }, [schedules, setPhineasAppointments]);

  const [editMode, setEditMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"proportional" | "collapsed">("proportional");
  const [showAppts, setShowAppts] = useState(true);
  const [showIcons, setShowIcons] = useState(true);
  const [collapsedAppts, setCollapsedAppts] = useState<Record<string, boolean>>({});
  const [allApptsCollapsed, setAllApptsCollapsed] = useState(false);

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  // Default start/end pre-filled for the gap being added into (see
  // openAddActivity below) — non-null both opens ItemDialog and seeds it.
  const [creatingNew, setCreatingNew] = useState<{ start: string; end: string } | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [creatingAppt, setCreatingAppt] = useState(false);
  // Whether RoomInfoDialog is open at all, and which room it's showing —
  // kept separate (rather than "open iff a room is set") because the
  // dialog's own base view (the full floor plan, no room selected) is a
  // real, reachable state too, via its own back arrow — see RoomInfoDialog's
  // own comment. A tappable location in a schedule row sets both at once
  // (opens straight to that room); the dialog's own back arrow only clears
  // roomInfoRoom, leaving roomInfoDialogOpen untouched.
  const [roomInfoDialogOpen, setRoomInfoDialogOpen] = useState(false);
  const [roomInfoRoom, setRoomInfoRoom] = useState<string | null>(null);
  const [newSchedOpen, setNewSchedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmItemDelete, setConfirmItemDelete] = useState<ScheduleItem | null>(null);
  const [confirmApptDelete, setConfirmApptDelete] = useState<Appointment | null>(null);
  const [nowAnim, setNowAnim] = useState(0); // bump to retrigger the Now-button chevron bounce
  // Flashes a specific row's own visible box — decoupled from `isCurrent` so
  // a notification-tap jump can flash whichever activity it points at, not
  // only the live current one.
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [flashGen, setFlashGen] = useState(0);
  const triggerRowFlash = (id: string) => {
    setFlashRowId(id);
    setFlashGen((n) => n + 1);
  };
  const togglesSentinelRef = useRef<HTMLDivElement>(null);
  const stickyCompact = useStickyCompact(togglesSentinelRef, contentRef);

  const items = active.items;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  // Fixed to the configured clinic hours (Settings tab), not derived from
  // the items, so any slack before the first item or after the last renders
  // as real, visible blank space in the grid — that's what the edit-mode
  // "Add Activity" gap buttons below are anchored to.
  const dayStart = toMin(dayStartTime);
  const dayEnd = toMin(dayEndTime);
  const currentItem = items.find((i) => nowMin >= toMin(i.start) && nowMin < toMin(i.end));
  const outsideSchedule = !currentItem;
  // An appointment overlay paints on top of (z-20) whatever regular item is
  // happening underneath it — if "now" falls inside one, the line has to
  // stay at the list level (see arrowTop's own rendering below) so it still
  // shows crossing the appointment bubble, rather than the in-row treatment
  // that would otherwise apply for the item underneath and get hidden below
  // the appointment's higher z-index.
  const currentAppt = showAppts
    ? active.appointments.find((a) => nowMin >= toMin(a.start) && nowMin < toMin(a.end))
    : undefined;

  // ---- Alert firing: when `now` crosses an item's priming or start time,
  // push a notification. Idempotent per (itemId, kind, day) via dedupeKey.
  // Only actually pops the live banner while the technician is in their own
  // running session (`inSession` below) — otherwise nobody's there to act
  // on an interruption, so it's pushed straight to the Notifications tab
  // instead (see `live: false`, and NotificationContext's own handling of
  // it). Same gate covers a threshold detected well after the fact (see
  // STALE_ALERT_GRACE_MIN) — either way, it still lands in the tab; it just
  // never pops or chimes.
  const { push: pushNotification, prefs: notificationPrefs } = useNotifications();
  const { sessionRunning, isSessionMine } = useSession();
  const inSession = sessionRunning && isSessionMine;
  const lastNowMinRef = useRef<number>(nowMin);
  useEffect(() => {
    const prevMin = lastNowMinRef.current;
    lastNowMinRef.current = nowMin;
    if (nowMin <= prevMin) return; // only fire on forward time progression
    const dayKey = now.toDateString();
    for (const it of items) {
      const startMin = toMin(it.start);
      const alertCfg = it.alertCfg ?? { ...DEFAULT_ALERT, mode: it.alert };
      const priming = it.priming;
      // alert-now
      if (alertCfg.mode !== "off" && prevMin < startMin && nowMin >= startMin) {
        pushNotification({
          dedupeKey: `alert-now:${it.id}:${dayKey}`,
          kind: "alert-now",
          title: `${it.customName ?? it.activity}`,
          body: resolveLocation(it.location, assignedRoom),
          icon: alertCfg.mode === "audio" ? "bell-chime" : "bell",
          autofadeMs: alertCfg.autofade ? notificationPrefs.notificationDurationMs : undefined,
          allowSnooze: alertCfg.allowSnooze,
          sourceRef: { type: "activity", id: it.id },
          activityAt: activityAtFromSimTime(startMin, nowMin),
          live: inSession && nowMin - startMin <= STALE_ALERT_GRACE_MIN,
        });
      }
      // alert-priming
      if (priming && priming.mode !== "off") {
        const primeMin = startMin - priming.minutesPrior;
        if (prevMin < primeMin && nowMin >= primeMin) {
          pushNotification({
            dedupeKey: `alert-priming:${it.id}:${dayKey}`,
            kind: "alert-priming",
            // No baked-in "In X min" here — that would go stale the moment
            // real time moves past whatever it said at push time (and
            // eventually read as flatly wrong, e.g. still "In 5 min" a
            // minute before it actually starts). NotificationRow's own
            // relativeTime badge (driven by activityAt below) already shows
            // an always-current "In X minutes" / "Now" / "X minutes ago" —
            // this title just needs to name the activity.
            title: it.customName ?? it.activity,
            body: resolveLocation(it.location, assignedRoom),
            icon: priming.mode === "audio" ? "bell-chime" : "bell",
            autofadeMs: priming.autofade ? notificationPrefs.notificationDurationMs : undefined,
            allowSnooze: priming.allowSnooze,
            sourceRef: { type: "activity", id: it.id },
            activityAt: activityAtFromSimTime(startMin, nowMin),
            live: inSession && nowMin - primeMin <= STALE_ALERT_GRACE_MIN,
          });
        }
      }
    }
    // Appointments carry the exact same alertCfg/priming shape (and their
    // own add/edit dialog's AlertsBlock lets a user configure it) but were
    // never actually checked here — every appointment alert was silently
    // dead regardless of what its dialog said.
    for (const appt of active.appointments) {
      const startMin = toMin(appt.start);
      const alertCfg = appt.alertCfg ?? DEFAULT_ALERT;
      const priming = appt.priming;
      // alert-now
      if (alertCfg.mode !== "off" && prevMin < startMin && nowMin >= startMin) {
        pushNotification({
          dedupeKey: `alert-now:${appt.id}:${dayKey}`,
          kind: "alert-now",
          title: appt.type,
          body: appt.provider,
          icon: alertCfg.mode === "audio" ? "bell-chime" : "bell",
          autofadeMs: alertCfg.autofade ? notificationPrefs.notificationDurationMs : undefined,
          allowSnooze: alertCfg.allowSnooze,
          sourceRef: { type: "activity", id: appt.id },
          activityAt: activityAtFromSimTime(startMin, nowMin),
          live: inSession && nowMin - startMin <= STALE_ALERT_GRACE_MIN,
        });
      }
      // alert-priming
      if (priming && priming.mode !== "off") {
        const primeMin = startMin - priming.minutesPrior;
        if (prevMin < primeMin && nowMin >= primeMin) {
          pushNotification({
            dedupeKey: `alert-priming:${appt.id}:${dayKey}`,
            kind: "alert-priming",
            // See the matching item-alert push above for why this doesn't
            // bake in "In X min" — NotificationRow's own live relativeTime
            // badge (activityAt below) covers that, always current.
            title: appt.type,
            body: appt.provider,
            icon: priming.mode === "audio" ? "bell-chime" : "bell",
            autofadeMs: priming.autofade ? notificationPrefs.notificationDurationMs : undefined,
            allowSnooze: priming.allowSnooze,
            sourceRef: { type: "activity", id: appt.id },
            activityAt: activityAtFromSimTime(startMin, nowMin),
            live: inSession && nowMin - primeMin <= STALE_ALERT_GRACE_MIN,
          });
        }
      }
    }
  }, [
    nowMin,
    items,
    active.appointments,
    now,
    pushNotification,
    notificationPrefs,
    inSession,
    assignedRoom,
  ]);

  const updateActive = (mut: (items: ScheduleItem[]) => ScheduleItem[]) => {
    setSchedules((prev) =>
      prev.map((s) => (s.name === activeName ? { ...s, items: mut(s.items) } : s)),
    );
  };

  const updateActiveAppts = (mut: (a: Appointment[]) => Appointment[]) => {
    setSchedules((prev) =>
      prev.map((s) => (s.name === activeName ? { ...s, appointments: mut(s.appointments) } : s)),
    );
  };

  const duplicateActive = () => {
    const baseName = active.name.replace(/^Custom \(|\)$/g, "");
    let name = `Custom (${baseName})`;
    let n = 2;
    while (schedules.some((s) => s.name === name)) {
      name = `Custom (${baseName}) ${n++}`;
    }
    setSchedules((p) => [
      ...p,
      {
        name,
        items: active.items.map((x) => ({ ...x, id: `${x.id}_${Date.now()}` })),
        appointments: active.appointments.map((x) => ({ ...x, id: `${x.id}_${Date.now()}` })),
      },
    ]);
    setActiveName(name);
  };

  const createNewSchedule = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let final = trimmed;
    let n = 2;
    while (schedules.some((s) => s.name === final)) final = `${trimmed} ${n++}`;
    setSchedules((p) => [...p, { name: final, items: [], appointments: [] }]);
    setActiveName(final);
    setEditMode(true);
  };

  const renameActive = (newName: string) => {
    if (!newName.trim() || schedules.some((s) => s.name === newName)) return;
    setSchedules((p) => p.map((s) => (s.name === activeName ? { ...s, name: newName } : s)));
    setActiveName(newName);
  };

  // Edit mode swaps the schedule-name pill for a plain text field (see
  // render below) — typing directly in is the rename, so there's no
  // separate Rename button/modal anymore. Committed on blur/Enter rather
  // than on every keystroke, so a mid-typing collision with another
  // schedule's name doesn't reject partial input; an invalid result just
  // reverts to the current name instead of leaving the field stuck.
  const [scheduleNameDraft, setScheduleNameDraft] = useState(activeName);
  useEffect(() => {
    if (editMode) setScheduleNameDraft(activeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);
  const commitScheduleNameDraft = () => {
    const trimmed = scheduleNameDraft.trim();
    if (!trimmed || trimmed === activeName) {
      setScheduleNameDraft(activeName);
      return;
    }
    if (schedules.some((s) => s.name === trimmed)) {
      setScheduleNameDraft(activeName);
      return;
    }
    renameActive(trimmed);
  };

  const deleteActive = () => {
    if (isLocked) return;
    const remaining = schedules.filter((s) => s.name !== activeName);
    if (remaining.length === 0) return;
    setSchedules(remaining);
    setActiveName(remaining[0].name);
    setEditMode(false);
  };

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const numericDate = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = formatTimeOfDayForDisplay(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    use24HourTime,
  );

  // Edit mode's "Add Activity" is offered into any genuine blank stretch —
  // before the first item, between any two items, and after the last —
  // each becomes its own row alongside the real items, in both layout
  // modes, so a gap is never just invisible dead space. The before-first
  // and after-last gaps are tagged as "edge" — in proportional mode those
  // two get special treatment (hidden outside edit mode, capped height
  // inside it) that the gaps between two items don't.
  type Gap = { startMin: number; endMin: number; edge?: "before" | "after" };
  type Row = { kind: "item"; item: ScheduleItem } | { kind: "gap"; gap: Gap };
  const allRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let cursor = dayStart;
    items.forEach((it, idx) => {
      const s = toMin(it.start);
      if (s > cursor)
        out.push({
          kind: "gap",
          gap: { startMin: cursor, endMin: s, edge: idx === 0 ? "before" : undefined },
        });
      out.push({ kind: "item", item: it });
      cursor = Math.max(cursor, toMin(it.end));
    });
    if (dayEnd > cursor)
      out.push({ kind: "gap", gap: { startMin: cursor, endMin: dayEnd, edge: "after" } });
    return out;
  }, [items, dayStart, dayEnd]);

  const rows: Row[] = useMemo(() => {
    if (editMode) return allRows;
    if (layoutMode === "collapsed") return allRows.filter((r) => r.kind === "item");
    // Proportional, not editing: keep gaps between items (with their
    // divider lines) but trim away the dead space before the first item
    // and after the last — that's the "extra blank time" nobody's editing
    // into right now.
    return allRows.filter((r) => r.kind === "item" || !r.gap.edge);
  }, [allRows, editMode, layoutMode]);

  // Proportional mode's effective top-of-grid/bottom-of-grid time values.
  // Outside edit mode these are just the first item's start and the last
  // item's end (the edge gaps are excluded from `rows` entirely above).
  // Inside edit mode, both edges grow just enough to fit the "Add Activity"
  // button — capped to the real gap size, so a genuinely short gap never
  // gets padded out past where the actual clinic hours end.
  const firstBoundaryMin = items.length ? toMin(items[0].start) : dayStart;
  const lastBoundaryMin = items.length ? toMin(items[items.length - 1].end) : dayEnd;
  const beforeFirstEditMin = Math.min(
    Math.max(0, firstBoundaryMin - dayStart),
    EDGE_ADD_ACTIVITY_PX / PX_PER_MIN,
  );
  const afterLastEditMin = Math.min(
    Math.max(0, dayEnd - lastBoundaryMin),
    EDGE_ADD_ACTIVITY_PX / PX_PER_MIN,
  );
  const renderOriginMin = editMode ? firstBoundaryMin - beforeFirstEditMin : firstBoundaryMin;
  const renderEndMin = editMode ? lastBoundaryMin + afterLastEditMin : lastBoundaryMin;

  // Compute each row's top and height based on layoutMode.
  const rowLayout = useMemo(() => {
    if (layoutMode === "collapsed") {
      return rows.map((row, idx) => ({
        row,
        top: idx * COLLAPSED_ROW_PX,
        height: COLLAPSED_ROW_PX,
      }));
    }
    return rows.map((row) => {
      if (row.kind === "item") {
        const top = (toMin(row.item.start) - renderOriginMin) * PX_PER_MIN;
        const durMin = Math.max(toMin(row.item.end) - toMin(row.item.start), MIN_ROW_MIN);
        return { row, top, height: durMin * PX_PER_MIN };
      }
      if (row.gap.edge === "before") {
        return { row, top: 0, height: beforeFirstEditMin * PX_PER_MIN };
      }
      if (row.gap.edge === "after") {
        return {
          row,
          top: (lastBoundaryMin - renderOriginMin) * PX_PER_MIN,
          height: afterLastEditMin * PX_PER_MIN,
        };
      }
      const top = (row.gap.startMin - renderOriginMin) * PX_PER_MIN;
      return { row, top, height: (row.gap.endMin - row.gap.startMin) * PX_PER_MIN };
    });
  }, [rows, layoutMode, renderOriginMin, beforeFirstEditMin, afterLastEditMin, lastBoundaryMin]);

  // Item-only view of rowLayout for consumers that only make sense against
  // real activities (the "now" arrow, appointment overlays, item rendering).
  const itemRowLayout = useMemo(() => {
    const out: { item: ScheduleItem; top: number; height: number }[] = [];
    for (const r of rowLayout) {
      if (r.row.kind === "item") out.push({ item: r.row.item, top: r.top, height: r.height });
    }
    return out;
  }, [rowLayout]);

  const totalHeight =
    layoutMode === "collapsed"
      ? Math.max(rows.length * COLLAPSED_ROW_PX, COLLAPSED_ROW_PX)
      : (renderEndMin - renderOriginMin) * PX_PER_MIN;

  const openAddActivity = (gap: Gap) => {
    // Default to filling the gap's entire available span — the reset
    // buttons on each time field start out disabled/grayed exactly because
    // the values already match the gap's full extent (see TimeField). This
    // is always the gap's real bounds, even for an edge gap whose rendered
    // height is capped down to just fit the button.
    setCreatingNew({ start: fromMin(gap.startMin), end: fromMin(gap.endMin) });
  };

  const arrowTop = (() => {
    if (editMode) return null;
    if (layoutMode === "proportional") {
      // renderOriginMin/renderEndMin (non-edit) are exactly the first
      // item's start and the last item's end — comparing against those
      // (not the real, possibly much wider, clinic-hours dayStart/dayEnd)
      // is what correctly parks the arrow before the first item rather
      // than at the bottom when "now" is earlier than everything on the
      // schedule. Anywhere in between maps straight to its real proportional
      // position, whether that's inside an item or a blank gap between two.
      if (nowMin < renderOriginMin) return -2;
      if (nowMin >= renderEndMin) return totalHeight + 16;
      return (nowMin - renderOriginMin) * PX_PER_MIN;
    }
    if (currentItem) {
      const row = itemRowLayout.find((r) => r.item.id === currentItem.id);
      if (row) return row.top + row.height / 2;
    }
    return nowMin < firstBoundaryMin ? -2 : totalHeight + 16;
  })();
  const arrowGray = outsideSchedule;
  // Only the "after hours" case has genuine empty space below the last row
  // to show the label in without overlapping the header or a row.
  const showOutsideOfHoursLabel = arrowGray && nowMin >= dayEnd;

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToNow = () => {
    // No item spans `now` exactly — either it's a gap between two items, or
    // before the first / after the last. In every one of those cases the
    // nearest useful thing to jump to is whichever item starts next; once
    // we're past the very last item's end, there is no "next" one left, so
    // fall back to the last item instead (the "end of schedule" case).
    const target =
      currentItem ?? items.find((i) => toMin(i.start) >= nowMin) ?? items[items.length - 1];
    if (!target) return;
    const el = rowRefs.current.get(target.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerRowFlash(target.id);
    setNowAnim((n) => n + 1);
  };

  // Auto-scroll only when the current activity actually changes after mount —
  // do NOT scroll on initial mount / tab switch, and do NOT scroll just
  // because the user picked a different schedule from the dropdown (that
  // should land at the top and let them invoke "Now" themselves).
  const didInitScrollRef = useRef(false);
  const prevActiveNameForScrollRef = useRef(activeName);
  useEffect(() => {
    if (!didInitScrollRef.current) {
      didInitScrollRef.current = true;
      prevActiveNameForScrollRef.current = activeName;
      return;
    }
    const scheduleChanged = activeName !== prevActiveNameForScrollRef.current;
    prevActiveNameForScrollRef.current = activeName;
    if (scheduleChanged) {
      contentRef.current?.scrollTo({ top: 0 });
      return;
    }
    if (!currentItem) return;
    const el = rowRefs.current.get(currentItem.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id, layoutMode, activeName]);

  // Scroll to a notification's source activity when requested from outside.
  useEffect(() => {
    if (!scrollTargetId) return;
    const el = rowRefs.current.get(scrollTargetId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerRowFlash(scrollTargetId);
    onScrolledToTarget?.();
  }, [scrollTargetId, onScrolledToTarget]);

  const setAlertFor = (it: ScheduleItem, m: AlertMode) => {
    updateActive((list) => list.map((x) => (x.id === it.id ? { ...x, alert: m } : x)));
  };

  // Appointment overlays, positioned via rowLayout so collapsed mode also
  // lines up. Always computed regardless of `showAppts` — that toggle just
  // hides the rendered elements via CSS (see `hidden` below), the same
  // instant show/hide as the Icons toggle, rather than mounting/unmounting
  // them and triggering their entrance animation.
  const visibleAppts = useMemo(() => {
    return active.appointments.map((a) => {
      if (layoutMode === "proportional") {
        const top = (toMin(a.start) - dayStart) * PX_PER_MIN;
        const height = Math.max(toMin(a.end) - toMin(a.start), MIN_ROW_MIN) * PX_PER_MIN;
        return { appt: a, top, height };
      }
      // Collapsed mode: rows are uniform height regardless of real duration,
      // so pinning to a row's full top/bottom (as if the appt spanned the
      // whole row) misrepresents where within the row it actually falls.
      // Interpolate proportionally within each row's own real time span
      // instead, same idea as proportional mode but scoped per-row.
      const pxWithinRow = (row: (typeof itemRowLayout)[number], minutes: number) => {
        const rowStart = toMin(row.item.start);
        const rowEnd = toMin(row.item.end);
        const span = Math.max(rowEnd - rowStart, 1);
        const frac = Math.min(1, Math.max(0, (minutes - rowStart) / span));
        return row.top + frac * row.height;
      };
      const aStart = toMin(a.start);
      const aEnd = toMin(a.end);
      const startRow =
        itemRowLayout.find((r) => aStart >= toMin(r.item.start) && aStart < toMin(r.item.end)) ??
        itemRowLayout.find((r) => toMin(r.item.start) >= aStart) ??
        itemRowLayout[itemRowLayout.length - 1];
      const endRow =
        itemRowLayout.find((r) => aEnd > toMin(r.item.start) && aEnd <= toMin(r.item.end)) ??
        startRow;
      const top = startRow ? pxWithinRow(startRow, aStart) : 0;
      const bottom = endRow ? pxWithinRow(endRow, aEnd) : top + COLLAPSED_ROW_PX;
      const MIN_APPT_PX = 20;
      return { appt: a, top, height: Math.max(bottom - top, MIN_APPT_PX) };
    });
  }, [active.appointments, layoutMode, dayStart, itemRowLayout]);

  return (
    // pt-2: the small top gap this view wants used to live on the scroll
    // container itself (routes/index.tsx's own <section>), but padding on a
    // sticky element's scrolling ancestor doesn't get covered by it once
    // stuck — scrolled-past content peeks through that gap above the
    // toggles row below. This wrapper isn't itself a scroll container, so
    // the same padding here is safe: it just adds space before the date
    // header, the toggles row included, with nothing for it to leak past.
    <div className="max-w-3xl mx-auto pt-2 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl leading-tight">{dateStr}</h1>
          <div className="text-xs text-muted-foreground tabular-nums">{numericDate}</div>
        </div>
        <div className="flex flex-col items-end">
          <button
            type="button"
            onClick={bumpTime}
            className="text-right rounded-md px-1 -mr-1 active:bg-stone-100"
            title="Tap to advance 10 minutes (demo)"
          >
            <div className="font-display text-xl tabular-nums">{timeStr}</div>
          </button>
          <Button
            type="button"
            size="sm"
            onClick={scrollToNow}
            disabled={editMode}
            data-tour="schedule-now-button"
            className={cn(
              "mt-0.5 h-6 text-[10px] uppercase tracking-wide text-white rounded-full px-2 py-0 gap-1",
              !currentItem || editMode
                ? "bg-stone-300 hover:bg-stone-300"
                : "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
            )}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M6 1.5v5.5M3.5 5.5L6 8 8.5 5.5M2.5 9.5h7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Now
          </Button>
        </div>
      </div>

      {/* Schedule selector — edit mode swaps this for a plain text field
          (typing directly in IS the rename, so there's no separate Rename
          button/modal). Not focused or selected on entry; the user taps in
          when they're ready. */}
      <div className="mt-4 flex items-center gap-2 px-1">
        {editMode ? (
          <Input
            value={scheduleNameDraft}
            onChange={(e) => setScheduleNameDraft(e.target.value)}
            onBlur={commitScheduleNameDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitScheduleNameDraft();
                e.currentTarget.blur();
              }
            }}
            // Same inset-field look as TimeField (pill border + inner
            // shadow), so it reads as an actual text entry rather than the
            // plain-text-with-hidden-border stand-in this used to be. Black
            // text (not the trigger's blue) plus an even stronger inset
            // shadow than the smaller fields use — at this size and weight,
            // a lighter shadow reads as decoration rather than a carved-in,
            // clearly-editable well.
            className="flex-1 min-w-0 h-11 text-base rounded-full px-4 font-bold border-2 border-blue-400 bg-white text-black shadow-[inset_0_3px_6px_rgba(0,0,0,0.26)] transition-colors"
            style={{ transitionDuration: `${EDIT_MODE_DURATION_MS}ms` }}
          />
        ) : (
          <Select value={activeName} onValueChange={setActiveName}>
            <SelectTrigger
              // min-w-0 lets this shrink below its text's intrinsic width —
              // without it, a long schedule name can force the flex row wider
              // than the viewport and push Cancel/Save off screen.
              className="flex-1 min-w-0 h-11 text-base rounded-full px-4 font-bold border-2 bg-white border-blue-400 text-blue-700 focus:ring-blue-400 transition-colors"
              style={{ transitionDuration: `${EDIT_MODE_DURATION_MS}ms` }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schedules.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  <span className="inline-flex items-center gap-1.5">
                    {s.name}
                    {s.name === CLIENT_GROUP && (
                      <Star
                        className="size-3.5 text-blue-600"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-label="Client's group"
                      />
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* `relative` is load-bearing, not decorative: the exiting child
            below gets `position: absolute` from AnimatePresence's
            `popLayout` (so it stops taking up flex space once it starts
            leaving), and an absolutely-positioned element's containing
            block is its nearest *positioned* ancestor — skipping straight
            past this `overflow-hidden` div if it were left `static`, all
            the way up to the viewport. That let the sliding Cancel/Save
            pair render fully unclipped past the right edge, inflating
            `document.documentElement.scrollWidth` for the ~300ms of the
            exit — which is exactly the class of bug the "now" button fix
            elsewhere in this file also guards against: mobile browsers
            shrink-to-fit the *entire page* to accommodate that overflow,
            reading as the whole schedule visibly scaling down and back. */}
        <div className="relative flex items-center gap-1 overflow-hidden">
          {/* No `layout` on this wrapper — a layout-animated parent scales
              its whole subtree during the FLIP transition, which visibly
              stretches children that aren't themselves layout-aware. Each
              child instead handles its own entrance/exit (scale for the
              pencil, an off-screen slide for Cancel/Save), so nothing here
              distorts. */}
          <AnimatePresence mode="popLayout" initial={false}>
            {editMode ? (
              <motion.div
                key="edit-actions"
                className="flex items-center gap-1"
                initial={{ opacity: 0, x: "130%" }}
                animate={{
                  opacity: 1,
                  x: 0,
                  transition: {
                    type: "spring",
                    stiffness: 380,
                    damping: 34,
                    delay: EDIT_MODE_STAGGER_MS / 1000,
                  },
                }}
                exit={{
                  opacity: 0,
                  x: "130%",
                  transition: { duration: EDIT_MODE_DURATION_MS / 1000 },
                }}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 rounded-full text-stone-500 hover:bg-stone-100"
                  onClick={() => setEditMode(false)}
                  aria-label="Cancel"
                >
                  <X className="size-5" />
                </Button>
                <Button
                  className="h-11 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white px-4 gap-1.5"
                  onClick={() => setEditMode(false)}
                  aria-label="Save"
                >
                  Save <Check className="size-5" />
                </Button>
              </motion.div>
            ) : (
              <motion.button
                key="pencil-btn"
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setEditMode(true);
                }}
                disabled={isLocked}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: EDIT_MODE_DURATION_MS / 1000 }}
                className={cn(
                  "h-11 w-11 grid place-content-center rounded-full shrink-0",
                  isLocked
                    ? "text-stone-300 cursor-not-allowed"
                    : "text-blue-500 hover:text-blue-600",
                )}
                aria-label={isLocked ? "Locked — duplicate to edit" : "Edit schedule"}
                title={isLocked ? "Locked — duplicate to edit" : "Edit schedule"}
              >
                {isLocked ? <PencilOff className="size-5" /> : <Pencil className="size-5" />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {editMode && (
          <motion.div
            key="edit-actions-row"
            initial={{ opacity: 0, scale: 0.9, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: "auto" }}
            exit={{ opacity: 0, scale: 0.9, height: 0 }}
            transition={{ duration: EDIT_MODE_DURATION_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
            // overflow-hidden so the mid-animation height doesn't clip
            // content abruptly; the space itself now closes in step with
            // the fade instead of holding full height until the instant
            // it unmounts (which read as a sudden jump).
            className="mt-2 space-y-2 px-1 overflow-hidden"
          >
            <div className="flex items-center gap-1 flex-nowrap">
              <Button
                size="sm"
                className="h-8 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white px-2.5 text-xs gap-1 [&_svg]:size-3"
                onClick={duplicateActive}
              >
                <Copy /> Duplicate
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white px-2.5 text-xs gap-1 [&_svg]:size-3"
                onClick={() => setNewSchedOpen(true)}
              >
                <Plus /> New
              </Button>
              {/* Hollow, unlike the others — destructive action, not a focus. */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full border-2 border-blue-300 bg-transparent text-blue-700 hover:bg-blue-50 px-2.5 text-xs gap-1 [&_svg]:size-3 ml-auto"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {editMode && (
          <motion.div
            key="edit-content"
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: EDIT_MODE_DURATION_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
            // Extra top margin (vs. the mt-3 used elsewhere) sets this block
            // visually apart from the action-buttons row above it. Height
            // animates alongside the fade (see edit-actions-row above) so
            // the space collapses smoothly instead of jumping on unmount.
            className="mt-6 px-1 space-y-3 overflow-hidden"
          >
            {/* Appointments editor */}
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                  <HandHelping className="size-4" /> Appointments
                </div>
                <Button
                  size="sm"
                  className="h-7 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white px-3 [&_svg]:size-3"
                  onClick={() => setCreatingAppt(true)}
                >
                  Add <Plus className="ml-1" />
                </Button>
              </div>
              {active.appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No appointments yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {active.appointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          <span className="mr-1">{APPOINTMENT_TYPE_ICONS[a.type] ?? ""}</span>
                          {a.type} <span className="text-muted-foreground">· {a.provider}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.days.join(", ")} · {fmt12(a.start, use24HourTime)}–
                          {fmt12(a.end, use24HourTime)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-blue-600 [&_svg]:size-3"
                        onClick={() => setEditingAppt(a)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-blue-600 [&_svg]:size-3"
                        onClick={() => setConfirmApptDelete(a)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* No standalone "Add Activity" button here — activities can only
              be added into genuine blank space (before the first item /
              after the last), via the gap buttons rendered directly in the
              grid below. */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggles row — sticky under StatusBar */}
      <div className="mt-3" />
      <div ref={togglesSentinelRef} className="h-0" aria-hidden />
      <div
        data-tour="schedule-toggles"
        className={cn(
          // overflow-x-hidden clips the "now" button below while it's
          // translated off-screen (waiting to slide in once pinned) — its
          // transformed box still counts toward layout overflow even at
          // opacity-0, which was inflating the page's scroll width and
          // making the browser auto-shrink-to-fit the whole viewport.
          "sticky top-0 z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] overflow-x-hidden bg-background border-b border-border/70 py-1.5 px-8",
          stickyCompact ? "shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]" : "shadow-none",
        )}
      >
        <div className="relative flex items-center text-xs gap-2 max-w-3xl mx-auto">
          <button
            type="button"
            data-tour="schedule-layout-toggle"
            onClick={() =>
              setLayoutMode((m) => (m === "proportional" ? "collapsed" : "proportional"))
            }
            className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600"
            title={
              layoutMode === "proportional"
                ? "Switch to collapsed (uniform) rows"
                : "Switch to proportional (time-scaled) rows"
            }
          >
            {layoutMode === "proportional" ? (
              <Rows3 className="size-3.5 shrink-0" />
            ) : (
              <ProportionalRowsIcon className="size-3.5 shrink-0" />
            )}
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                // Collapses first (no delay) when pinning; only reappears
                // once the title + now-button have finished leaving when
                // un-pinning (delay-300) — see the two below.
                stickyCompact ? "max-w-0 opacity-0 delay-0" : "max-w-[140px] opacity-100 delay-300",
              )}
            >
              {layoutMode === "proportional" ? "Collapsed" : "Proportional"}
            </span>
          </button>
          <button
            type="button"
            data-tour="schedule-appt-toggle"
            onClick={() => {
              setShowAppts((v) => !v);
              setAllApptsCollapsed(false);
              setCollapsedAppts({});
            }}
            className={cn(
              "flex items-center gap-1.5",
              showAppts ? "text-green-700" : "text-stone-400 hover:text-stone-600",
            )}
            title="Show or hide appointment overlays"
          >
            <HandHelping className="size-3.5 shrink-0" />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                stickyCompact ? "max-w-0 opacity-0 delay-0" : "max-w-[160px] opacity-100 delay-300",
              )}
            >
              Appointments
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowIcons((v) => !v)}
            className={cn(
              "flex items-center gap-1.5",
              showIcons ? "text-blue-600" : "text-stone-400 hover:text-stone-600",
            )}
            title="Show or hide activity and location icons"
          >
            <SmileyIcon className="size-3.5 shrink-0" />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                stickyCompact ? "max-w-0 opacity-0 delay-0" : "max-w-[120px] opacity-100 delay-300",
              )}
            >
              Icons
            </span>
          </button>

          {/* Centered schedule name — pinning: waits for the toggle icons'
              own collapse to finish (delay-300) before fading in, together
              with the now-button below. Un-pinning: fades away immediately
              (delay-0), together with the now-button, before the icons
              expand back. */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 flex items-center min-w-0 overflow-hidden transition-opacity duration-300 ease-out pointer-events-none",
              stickyCompact ? "opacity-100 delay-300" : "opacity-0 delay-0",
            )}
            aria-hidden={!stickyCompact}
          >
            <span className="text-xs font-bold text-stone-700 whitespace-nowrap truncate">
              {active.name}
            </span>
          </div>

          {/* Right-aligned time button — slides in from off-screen right
              at the same time the title fades in (both delay-300, after
              the icons collapse); slides out immediately with the title
              when un-pinning (both delay-0, before the icons expand back). */}
          <button
            type="button"
            onClick={scrollToNow}
            disabled={editMode}
            aria-hidden={!stickyCompact}
            tabIndex={stickyCompact ? 0 : -1}
            className={cn(
              "btn-bevel ml-auto inline-flex items-center gap-1 h-6 pl-2 pr-2.5 rounded-full text-[11px] font-semibold text-white tabular-nums transition-all duration-300 ease-out",
              stickyCompact
                ? "opacity-100 translate-x-0 delay-300"
                : "opacity-0 translate-x-[130%] pointer-events-none delay-0",
              !currentItem || editMode
                ? "bg-stone-300"
                : "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
            )}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M6 1.5v5.5M3.5 5.5L6 8 8.5 5.5M2.5 9.5h7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            {fmt12(`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`, use24HourTime)}
          </button>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="mt-3 mx-1 rounded-md border border-border relative">
        <div className="grid grid-cols-[40px_1fr_84px_34px] gap-1 px-1.5 py-1 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-stone-200 rounded-full">
          <div className="text-right pr-1.5">Time</div>
          <div className="flex items-center gap-1.5">
            <span className="invisible text-sm leading-none shrink-0" aria-hidden>
              •
            </span>
            <span>Activity</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="invisible text-xs leading-none shrink-0" aria-hidden>
              •
            </span>
            <span>Location</span>
          </div>
          <div className="text-center">{editMode ? "Edit" : "Alert"}</div>
        </div>

        <div ref={listRef} className="relative" style={{ height: totalHeight }}>
          {arrowTop !== null && !editMode && (!currentItem || currentAppt) && (
            // For the blank-gap / outside-hours case, and whenever an
            // appointment overlay currently covers "now" — when "now" falls
            // inside a plain activity with no appointment on top of it, the
            // line renders as that row's own child instead (see the
            // isCurrent block below). An appointment paints above (z-20)
            // whatever regular item is underneath it, so that in-row
            // treatment would just get hidden below it — this list-level
            // line stays instead, at z-25, so "now" still visibly crosses
            // the appointment bubble itself. Legibility over any text
            // underneath (the appointment's own type/provider, if this is
            // the appointment case) comes from that text's own halo (see
            // textHalo), not from fading this line — it always renders at
            // full opacity. Above the item rows (z-10) and the appointment
            // overlays (z-20) — including a flashing row's own temporary
            // z-20 bump (see that row's className below), which used to
            // permanently out-rank this line the instant "Now" was pressed
            // once, since that bump never resets back down. Staying under
            // the chevron marker (z-30) only.
            <NowLine
              top={arrowTop}
              color={arrowGray ? "var(--color-now-chevron-muted)" : "var(--color-now-chevron)"}
              zClassName="z-[25]"
            />
          )}
          {arrowTop !== null && !editMode && (
            <div
              key={`arrow-${nowAnim}`}
              className={cn(
                "absolute z-30 pointer-events-none flex items-center -translate-y-1/2",
                nowAnim > 0 && "animate-bounce-x",
              )}
              style={{ top: arrowTop, left: -6 }}
              aria-hidden
            >
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
              >
                <path
                  d="M3 2 Q1 2 1 4 V16 Q1 18 3 18 L13 11.5 Q15 10 13 8.5 Z"
                  fill={arrowGray ? "var(--color-now-chevron-muted)" : "var(--color-now-chevron)"}
                />
              </svg>
              {showOutsideOfHoursLabel && (
                <span className="ml-1 text-[10px] uppercase tracking-wide text-stone-400 whitespace-nowrap">
                  Outside of hours
                </span>
              )}
            </div>
          )}

          {rowLayout.map(({ row, top, height }) => {
            if (row.kind === "gap") {
              const { gap } = row;
              if (!editMode) {
                // Reachable only in proportional mode (collapsed hides all
                // gaps outside edit mode, see `rows`) and only for a gap
                // between two items (edge gaps are trimmed away entirely
                // when not editing) — genuinely blank, unlike an activity's
                // own box, so it's left without a border/background of its
                // own; only the divider lines (same ones an activity would
                // show) mark off the time increments within it. stone-200
                // (not the item boxes' stone-100) because a gap has no
                // white box behind it — against the schedule pane's own
                // cream background, stone-100 is nearly invisible.
                const gapGridLines = Math.max(0, Math.floor((height / PX_PER_MIN - 1) / 5));
                return (
                  <div
                    key={`gap-${gap.startMin}`}
                    className="absolute left-0 right-0 z-10"
                    style={{ top, height }}
                  >
                    {Array.from({ length: gapGridLines }, (_, i) => (
                      <div
                        key={`gg-${i}`}
                        className="absolute left-1 right-1 border-t border-border"
                        style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                      />
                    ))}
                  </div>
                );
              }
              // Same 5-minute divider lines a real activity's box would
              // show, so a gap's own duration still reads at a glance in
              // edit mode — light blue rather than the non-edit view's gray
              // to match the "Add Activity" affordance's own color. Derived
              // from the rendered `height`, not the gap's raw duration: edge
              // gaps (before the first item / after the last) are capped to
              // EDGE_ADD_ACTIVITY_PX regardless of how much dead time they
              // actually span, so lines must match the capped box, not spill
              // past it.
              const gapGridLines =
                layoutMode === "proportional"
                  ? Math.max(0, Math.floor((height / PX_PER_MIN - 1) / 5))
                  : 0;
              return (
                <button
                  key={`gap-${gap.startMin}`}
                  type="button"
                  onClick={() => openAddActivity(gap)}
                  className={cn(
                    "absolute left-1 right-1 z-10 rounded-md border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors",
                    layoutMode === "collapsed"
                      ? "grid grid-cols-[40px_1fr_84px_34px] gap-1 items-center px-2"
                      : "flex items-center justify-center gap-1.5 text-xs font-medium",
                  )}
                  style={{ top, height }}
                >
                  {Array.from({ length: gapGridLines }, (_, i) => (
                    <div
                      key={`gg-${i}`}
                      className="absolute left-1 right-1 border-t border-blue-100"
                      style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                    />
                  ))}
                  {layoutMode === "collapsed" ? (
                    <>
                      {/* Positioned (relative z-10) so it paints above the
                          divider lines above — those are `absolute`, and an
                          absolutely-positioned sibling paints after in-flow
                          content by default regardless of DOM order, so
                          without this the lines would draw over the label. */}
                      <span className="relative z-10 text-[11px] tabular-nums leading-tight text-right pr-1.5">
                        {fmt12(fromMin(gap.startMin), use24HourTime)}
                      </span>
                      <span className="relative z-10 flex items-center gap-1.5 text-xs font-medium">
                        <Plus className="size-3.5" /> Add Activity
                      </span>
                    </>
                  ) : (
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Plus className="size-3.5" /> Add Activity
                    </span>
                  )}
                </button>
              );
            }
            const it = row.item;
            const isCurrent = !editMode && currentItem?.id === it.id;
            // Matches this row's own background (see the box div below) —
            // the color the "now" line's halo needs to match to hide it
            // locally behind this row's own text (see textHalo).
            const rowHaloColor = isCurrent ? "#eff6ff" : "#fff";
            const displayName =
              it.activity === "Custom" ? (it.customName ?? "Custom") : it.activity;
            const displayIcon =
              it.activity === "Custom"
                ? (it.customIcon ?? "✨")
                : (ACTIVITY_ICONS[it.activity] ?? "•");
            const alertMode = it.alert;
            const actualDurMin = toMin(it.end) - toMin(it.start);
            const gridLines =
              layoutMode === "proportional" ? Math.max(0, Math.floor((actualDurMin - 1) / 5)) : 0;
            return (
              <div
                key={it.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(it.id, el);
                  else rowRefs.current.delete(it.id);
                }}
                className={cn(
                  "absolute left-0 right-0 z-10",
                  // Elevated once flashed — the pulse's thicker border needs
                  // to paint over neighboring rows (which share z-10 and
                  // would otherwise occlude it, since later siblings in the
                  // same stacking context paint on top). This bump doesn't
                  // reset back down once the pulse animation finishes (it's
                  // keyed on flashRowId/flashGen alone), which is fine now
                  // that it stays below both the "now" line (z-25) and the
                  // chevron marker (z-30) either way.
                  flashRowId === it.id && flashGen > 0 && "z-20",
                )}
                style={{ top, height }}
              >
                <div
                  className={cn(
                    "absolute inset-0 rounded-md border border-border bg-white transition-colors",
                    isCurrent && "!border-2 !border-blue-400 !bg-blue-50",
                  )}
                />
                {Array.from({ length: gridLines }, (_, i) => (
                  <div
                    key={`g-${i}`}
                    // Black at low opacity rather than a tinted gray/blue —
                    // darkens whatever's underneath by the same relative
                    // amount whether the row is plain white or highlighted
                    // !bg-blue-50, so one definition works over any of this
                    // row's background states instead of needing a second
                    // shade picked to stay visible against each one.
                    className="absolute left-1 right-1 border-t border-black/5"
                    style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                  />
                ))}
                {flashRowId === it.id && flashGen > 0 && (
                  // A separate, pointer-events-none overlay rather than
                  // animating the box above directly — that box's selected
                  // state sets border-width via an !important utility (to
                  // reliably beat its own base border class), and CSS
                  // animations can never win against an !important
                  // declaration. Pulsing only border-width (not background
                  // or scale) keeps the row's own position/size untouched;
                  // it just visually overlaps whatever's beneath it. Rendered
                  // after the gridlines (not before) so the pulse paints on
                  // top of them instead of the lines cutting across it.
                  <div
                    key={`pulse-${flashGen}`}
                    className="absolute inset-0 rounded-md pointer-events-none border-blue-500 animate-now-pulse"
                    aria-hidden
                  />
                )}
                {isCurrent && arrowTop !== null && !currentAppt && (
                  // "Now" cutting across THIS row specifically, rendered as
                  // its own child (not the shared list-level line above)
                  // purely so plain DOM order does the layering: it paints
                  // after the box/gridlines/pulse above (so it still shows
                  // crossing the white box) but before the icon/text content
                  // below, so an emoji — opaque — fully covers its own
                  // stretch of the line, while text stays legible via its
                  // own halo (see textHalo) rather than this line fading.
                  // Skipped when an appointment is also covering "now" —
                  // that appointment paints above (z-20) this row entirely,
                  // so this in-row line would just render invisibly
                  // underneath it; the shared list-level line (see above)
                  // handles that case instead, at a z that clears the
                  // appointment.
                  <NowLine
                    top={arrowTop - top}
                    color={
                      arrowGray ? "var(--color-now-chevron-muted)" : "var(--color-now-chevron)"
                    }
                  />
                )}
                <div className="relative h-full grid grid-cols-[40px_1fr_84px_34px] gap-1 items-start pt-1.5 pb-1 px-2">
                  <div
                    className="text-[11px] tabular-nums leading-tight text-right pr-1.5 pt-0.5"
                    style={textHalo(rowHaloColor)}
                  >
                    {fmt12(it.start, use24HourTime)}
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    {showIcons && (
                      <span className="text-sm leading-none shrink-0">{displayIcon}</span>
                    )}
                    <ScrubText
                      text={displayName}
                      className="text-xs font-medium flex-1 leading-tight"
                      style={textHalo(rowHaloColor)}
                    />
                  </div>
                  <div className="flex items-start gap-1 min-w-0">
                    {showIcons && (
                      <span className="text-xs leading-none shrink-0">
                        {LOCATION_ICONS[it.location] ?? "📍"}
                      </span>
                    )}
                    {/* Every location links out now, not just the assigned
                    room — Kitchen/Big Gym/etc. are self-explanatory, but a
                    tap here still opens the same building directory a
                    therapist unfamiliar with this clinic would want for any
                    of them, not only the numbered rooms. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoomInfoRoom(resolveLocation(it.location, assignedRoom));
                        setRoomInfoDialogOpen(true);
                      }}
                      className="text-xs flex-1 min-w-0 text-left leading-tight underline decoration-dotted underline-offset-2 text-blue-700"
                      style={textHalo(rowHaloColor)}
                    >
                      <ScrubText
                        text={resolveLocation(it.location, assignedRoom)}
                        className="text-xs leading-tight"
                      />
                    </button>
                  </div>
                  <div className="flex items-start justify-center gap-0.5 -mt-1">
                    {editMode ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-blue-600 hover:bg-blue-50 [&_svg]:size-3"
                          onClick={() => setEditing(it)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-blue-600 hover:bg-blue-50 [&_svg]:size-3"
                          onClick={() => setConfirmItemDelete(it)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    ) : (
                      <AlertCycle mode={alertMode} onChange={(m) => setAlertFor(it, m)} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Appointment overlays — top layer, on top of activity rows. A
              single element rolls its height between the collapsed bar and
              the full card (rather than swapping two unrelated elements),
              with the inner content cross-fading over the same duration so
              it reads as one continuous roll rather than a hard cut. */}
          {visibleAppts.map(({ appt: a, top, height }) => {
            const collapsed = allApptsCollapsed || collapsedAppts[a.id];
            const collapsedPx = 6; // matches the prior h-1.5 collapsed bar height
            const collapse = () => setCollapsedAppts((p) => ({ ...p, [a.id]: true }));
            const expand = () => {
              setCollapsedAppts((p) => ({ ...p, [a.id]: false }));
              setAllApptsCollapsed(false);
            };
            // Same 5-minute divider lines an activity row shows, so an
            // appointment's own duration reads at a glance too — only
            // meaningful in proportional mode, where height actually tracks
            // real duration (collapsed mode's uniform rows don't).
            const apptGridLines =
              layoutMode === "proportional"
                ? Math.max(0, Math.floor((toMin(a.end) - toMin(a.start) - 1) / 5))
                : 0;
            return (
              <motion.div
                // Remounting on a layoutMode switch (rather than reusing the
                // same instance) lets that transition read as a distinct
                // "slide in from the right" moment, separate from the
                // vertical roll used for an individual collapse/expand.
                key={`${a.id}::${layoutMode}`}
                className={cn(
                  "absolute left-[4px] right-[4px] z-20 rounded-md shadow-[0_3px_8px_-2px_rgba(0,0,0,0.25)]",
                  !showAppts && "hidden",
                )}
                style={{ top }}
                initial={{ opacity: 0, x: 16 }}
                animate={{ height: collapsed ? collapsedPx : height, opacity: 1, x: 0 }}
                transition={{
                  height: {
                    type: "spring",
                    stiffness: APPT_COLLAPSE_STIFFNESS,
                    damping: APPT_COLLAPSE_DAMPING,
                  },
                  opacity: { duration: MODE_TRANSITION_DURATION_MS / 1000 },
                  x: { duration: MODE_TRANSITION_DURATION_MS / 1000, ease: "easeOut" },
                }}
              >
                {/* Clipping lives on this inner layer (not the shadow-bearing
                    outer one) so the box-shadow above isn't clipped along
                    with the content. Each inner layer also needs its OWN
                    rounded-md — a square-cornered border clipped by an
                    ancestor's rounded overflow still looks notched at the
                    corner, since the border itself isn't drawn as a curve. */}
                <div className="relative h-full w-full rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={expand}
                    className={cn(
                      "absolute inset-0 rounded-md bg-green-500 hover:bg-green-600 transition-opacity",
                      collapsed ? "opacity-100" : "opacity-0 pointer-events-none",
                    )}
                    style={{ transitionDuration: `${APPT_COLLAPSE_DURATION_MS}ms` }}
                    aria-label={`Expand ${a.type}`}
                    title={`${a.type} · ${a.provider}`}
                  />

                  <div
                    className={cn(
                      "absolute inset-0 rounded-md bg-green-50 border-2 border-green-300 transition-opacity",
                      collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
                    )}
                    style={{ transitionDuration: `${APPT_COLLAPSE_DURATION_MS}ms` }}
                  >
                    <button
                      type="button"
                      onClick={collapse}
                      aria-label="Collapse appointment (drag handle)"
                      className="absolute top-0 left-0 right-0 z-10 h-2 cursor-pointer"
                    />
                    {/* Same 5-minute divider lines an activity row shows —
                        see apptGridLines above. Black/opacity here too,
                        rather than a green shade picked to match this box's
                        own tint — appointments aren't all rendered on the
                        same bg-green-50 forever, and a fixed color would
                        need re-picking for any other panel color. */}
                    {Array.from({ length: apptGridLines }, (_, i) => (
                      <div
                        key={`ag-${i}`}
                        className="absolute left-1 right-1 border-t border-black/5"
                        style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                      />
                    ))}
                    {/* Top-right corner, aligned with the title text's own
                        row — not centered on the box, which reads as
                        disconnected from the title it belongs to. */}
                    <button
                      type="button"
                      onClick={collapse}
                      className="absolute top-1 right-1 z-10 size-6 grid place-items-center rounded-full text-green-700 hover:bg-green-100"
                      aria-label="Collapse appointment"
                    >
                      <CollapseIcon className="size-3.5" />
                    </button>
                    <div className="relative h-full grid grid-cols-[40px_1fr] gap-1 pl-1.5 pr-8 pt-0.5 items-start">
                      <div
                        className="text-[11px] tabular-nums leading-tight text-green-700 pl-0.5 pt-0.5"
                        style={textHalo(APPT_HALO_COLOR)}
                      >
                        {fmt12(a.start, use24HourTime)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ScrubText
                            text={a.type}
                            className="text-xs font-semibold text-green-700 leading-tight truncate"
                            style={textHalo(APPT_HALO_COLOR)}
                          />
                          {a.tag && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-green-600 text-white text-[9px] uppercase tracking-wide px-1.5 py-px font-semibold">
                              {a.tag}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[10px] italic text-green-700/90 leading-tight truncate"
                          style={textHalo(APPT_HALO_COLOR)}
                        >
                          {a.provider}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <ItemDialog
        open={!!editing || !!creatingNew}
        item={editing}
        defaultStart={creatingNew?.start}
        defaultEnd={creatingNew?.end}
        dayStartTime={dayStartTime}
        dayEndTime={dayEndTime}
        existing={active.items}
        onClose={() => {
          setEditing(null);
          setCreatingNew(null);
        }}
        onSave={(item) => {
          if (editing) {
            updateActive((items) => items.map((x) => (x.id === editing.id ? item : x)));
          } else {
            updateActive((items) =>
              [...items, item].sort((a, b) => toMin(a.start) - toMin(b.start)),
            );
          }
          setEditing(null);
          setCreatingNew(null);
        }}
      />

      <RoomInfoDialog
        open={roomInfoDialogOpen}
        room={roomInfoRoom}
        onClose={() => setRoomInfoDialogOpen(false)}
        onBack={() => setRoomInfoRoom(null)}
        onSelectRoom={setRoomInfoRoom}
        use24HourTime={use24HourTime}
      />

      <AppointmentDialog
        open={!!editingAppt || creatingAppt}
        appt={editingAppt}
        existing={active.appointments}
        onClose={() => {
          setEditingAppt(null);
          setCreatingAppt(false);
        }}
        onSave={(a) => {
          if (editingAppt) {
            updateActiveAppts((list) => list.map((x) => (x.id === editingAppt.id ? a : x)));
          } else {
            updateActiveAppts((list) =>
              [...list, a].sort((x, y) => toMin(x.start) - toMin(y.start)),
            );
          }
          setEditingAppt(null);
          setCreatingAppt(false);
        }}
      />

      <NewScheduleDialog
        open={newSchedOpen}
        onCancel={() => setNewSchedOpen(false)}
        onCreate={(name) => {
          createNewSchedule(name);
          setNewSchedOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Schedule?"
        body={`“${active.name}” will be removed.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteActive();
          setDeleteOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!confirmItemDelete}
        title="Delete Activity?"
        body={
          confirmItemDelete
            ? `“${confirmItemDelete.activity}” at ${fmt12(confirmItemDelete.start, use24HourTime)} will be removed.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmItemDelete(null)}
        onConfirm={() => {
          if (confirmItemDelete)
            updateActive((items) => items.filter((x) => x.id !== confirmItemDelete.id));
          setConfirmItemDelete(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmApptDelete}
        title="Delete Appointment?"
        body={confirmApptDelete ? `${confirmApptDelete.type} · ${confirmApptDelete.provider}` : ""}
        confirmLabel="Delete"
        onCancel={() => setConfirmApptDelete(null)}
        onConfirm={() => {
          if (confirmApptDelete)
            updateActiveAppts((list) => list.filter((x) => x.id !== confirmApptDelete.id));
          setConfirmApptDelete(null);
        }}
      />
    </div>
  );
}

// The "now" line as three segments rather than one: full opacity from the
// left edge to `textZone.left`, dimmed from there to `textZone.right`
// (measured from the RIGHT edge — CSS `right` positioning, not a computed
// total width, so this doesn't care how wide the row actually renders),
// full opacity again from there to the right edge. Only the middle segment
// ever crosses real text, so only it needs to give the text room to read.
function NowLine({ top, color, zClassName }: { top: number; color: string; zClassName?: string }) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 pointer-events-none border-t-2 border-dashed",
        zClassName,
      )}
      style={{ top, borderColor: color }}
      aria-hidden
    />
  );
}

// A halo the same color as whatever's behind a piece of text — repeated a
// few times to fully opaque-out (not just soften) anything passing behind
// the glyphs themselves, e.g. the "now" line above. Only needs to reach as
// far as that text's own natural footprint, so unlike fading the line
// itself, this never affects blank space the text doesn't occupy.
function textHalo(color: string): React.CSSProperties {
  const shadow = `0 0 2px ${color}`;
  return { textShadow: [shadow, shadow, shadow, shadow].join(", ") };
}

function AlertCycle({ mode, onChange }: { mode: AlertMode; onChange: (m: AlertMode) => void }) {
  const next: Record<AlertMode, AlertMode> = { off: "visual", visual: "audio", audio: "off" };
  const Icon = mode === "off" ? BellOff : mode === "visual" ? Bell : BellRing;
  return (
    <button
      type="button"
      onClick={() => onChange(next[mode])}
      data-tour="schedule-alert-cycle"
      className={cn(
        "size-7 grid place-content-center rounded-full transition-colors",
        mode === "off" ? "text-stone-300" : "text-blue-600",
      )}
      aria-label={`Alert: ${mode}`}
      title={`Alert: ${mode}`}
    >
      <Icon className="size-4" />
    </button>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm rounded-2xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        <DialogFooter>
          <Button
            variant="outline"
            className={cn(
              "rounded-full text-blue-700 hover:bg-blue-50 gap-1.5",
              "border-2 border-blue-300",
            )}
            onClick={onCancel}
          >
            Cancel <X className="size-4" />
          </Button>
          <Button
            className="rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A hand-computed vector floor plan (not an actual architectural layout —
// this app has no real per-room position data), laid out once as plain
// rects/labels rather than hand-placed per room: a 5x2 grid of numbered
// treatment rooms on the left, the four named common areas as a 2x2 block
// on the right, and the three bathrooms as a slim strip underneath those.
// Reads as a genuine "vector schematic" floor plan while staying entirely
// formula-driven, so adding/removing a room never means re-plotting
// coordinates by hand.
const MAP_VB_W = 320;
const MAP_VB_H = 200;
const MAP_PAD = 6;
const MAP_GAP = 2.5;

interface MapRoomRect {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeBuildingMapRects(): MapRoomRect[] {
  const rects: MapRoomRect[] = [];

  // Treatment wing: 5 columns x 2 rows, occupying the left ~60% of the
  // building.
  const twX = MAP_PAD;
  const twY = MAP_PAD;
  const twW = 190;
  const twH = MAP_VB_H - MAP_PAD * 2;
  const tCols = 5;
  const tRows = 2;
  const tCellW = (twW - MAP_GAP * (tCols - 1)) / tCols;
  const tCellH = (twH - MAP_GAP * (tRows - 1)) / tRows;
  TREATMENT_ROOMS.forEach((name, i) => {
    const col = i % tCols;
    const row = Math.floor(i / tCols);
    rects.push({
      name,
      x: twX + col * (tCellW + MAP_GAP),
      y: twY + row * (tCellH + MAP_GAP),
      w: tCellW,
      h: tCellH,
    });
  });

  // Common-area wing: the right side. Kitchen/Classroom/Big Gym/Small Gym
  // as a 2x2 block on top; the three bathrooms as a shorter strip below
  // that, sized to fit whatever room the 2x2 block leaves.
  const cwX = twX + twW + 8;
  const cwW = MAP_VB_W - MAP_PAD - cwX;
  const mainNames = COMMON_AREAS.slice(0, 4);
  const bathNames = COMMON_AREAS.slice(4);
  const mainH = twH * 0.6;
  const mCols = 2;
  const mRows = 2;
  const mCellW = (cwW - MAP_GAP * (mCols - 1)) / mCols;
  const mCellH = (mainH - MAP_GAP * (mRows - 1)) / mRows;
  mainNames.forEach((name, i) => {
    const col = i % mCols;
    const row = Math.floor(i / mCols);
    rects.push({
      name,
      x: cwX + col * (mCellW + MAP_GAP),
      y: twY + row * (mCellH + MAP_GAP),
      w: mCellW,
      h: mCellH,
    });
  });
  const bathY = twY + mainH + 8;
  const bathH = twH - mainH - 8;
  const bCellW = (cwW - MAP_GAP * (bathNames.length - 1)) / bathNames.length;
  bathNames.forEach((name, i) => {
    rects.push({ name, x: cwX + i * (bCellW + MAP_GAP), y: bathY, w: bCellW, h: bathH });
  });

  return rects;
}

// Full names don't fit a cell this small — treatment rooms show just their
// number (the icon+title above already spells the room out in full once
// selected), and the bathrooms get a short "X. Bath" form distinct enough
// from each other and from the plain "Kitchen"/"Classroom" labels beside
// them.
function mapCellLabel(name: string): string {
  if (TREATMENT_ROOMS.includes(name)) return name.replace("Room ", "");
  if (name === "Classroom Bathroom") return "Cls. Bath";
  if (name === "Learner Bathroom") return "Lrn. Bath";
  if (name === "Solo Bathroom") return "Solo Bath";
  return name;
}

/** `highlight` is a resolved room/area name (never ASSIGNED_ROOM_TOKEN
 *  itself) — whichever rect matches it renders as the current room; `null`
 *  (the dialog's own base view) highlights nothing, just a plain directory.
 *  Every rect is clickable either way, via `onSelect` — the map itself is
 *  how you navigate to a room, not just a static illustration of the one
 *  you already picked. */
function BuildingMapSVG({
  highlight,
  onSelect,
}: {
  highlight: string | null;
  onSelect: (room: string) => void;
}) {
  const rects = useMemo(computeBuildingMapRects, []);
  return (
    <svg
      viewBox={`0 0 ${MAP_VB_W} ${MAP_VB_H}`}
      role="img"
      aria-label="Building floor plan"
      className="w-full h-auto rounded-lg border border-stone-200 bg-stone-50"
    >
      <rect
        x={1}
        y={1}
        width={MAP_VB_W - 2}
        height={MAP_VB_H - 2}
        rx={4}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-stone-300"
      />
      {rects.map((r) => {
        const isHi = r.name === highlight;
        return (
          <g
            key={r.name}
            role="button"
            aria-label={r.name}
            onClick={() => onSelect(r.name)}
            className="cursor-pointer"
          >
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={2}
              strokeWidth={isHi ? 2 : 1}
              className={cn(
                "transition-colors",
                isHi
                  ? "fill-blue-100 stroke-blue-400"
                  : "fill-white stroke-stone-300 hover:fill-stone-100",
              )}
            />
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: r.w < 40 ? 6.5 : 8 }}
              className={cn("select-none font-medium", isHi ? "fill-blue-700" : "fill-stone-500")}
            >
              {mapCellLabel(r.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// One placeholder photo per ROOM TYPE, not per specific room — this app has
// no real per-room photography. The four numbered-treatment-room variants
// below just cycle in order (Room 1/5/9 share one, Room 2/6/10 the next,
// and so on) purely so ten rooms in a row don't all show the identical
// photo — they're not meant to mean anything about a particular room.
// Kitchen/bathrooms/gyms+classroom each still get their own single stand-in
// since no variety shots exist for those yet. Swap any of these for real
// photos once the clinic has them; the rest of the dialog doesn't care
// where the image comes from.
const TREATMENT_ROOM_PHOTOS = [
  roomTherapyPhoto,
  roomTherapyPhoto2,
  roomTherapyPhoto3,
  roomTherapyPhoto4,
];
function roomPhotoFor(room: string): string {
  if (room.endsWith("Bathroom")) return roomBathroomPhoto;
  if (room === "Kitchen") return roomKitchenPhoto;
  const treatmentIndex = TREATMENT_ROOMS.indexOf(room);
  if (treatmentIndex !== -1) {
    return TREATMENT_ROOM_PHOTOS[treatmentIndex % TREATMENT_ROOM_PHOTOS.length];
  }
  return roomPlayPhoto; // Classroom, Big Gym, Small Gym
}

// A plain Google Maps search link and Apple's own equivalent, computed
// fresh per address (now that there's more than one — see CLINIC_LOCATIONS)
// rather than baked into a single module-level constant.
function mapsUrls(address: string) {
  return {
    apple: `https://maps.apple.com/?address=${encodeURIComponent(address)}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
  };
}

/** The address as a small anchored popover — not a full dialog of its own —
 *  offering an explicit Apple Maps / Google Maps choice rather than picking
 *  one automatically (there's no reliable way to detect which app the user
 *  actually wants from inside a web view). Same self-contained
 *  trigger+Popover shape TrialCard's own PromptLevelButton uses: this owns
 *  its open state and renders both the address link and the popup it
 *  opens, rather than the parent managing a separate boolean for it. */
function AddressMapsPopover({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // margin=34, not the default 16: same rounded-2xl box + rotated h-3 w-3
  // arrow square as SaveIndicator/PresenceIndicator's own popovers (see
  // SaveIndicator's identical comment) — 16 isn't enough clearance for the
  // corner's own radius plus the arrow's ~8.5px half-width, so the corner's
  // curve shows through the arrow's fill whenever this narrow box's slider
  // gets clamped near an edge. Same fix, same margin.
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef, 34);
  const urls = mapsUrls(address);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-800 max-w-full"
        >
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{address}</span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="bottom"
        align="start"
        collisionPadding={8}
        // z-[110]: this popover portals to document.body, same as the
        // RoomInfoDialog it opens from (Dialog's own z-[100] — see
        // DialogOverlay's comment) — has to outrank that raw z-index or it
        // renders invisibly behind the dialog's opaque content.
        className="group z-[110] w-auto min-w-[9rem] rounded-2xl border-2 border-blue-400 bg-card p-1.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col gap-0.5">
          <a
            href={urls.apple}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
          >
            Apple Maps
          </a>
          <a
            href={urls.google}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
          >
            Google Maps
          </a>
        </div>
        {/* Arrow — points back at the address it opened from, same idiom as
            PromptLevelButton's own popover arrow (see its comment), just
            mirrored for this popover's own preferred side="bottom" (content
            below the trigger, arrow at the content's top edge pointing up)
            instead of PromptLevelButton's side="top" default — the
            group-data override below only ever applies if Radix's own
            collision detection flips this one to sit above its trigger
            instead. */}
        <div
          className={cn(
            "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-400 bg-card",
            "-top-[6px] border-l-2 border-t-2",
            "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[6px]",
            "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
            "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
          )}
          style={{ left: arrowLeft ?? "1.25rem" }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Placeholder daily lineup for every room in the building — not this
// client's own schedule (see resolveLocation's callers for that), a
// separate, fake multi-client roster standing in for real front-desk
// booking data this app doesn't have yet. Treatment rooms list whoever's
// individual session is booked there (first name + last initial, the same
// privacy-conscious convention StaffDirectory's own caseload list uses —
// see its comment); common areas list the group activity happening instead.
// The three bathrooms are used ad hoc, never booked, so they intentionally
// have no entries — RoomInfoDialog's own empty state covers that.
const ROOM_DAILY_SCHEDULE: Record<string, { label: string; start: string; end: string }[]> = {
  "Room 1": [
    { label: "Ava M.", start: "09:00", end: "10:00" },
    { label: "Noah P.", start: "13:00", end: "14:00" },
  ],
  "Room 2": [
    { label: "Liam K.", start: "09:00", end: "09:45" },
    { label: "Mia S.", start: "11:00", end: "12:00" },
  ],
  "Room 3": [{ label: "Ethan R.", start: "10:00", end: "11:00" }],
  "Room 4": [
    { label: "Sophia T.", start: "08:30", end: "09:30" },
    { label: "Lucas W.", start: "14:00", end: "15:00" },
  ],
  "Room 5": [{ label: "Isabella G.", start: "12:00", end: "13:00" }],
  "Room 6": [
    { label: "Mason D.", start: "09:30", end: "10:30" },
    { label: "Zoe H.", start: "15:00", end: "16:00" },
  ],
  "Room 7": [{ label: "Aiden C.", start: "10:30", end: "11:30" }],
  "Room 8": [
    { label: "Chloe B.", start: "08:00", end: "09:00" },
    { label: "Ryan F.", start: "13:30", end: "14:30" },
  ],
  "Room 9": [{ label: "Emma L.", start: "11:30", end: "12:30" }],
  "Room 10": [{ label: "Owen V.", start: "14:30", end: "15:30" }],
  Kitchen: [
    { label: "Lunch", start: "12:00", end: "12:30" },
    { label: "Snack", start: "15:00", end: "15:15" },
  ],
  Classroom: [
    { label: "Social Skills Group", start: "10:00", end: "11:00" },
    { label: "Group Instruction", start: "13:00", end: "14:00" },
  ],
  "Big Gym": [
    { label: "Gross Motor Play", start: "09:30", end: "10:15" },
    { label: "Social Group", start: "14:30", end: "15:15" },
  ],
  "Small Gym": [{ label: "Sensory Play", start: "11:00", end: "11:45" }],
  "Classroom Bathroom": [],
  "Learner Bathroom": [],
  "Solo Bathroom": [],
};

/** Styled like StatusBar's own person-presence popup (rounded-2xl, a blue
 *  border, a bordered title row rather than the plain Dialog default) and
 *  sized to its own content instead of stretching edge to edge — a Dialog
 *  underneath, not a true anchored Popover, since this needs to open from
 *  many different trigger sites (every schedule row's own location, plus
 *  every rect in its own floor plan) rather than one fixed spot. The sand
 *  background (`bg-background`, not a plain white override) matches
 *  StaffDirectory's own profile popup rather than standing out from it.
 *
 *  Three stacked views share this one dialog, navigated with the same
 *  back-arrow-in-the-header idiom at every level rather than three separate
 *  dialogs: a locations list (`pickingLocation`), a single location's own
 *  floor plan (`room === null`, this dialog's real base view — Main Branch
 *  by default, see the reset effect below), and a specific room within it
 *  (`room` set). `room === null` doesn't mean "nothing to show" here the
 *  way it used to before locations existed — it's "showing the location
 *  itself," now with its own photo alongside the floor plan, same shape as
 *  a room's own photo+plan pairing. */
function RoomInfoDialog({
  open,
  room,
  onClose,
  onBack,
  onSelectRoom,
  use24HourTime,
}: {
  open: boolean;
  room: string | null;
  onClose: () => void;
  onBack: () => void;
  onSelectRoom: (room: string) => void;
  use24HourTime: boolean;
}) {
  const [locationIndex, setLocationIndex] = useState(0);
  const [pickingLocation, setPickingLocation] = useState(false);
  // Every fresh open starts back at Main Branch with the picker closed —
  // this client's own schedule only ever really lives there, so a room
  // opened directly from a schedule row (skipping the location view
  // entirely) should never land under whichever OTHER branch a previous
  // visit happened to leave selected.
  useEffect(() => {
    if (open) {
      setLocationIndex(0);
      setPickingLocation(false);
    }
  }, [open]);
  const location = CLINIC_LOCATIONS[locationIndex];
  const schedule = room ? ROOM_DAILY_SCHEDULE[room] : undefined;

  const handleBack = () => {
    if (room) {
      onBack();
    } else if (pickingLocation) {
      setPickingLocation(false);
    } else {
      setPickingLocation(true);
    }
  };
  // Every view has a back arrow now — even the location view itself, whose
  // target is "go pick a different location" rather than "go up a level"
  // like the other two. There's no true top of this stack to leave one off
  // of; "go back" just means something different depending on where it's
  // pressed.
  const backLabel = room ? "Back to floor plan" : pickingLocation ? "Back" : "Other locations";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[85vw] max-w-sm gap-0 rounded-2xl border-2 border-blue-400 bg-background p-0 text-stone-700 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-1.5 py-2 pl-2 pr-10 border-b border-border rounded-t-2xl">
          <button
            type="button"
            onClick={handleBack}
            aria-label={backLabel}
            title={backLabel}
            className="grid place-items-center size-7 shrink-0 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <DialogHeader className="min-w-0 flex-1 text-left space-y-0">
            {pickingLocation ? (
              <DialogTitle className="text-base">Choose a Location</DialogTitle>
            ) : (
              <>
                <DialogTitle
                  className={cn(
                    "flex items-center gap-1.5 truncate",
                    room ? "text-lg" : "text-base",
                  )}
                >
                  {room && <span aria-hidden>{locationIcon(room)}</span>}
                  {room ?? location.name}
                </DialogTitle>
                <DialogDescription className="text-xs truncate">
                  {room ? (
                    <>
                      {location.name} &middot; {location.branch}
                    </>
                  ) : (
                    location.branch
                  )}
                </DialogDescription>
                <AddressMapsPopover address={location.address} />
              </>
            )}
          </DialogHeader>
        </div>

        {pickingLocation ? (
          <div className="flex flex-col gap-1.5 p-3">
            {CLINIC_LOCATIONS.map((loc, i) => (
              <button
                key={loc.branch}
                type="button"
                onClick={() => {
                  setLocationIndex(i);
                  setPickingLocation(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                  i === locationIndex
                    ? "border-blue-400 bg-blue-50"
                    : "border-stone-200 bg-white hover:bg-stone-50",
                )}
              >
                <img
                  src={loc.photo}
                  alt=""
                  aria-hidden
                  className="size-12 rounded-md object-cover shrink-0 border border-stone-200"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{loc.branch}</p>
                  <p className="text-xs text-muted-foreground truncate">{loc.address}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <img
              src={room ? roomPhotoFor(room) : location.photo}
              alt={room ? `${room} photo` : `${location.branch} exterior`}
              className="w-full h-32 object-cover rounded-lg border border-stone-200"
            />
            <BuildingMapSVG highlight={room} onSelect={onSelectRoom} />
            {room && (
              <div>
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Today:</p>
                {schedule && schedule.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {schedule.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-xs tabular-nums text-stone-400 shrink-0 w-24">
                          {fmt12(s.start, use24HourTime)}&ndash;{fmt12(s.end, use24HourTime)}
                        </span>
                        <span className="truncate">{s.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground/70">Nothing scheduled here today.</p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  item,
  defaultStart,
  defaultEnd,
  dayStartTime,
  dayEndTime,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  item: ScheduleItem | null;
  /** Pre-filled start/end for a new item, seeded from whichever gap the
   *  "Add Activity" button was pressed from (see openAddActivity). */
  defaultStart?: string;
  defaultEnd?: string;
  /** Clinic hours (24h "HH:MM") — the fallback gap boundary when this item
   *  has no previous/next neighbor to bound against. */
  dayStartTime: string;
  dayEndTime: string;
  existing: ScheduleItem[];
  onClose: () => void;
  onSave: (i: ScheduleItem) => void;
}) {
  const { use24HourTime } = useSettings();
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("10:30");
  const [activity, setActivity] = useState<string>(ACTIVITIES[0]);
  const [customName, setCustomName] = useState("");
  const [customIcon, setCustomIcon] = useState("✨");
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [alertCfg, setAlertCfg] = useState<AlertSettings>(DEFAULT_ALERT);
  const [priming, setPriming] = useState<PrimingSettings>(DEFAULT_PRIMING);
  // error is the one-line conflict headline; conflictHint is the red second
  // line explaining the neighboring activity that caused it (unset for the
  // rare save-time-only fallback checks below, which have no single
  // neighbor to point at).
  const [error, setError] = useState<string | null>(null);
  const [conflictHint, setConflictHint] = useState<string | null>(null);
  // Which time field the user was last editing — sticks to whichever field
  // was most recently opened (not cleared when it closes) so the boundary
  // hint/conflict stays visible after a rejected entry auto-closes the
  // keypad, rather than vanishing the instant the popover does. These
  // callbacks must stay referentially stable: TimeOfDayKeypad's internal
  // effect re-fires whenever its onEditingChange prop identity changes, so
  // an inline arrow here would make the *other* field's open/close events
  // clobber whichever field the user actually just touched.
  const [editingField, setEditingField] = useState<"start" | "end" | null>(null);
  const handleStartEditingChange = useCallback((editing: boolean) => {
    if (editing) setEditingField("start");
  }, []);
  const handleEndEditingChange = useCallback((editing: boolean) => {
    if (editing) setEditingField("end");
  }, []);

  useEffect(() => {
    if (open) {
      setStart(item?.start ?? defaultStart ?? "10:00");
      setEnd(item?.end ?? defaultEnd ?? "10:30");
      setActivity(item?.activity ?? ACTIVITIES[0]);
      setCustomName(item?.customName ?? "");
      setCustomIcon(item?.customIcon ?? "✨");
      setLocation(item?.location ?? LOCATIONS[0]);
      setAlertCfg(item?.alertCfg ?? { ...DEFAULT_ALERT, mode: item?.alert ?? DEFAULT_ALERT.mode });
      setPriming(item?.priming ?? DEFAULT_PRIMING);
      setError(null);
      setConflictHint(null);
      setEditingField(null);
    }
  }, [open, item, defaultStart, defaultEnd]);

  // The activity immediately before/after this one in time (excluding
  // itself) — used both to keep a new start time from landing before the
  // previous activity ends, and to keep an auto-shifted end time from
  // overlapping whichever activity comes next.
  const findPrevious = (beforeMin: number) =>
    existing
      .filter((x) => x.id !== item?.id && toMin(x.end) <= beforeMin)
      .reduce<ScheduleItem | null>(
        (best, x) => (!best || toMin(x.end) > toMin(best.end) ? x : best),
        null,
      );
  const findNext = (afterMin: number) =>
    existing
      .filter((x) => x.id !== item?.id && toMin(x.start) >= afterMin)
      .reduce<ScheduleItem | null>(
        (best, x) => (!best || toMin(x.start) < toMin(best.start) ? x : best),
        null,
      );
  const nameOf = (x: ScheduleItem) =>
    x.activity === "Custom" ? (x.customName ?? "Custom") : x.activity;

  // The activities bordering this one's current position — the previous
  // one's end is the floor for a new start time, the next one's start is
  // the ceiling for a new end time. Computed off the item's own (committed)
  // start, so both boundaries stay stable while the user is mid-edit.
  const prevItem = findPrevious(toMin(start));
  const nextItem = findNext(toMin(start));

  // The full extent of the gap this item is sitting in — the previous
  // activity's end (or the day's start) through the next activity's start
  // (or the day's end). The reset buttons on each time field snap back out
  // to these edges; they're grayed out exactly when the field already sits
  // at its edge, since there's nowhere further to reset to.
  const gapLowerMin = prevItem ? toMin(prevItem.end) : toMin(dayStartTime);
  const gapUpperMin = nextItem ? toMin(nextItem.start) : toMin(dayEndTime);
  const startAtGapEdge = toMin(start) === gapLowerMin;
  const endAtGapEdge = toMin(end) === gapUpperMin;
  const resetStartToGap = () => {
    setStart(fromMin(gapLowerMin));
    setError(null);
    setConflictHint(null);
  };
  const resetEndToGap = () => {
    setEnd(fromMin(gapUpperMin));
    setError(null);
    setConflictHint(null);
  };

  // After entering a new start time: reject it outright if it lands before
  // the previous activity's end, otherwise shift the end time along with
  // it — by default keeping the same duration, but clamped to the next
  // activity's start so the shift itself can't create a new overlap.
  const handleStartChange = (newStart: string) => {
    if (prevItem && toMin(newStart) < toMin(prevItem.end)) {
      setError(`Cannot start before ${fmt12(prevItem.end, use24HourTime)}.`);
      setConflictHint(`${nameOf(prevItem)} ends ${fmt12(prevItem.end, use24HourTime)}.`);
      return;
    }
    setError(null);
    setConflictHint(null);
    const duration = Math.max(toMin(end) - toMin(start), MIN_ROW_MIN);
    const next = findNext(toMin(newStart));
    let newEndMin = toMin(newStart) + duration;
    if (next) newEndMin = Math.min(newEndMin, toMin(next.start));
    newEndMin = Math.min(newEndMin, toMin(dayEndTime));
    setStart(newStart);
    setEnd(fromMin(Math.max(newEndMin, toMin(newStart))));
  };

  // After entering a new end time: reject it outright if it would land at
  // or before the (possibly just-changed) start time, or after the next
  // activity's start — mirrors handleStartChange's rejection so a
  // conflicting value never actually gets committed.
  const handleEndChange = (newEnd: string) => {
    if (toMin(newEnd) <= toMin(start)) {
      setError("Cannot end at or before the start time.");
      setConflictHint(null);
      return;
    }
    if (nextItem && toMin(newEnd) > toMin(nextItem.start)) {
      setError(`Cannot end after ${fmt12(nextItem.start, use24HourTime)}.`);
      setConflictHint(`${nameOf(nextItem)} starts ${fmt12(nextItem.start, use24HourTime)}.`);
      return;
    }
    setError(null);
    setConflictHint(null);
    setEnd(newEnd);
  };

  // Contextual hint below the Time row — shown only for whichever field was
  // last touched, and only when there's no active conflict (the conflict
  // headline + its own second line take over that space instead).
  const hint = error
    ? null
    : editingField === "start" && prevItem
      ? `${nameOf(prevItem)} ends ${fmt12(prevItem.end, use24HourTime)}.`
      : editingField === "end" && nextItem
        ? `${nameOf(nextItem)} starts ${fmt12(nextItem.start, use24HourTime)}.`
        : null;

  const handleSave = () => {
    if (error) return;
    if (toMin(end) <= toMin(start)) {
      setError("End time must be after start time.");
      setConflictHint(null);
      return;
    }
    const conflict = existing.some(
      (x) => x.id !== item?.id && overlaps(start, end, x.start, x.end),
    );
    if (conflict) {
      setError("Activities cannot overlap. Adjust the time.");
      setConflictHint(null);
      return;
    }
    onSave({
      id: item?.id ?? `c${Date.now()}`,
      start,
      end,
      activity,
      customName: activity === "Custom" ? customName.trim() || "Custom" : undefined,
      customIcon: activity === "Custom" ? customIcon || "✨" : undefined,
      location,
      alert: alertCfg.mode,
      alertCfg,
      priming,
    });
  };

  // Shifts the modal up clear of the OS keyboard — this dialog has two text
  // fields (Icon/Name) when Activity is "Custom".
  const keyboardInset = useKeyboardInset(open);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[calc(100vw-3rem)] max-w-sm rounded-2xl border-2 border-blue-400 shadow-xl transition-[translate] duration-150"
        style={keyboardInsetStyle(keyboardInset)}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="capitalize">
            {item ? "Edit Activity" : "Add Activity"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            <div className="mt-1 flex items-start gap-3">
              <div className="flex shrink-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Start</span>
                <TimeField
                  value={start}
                  onChange={handleStartChange}
                  onEditingChange={handleStartEditingChange}
                  resetSide="left"
                  resetActive={!startAtGapEdge}
                  onReset={resetStartToGap}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">End</span>
                <TimeField
                  value={end}
                  onChange={handleEndChange}
                  onEditingChange={handleEndEditingChange}
                  resetSide="right"
                  resetActive={!endAtGapEdge}
                  onReset={resetEndToGap}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Duration</span>
                <span className="flex h-9 items-center whitespace-nowrap text-sm text-blue-700">
                  {formatDuration(toMin(end) - toMin(start))}
                </span>
              </div>
            </div>
            {error ? (
              <div className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="size-3.5 shrink-0" />
                <div>
                  <p>{error}</p>
                  {conflictHint && <p>{conflictHint}</p>}
                </div>
              </div>
            ) : hint ? (
              <p className="mt-1.5 text-xs italic text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          <div>
            <Label className="text-xs">Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {(ACTIVITY_ICONS[a] ?? "•") + " " + a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activity === "Custom" && (
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <div>
                <Label className="text-xs">Icon</Label>
                <Input
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  maxLength={3}
                  className={cn("text-center text-lg", INPUT_BLUE_CLS)}
                />
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Activity name"
                  className={INPUT_BLUE_CLS}
                />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {(LOCATION_ICONS[l] ?? "📍") + " " + l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertsBlock
            alert={alertCfg}
            setAlert={setAlertCfg}
            priming={priming}
            setPriming={setPriming}
          />
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
            onClick={onClose}
          >
            Cancel <X className="size-4" />
          </Button>
          <Button
            className="rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 disabled:opacity-40 disabled:pointer-events-none"
            disabled={!!error}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDialog({
  open,
  appt,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  appt: Appointment | null;
  existing: Appointment[];
  onClose: () => void;
  onSave: (a: Appointment) => void;
}) {
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("11:30");
  const [days, setDays] = useState<Day[]>(["Mon"]);
  const [type, setType] = useState<string>(APPOINTMENT_TYPES[0]);
  const [provider, setProvider] = useState("");
  const [coTreat, setCoTreat] = useState(false);
  const [alertCfg, setAlertCfg] = useState<AlertSettings>(DEFAULT_ALERT);
  const [priming, setPriming] = useState<PrimingSettings>(DEFAULT_PRIMING);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(appt?.start ?? "11:00");
      setEnd(appt?.end ?? "11:30");
      setDays(appt?.days ?? ["Mon"]);
      setType(appt?.type ?? APPOINTMENT_TYPES[0]);
      setProvider(appt?.provider ?? "");
      setCoTreat(appt?.tag === "Co-Treat");
      setAlertCfg(appt?.alertCfg ?? DEFAULT_ALERT);
      setPriming(appt?.priming ?? DEFAULT_PRIMING);
      setError(null);
    }
  }, [open, appt]);

  const toggleDay = (d: Day) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const handleSave = () => {
    if (toMin(end) <= toMin(start)) {
      setError("End time must be after start time.");
      return;
    }
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    const conflict = existing.some(
      (x) =>
        x.id !== appt?.id &&
        x.days.some((d) => days.includes(d)) &&
        overlaps(start, end, x.start, x.end),
    );
    if (conflict) {
      setError("Appointments on the same day cannot overlap.");
      return;
    }
    onSave({
      id: appt?.id ?? `ap${Date.now()}`,
      start,
      end,
      days,
      type,
      provider: provider.trim() || "—",
      tag: coTreat ? "Co-Treat" : appt?.tag === "Handoff Session" ? "Handoff Session" : undefined,
      alertCfg,
      priming,
    });
  };

  // Shifts the modal up clear of the OS keyboard — this dialog has a
  // Provider text field.
  const keyboardInset = useKeyboardInset(open);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[calc(100vw-3rem)] max-w-sm rounded-2xl border-2 border-blue-400 shadow-xl transition-[translate] duration-150"
        style={keyboardInsetStyle(keyboardInset)}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="capitalize">
            {appt ? "Edit Appointment" : "Add Appointment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            <div className="mt-1 flex items-center justify-start flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">From</span>
              <TimeField value={start} onChange={setStart} />
              <span className="text-xs text-muted-foreground">to</span>
              <TimeField value={end} onChange={setEnd} />
              <span className="text-xs text-muted-foreground">
                ({formatDuration(toMin(end) - toMin(start))})
              </span>
            </div>
          </div>
          <div>
            <div className="flex gap-1">
              {DAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "btn-bevel flex-1 h-9 rounded-full border-2 text-xs inline-flex items-center justify-center gap-1",
                      on
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-blue-300 text-blue-700",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {(APPOINTMENT_TYPE_ICONS[t] ?? "•") + " " + t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Provider</Label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider name"
              className={cn("mt-1", INPUT_BLUE_CLS)}
            />
          </div>
          <TapToggle
            label="Co-Treat"
            icon={<HandshakeIcon className="size-3.5" />}
            checked={coTreat}
            onChange={setCoTreat}
          />
          <AlertsBlock
            alert={alertCfg}
            setAlert={setAlertCfg}
            priming={priming}
            setPriming={setPriming}
          />
          {error && <p className="text-xs text-blue-700">{error}</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
            onClick={onClose}
          >
            Cancel <X className="size-4" />
          </Button>
          <Button
            className="rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600"
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ALERT_MODE_OPTIONS: { value: AlertMode; label: string; Icon: typeof Bell }[] = [
  { value: "visual", label: "Notify", Icon: Bell },
  { value: "audio", label: "Chime", Icon: BellRing },
  { value: "off", label: "No Alert", Icon: BellOff },
];

const ZzIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M13 5h7l-7 9h7" />
    <path d="M3 13h6l-6 6h6" />
  </svg>
);

function AlertModeSelect({ mode, onMode }: { mode: AlertMode; onMode: (m: AlertMode) => void }) {
  return (
    <Select value={mode} onValueChange={(v) => onMode(v as AlertMode)}>
      <SelectTrigger className="h-9 px-3 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALERT_MODE_OPTIONS.map(({ value, label, Icon }) => (
          <SelectItem key={value} value={value}>
            <span className="inline-flex items-center gap-2">
              <Icon className="size-3.5" />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TapToggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium transition-colors leading-none py-0.5",
        checked ? "text-blue-700" : "text-stone-400 hover:text-stone-600",
      )}
    >
      <span className="relative inline-flex items-center justify-center size-3.5 shrink-0">
        {icon}
        {!checked && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-[120%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current rounded-full"
          />
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function AlertsBlock({
  alert,
  setAlert,
  priming,
  setPriming,
}: {
  alert: AlertSettings;
  setAlert: (a: AlertSettings) => void;
  priming: PrimingSettings;
  setPriming: (p: PrimingSettings) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Notification</Label>
        <div className="mt-1 space-y-2">
          <AlertModeSelect mode={alert.mode} onMode={(m) => setAlert({ ...alert, mode: m })} />
          <div className="flex flex-col items-start gap-1 pl-1">
            <TapToggle
              label="Till Dismissed"
              icon={<Pin className="size-3.5" />}
              checked={!alert.autofade}
              onChange={(v) => setAlert({ ...alert, autofade: !v })}
            />
            <TapToggle
              label="Allow Snooze"
              icon={<ZzIcon className="size-3.5" />}
              checked={alert.allowSnooze}
              onChange={(v) => setAlert({ ...alert, allowSnooze: v })}
            />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">5min Warning</Label>
        <div className="mt-1 space-y-2">
          <AlertModeSelect
            mode={priming.mode}
            onMode={(m) => setPriming({ ...priming, mode: m })}
          />
          <div className="flex flex-col items-start gap-1 pl-1">
            <TapToggle
              label="Till Dismissed"
              icon={<Pin className="size-3.5" />}
              checked={!priming.autofade}
              onChange={(v) => setPriming({ ...priming, autofade: !v })}
            />
            <TapToggle
              label="Allow Snooze"
              icon={<ZzIcon className="size-3.5" />}
              checked={priming.allowSnooze}
              onChange={(v) => setPriming({ ...priming, allowSnooze: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeField({
  value,
  onChange,
  onEditingChange,
  resetSide,
  resetActive,
  onReset,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fires whenever this field's keypad popover opens/closes — lets the
   *  parent show a hint scoped to whichever field is actively being typed. */
  onEditingChange?: (isEditing: boolean) => void;
  /** Which side the "fill the gap" reset button sits on — matches the
   *  session timer's linked pill, with the button attached to the time box
   *  itself rather than floating separately. Omit for a plain standalone
   *  pill (e.g. appointments, which have no surrounding-gap concept). */
  resetSide?: "left" | "right";
  /** False — grayed out, like the timer pill's "linked" state — exactly
   *  when this field already sits at the edge of its available gap, since
   *  there's nowhere further out to reset to. */
  resetActive?: boolean;
  onReset?: () => void;
}) {
  const { use24HourTime } = useSettings();
  const display = value ? formatTimeOfDayForDisplay(value, use24HourTime) : "";
  const box = (
    <TimeOfDayKeypad value={value} onChange={onChange} onEditingChange={onEditingChange}>
      {({ isEditing, open }) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            "flex h-9 w-[84px] items-center justify-center border-2 bg-white px-1.5 text-sm tabular-nums shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)] transition-colors",
            !resetSide && "rounded-full",
            resetSide === "left" && "rounded-r-full",
            resetSide === "right" && "rounded-l-full",
            isEditing ? "border-blue-400" : "border-blue-300",
            display ? "text-blue-700" : "text-stone-300",
          )}
        >
          {display || "00:00a"}
        </button>
      )}
    </TimeOfDayKeypad>
  );

  if (!resetSide) return box;

  const ResetIcon = resetSide === "left" ? ArrowLeftToLine : ArrowRightToLine;
  const resetButton = (
    <button
      type="button"
      data-tour={resetSide === "left" ? "fit-start-button" : "fit-end-button"}
      onClick={onReset}
      disabled={!resetActive}
      aria-label={
        resetSide === "left"
          ? "Extend start to fill the available gap"
          : "Extend end to fill the available gap"
      }
      className={cn(
        "grid h-9 w-7 shrink-0 place-items-center transition-colors",
        resetSide === "left" ? "rounded-l-full" : "rounded-r-full",
        resetActive
          ? "btn-bevel bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
          : "bg-stone-300 text-stone-500",
      )}
    >
      <ResetIcon className="size-3.5" />
    </button>
  );

  return (
    <div className="inline-flex items-stretch">
      {resetSide === "left" && resetButton}
      {box}
      {resetSide === "right" && resetButton}
    </div>
  );
}

function NewScheduleDialog({
  open,
  onCancel,
  onCreate,
}: {
  open: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("New Schedule");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("New Schedule");
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open]);

  // Shifts the modal up clear of the OS keyboard.
  const keyboardInset = useKeyboardInset(open);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        className="max-w-sm rounded-2xl border-border shadow-xl transition-[translate] duration-150"
        style={keyboardInsetStyle(keyboardInset)}
      >
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate(name);
              }}
              className={cn("mt-1 rounded-full px-4", INPUT_BLUE_CLS)}
            />
          </div>
        </div>
        {/* DialogFooter's default stacks full-width at narrow widths
            (flex-col-reverse below `sm:`) — forcing a row keeps Cancel/Save
            side by side, matching the other text-entry dialogs. */}
        <DialogFooter className="flex-row justify-end gap-2 space-x-0">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
            onClick={onCancel}
          >
            <X className="size-4" /> Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600"
            onClick={() => onCreate(name)}
          >
            <Plus className="size-4" /> Create New Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
