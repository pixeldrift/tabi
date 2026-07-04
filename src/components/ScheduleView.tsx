import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { CollapseIcon } from "./icons/CollapseIcon";
import { ProportionalRowsIcon } from "./icons/ProportionalRowsIcon";
import { SmileyIcon } from "./icons/SmileyIcon";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";


import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrubText } from "@/components/ScrubText";
import { useNotifications } from "@/components/NotificationContext";
import { TimeOfDayKeypad, formatTimeOfDay } from "@/components/TimeOfDayKeypad";
import { useStickyTop } from "@/hooks/use-sticky-top";


const LOCATIONS = [
  "Treatment Room",
  "Kitchen",
  "Classroom",
  "Big Gym",
  "Small Gym",
  "Classroom Bathroom",
  "Learner Bathroom",
  "Solo Bathroom",
] as const;

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
  "Snack": "🍎",
  "Lunch": "🥪",
  "Imaginative Play": "🦄",
  "Social Group": "🙋",
  "Arts and Crafts": "🎨",
  "Gross Motor Play": "🏃",
  "Peer Play": "🧩",
  "Client Choice": "⭐",
  "Discreet Trials": "📋",
  "Potty Time": "💩",
  "Cooking": "🍳",
  "Cleanup": "🧹",
  "Reading": "📖",
  "Pack Up/Dismissal": "🎒",
  "Custom": "✨",
};

const LOCATION_ICONS: Record<string, string> = {
  "Treatment Room": "🚪",
  "Kitchen": "🍽️",
  "Classroom": "📚",
  "Big Gym": "🏀",
  "Small Gym": "⛺️",
  "Classroom Bathroom": "🚽",
  "Learner Bathroom": "🚽",
  "Solo Bathroom": "🚽",
};

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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
type Day = (typeof DAYS)[number];

type AlertMode = "off" | "visual" | "audio";

type AlertSettings = {
  mode: AlertMode;
  allowSnooze: boolean;
  autofade: boolean;
};
type PrimingSettings = AlertSettings & { minutesPrior: number };

const DEFAULT_ALERT: AlertSettings = {
  mode: "visual",
  allowSnooze: true,
  autofade: true,
};
const DEFAULT_PRIMING: PrimingSettings = {
  mode: "off",
  allowSnooze: true,
  autofade: true,
  minutesPrior: 5, // DEFAULT_PRIMING_MINUTES (declared below)
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

type ApptTag = "Co-Treat" | "Handoff Session";

type Appointment = {
  id: string;
  start: string;
  end: string;
  days: Day[];
  type: string;
  provider: string;
  tag?: ApptTag;
  alertCfg?: AlertSettings;
  priming?: PrimingSettings;
};

type Schedule = {
  name: string;
  items: ScheduleItem[];
  appointments: Appointment[];
  locked?: boolean;
};

const DAY_START = "08:00";
const DAY_END = "18:00";
const PX_PER_MIN = 3.6;       // proportional: 5min smallest row ≈ 18px
const MIN_ROW_MIN = 5;
const COLLAPSED_ROW_PX = 36;  // uniform row height in collapsed mode
const CLIENT_GROUP = "Group A"; // demo: this client belongs to Group A

// Defaults — TODO: surface in user settings.
const DEFAULT_PRIMING_MINUTES = 5;

// Animation timing — TODO: surface in user settings.
const EDIT_MODE_DURATION_MS = 350;
const EDIT_MODE_STAGGER_MS = 60;
const APPT_COLLAPSE_STIFFNESS = 320;
const APPT_COLLAPSE_DAMPING = 32;
const APPT_COLLAPSE_DURATION_MS = 320;
const MODE_TRANSITION_DURATION_MS = 220;



const GROUP_A: ScheduleItem[] = [
  { id: "a1", start: "08:00", end: "08:30", activity: "Reading", location: "Classroom", alert: "visual" },
  { id: "a2", start: "08:30", end: "09:15", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "a3", start: "09:15", end: "10:00", activity: "Gross Motor Play", location: "Big Gym", alert: "audio" },
  { id: "a4", start: "10:00", end: "10:30", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "a5", start: "10:30", end: "11:30", activity: "Social Group", location: "Classroom", alert: "audio" },
  { id: "a6", start: "11:30", end: "12:15", activity: "Sensory Play", location: "Treatment Room", alert: "off" },
  { id: "a7", start: "12:15", end: "13:00", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "a8", start: "13:00", end: "14:00", activity: "Arts and Crafts", location: "Classroom", alert: "visual" },
  { id: "a9", start: "14:00", end: "15:00", activity: "Peer Play", location: "Small Gym", alert: "audio" },
  { id: "a10", start: "15:00", end: "15:30", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "a11", start: "15:30", end: "16:30", activity: "Imaginative Play", location: "Classroom", alert: "off" },
  { id: "a12", start: "16:30", end: "17:30", activity: "Client Choice", location: "Small Gym", alert: "off" },
  { id: "a13", start: "17:30", end: "18:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const GROUP_B: ScheduleItem[] = [
  { id: "b1", start: "08:00", end: "08:30", activity: "Reading", location: "Classroom", alert: "visual" },
  { id: "b2", start: "08:30", end: "09:30", activity: "Imaginative Play", location: "Classroom", alert: "off" },
  { id: "b3", start: "09:30", end: "10:30", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "b4", start: "10:30", end: "11:00", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "b5", start: "11:00", end: "12:00", activity: "Gross Motor Play", location: "Big Gym", alert: "audio" },
  { id: "b6", start: "12:00", end: "12:45", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "b7", start: "12:45", end: "13:45", activity: "Client Choice", location: "Small Gym", alert: "off" },
  { id: "b8", start: "13:45", end: "14:45", activity: "Social Group", location: "Classroom", alert: "audio" },
  { id: "b9", start: "14:45", end: "15:15", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "b10", start: "15:15", end: "16:15", activity: "Arts and Crafts", location: "Classroom", alert: "visual" },
  { id: "b11", start: "16:15", end: "17:15", activity: "Peer Play", location: "Small Gym", alert: "audio" },
  { id: "b12", start: "17:15", end: "18:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const GROUP_C: ScheduleItem[] = [
  { id: "c1", start: "08:00", end: "08:30", activity: "Reading", location: "Classroom", alert: "visual" },
  { id: "c2", start: "08:30", end: "09:30", activity: "Sensory Play", location: "Treatment Room", alert: "off" },
  { id: "c3", start: "09:30", end: "10:30", activity: "Social Group", location: "Classroom", alert: "audio" },
  { id: "c4", start: "10:30", end: "11:00", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "c5", start: "11:00", end: "12:00", activity: "Arts and Crafts", location: "Classroom", alert: "visual" },
  { id: "c6", start: "12:00", end: "12:45", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "c7", start: "12:45", end: "13:45", activity: "Gross Motor Play", location: "Big Gym", alert: "audio" },
  { id: "c8", start: "13:45", end: "14:45", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "c9", start: "14:45", end: "15:15", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "c10", start: "15:15", end: "16:15", activity: "Imaginative Play", location: "Classroom", alert: "off" },
  { id: "c11", start: "16:15", end: "17:15", activity: "Peer Play", location: "Small Gym", alert: "audio" },
  { id: "c12", start: "17:15", end: "18:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const PHINEAS: ScheduleItem[] = [
  { id: "p1", start: "10:00", end: "10:20", activity: "Arrive/Pairing", location: "Treatment Room", alert: "visual" },
  { id: "p2", start: "10:20", end: "10:30", activity: "Potty Time", location: "Solo Bathroom", alert: "off" },
  { id: "p3", start: "10:30", end: "11:15", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "p4", start: "11:15", end: "11:45", activity: "Sensory Play", location: "Treatment Room", alert: "off" },
  { id: "p5", start: "11:45", end: "12:00", activity: "Potty Time", location: "Learner Bathroom", alert: "off" },
  { id: "p6", start: "12:00", end: "12:30", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "p7", start: "12:30", end: "13:15", activity: "Gross Motor Play", location: "Big Gym", alert: "audio" },
  { id: "p8", start: "13:15", end: "13:30", activity: "Potty Time", location: "Classroom Bathroom", alert: "off" },
  { id: "p9", start: "13:30", end: "14:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const PHINEAS_APPTS: Appointment[] = [
  { id: "ap1", start: "11:00", end: "11:30", days: ["Mon", "Wed"], type: "Speech Therapy", provider: "Dr. Lopez", tag: "Co-Treat" },
  { id: "ap2", start: "13:00", end: "13:30", days: ["Tue", "Thu"], type: "Occupational Therapy", provider: "Sam Patel", tag: "Handoff Session" },
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
function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "p" : "a";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")}${period}`;
}

function randomDemoTime(): Date {
  const d = new Date();
  const startMin = toMin(DAY_START);
  const endMin = toMin(DAY_END);
  const m = startMin + Math.floor(Math.random() * (endMin - startMin));
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function fromMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart);
}

const INPUT_BLUE_CLS = "border-2 border-blue-300 focus-visible:ring-blue-300";

export function ScheduleView({
  scrollTargetId,
  onScrolledToTarget,
}: {
  scrollTargetId?: string | null;
  onScrolledToTarget?: () => void;
} = {}) {
  const [now, setNow] = useState<Date>(() => randomDemoTime());
  const bumpTime = () => {
    setNow((prev) => {
      const d = new Date(prev);
      d.setMinutes(d.getMinutes() + 10);
      return d;
    });
  };

  // Randomly pin ~half of every schedule's activities (autofade off) on first mount.
  const [schedules, setSchedules] = useState<Schedule[]>(() =>
    PRESETS.map((s) => ({
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
    })),
  );
  const [activeName, setActiveName] = useState<string>("Phineas' Schedule");
  const active = schedules.find((s) => s.name === activeName) ?? schedules[0];
  const isLocked = !!active.locked;

  const [editMode, setEditMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"proportional" | "collapsed">("proportional");
  const [showAppts, setShowAppts] = useState(true);
  const [showIcons, setShowIcons] = useState(true);
  const [collapsedAppts, setCollapsedAppts] = useState<Record<string, boolean>>({});
  const [allApptsCollapsed, setAllApptsCollapsed] = useState(false);

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [creatingAppt, setCreatingAppt] = useState(false);
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
  const stickyTop = useStickyTop();
  const [stickyCompact, setStickyCompact] = useState(false);
  const togglesSentinelRef = useRef<HTMLDivElement>(null);

  // Track compact state via direct geometry checks tied to scroll/resize,
  // rather than IntersectionObserver: IO callbacks are batched and can fire a
  // frame or more after the browser's own `position: sticky` snap, which was
  // making the label crossfade visibly lag the actual stick/unstick moment.
  useEffect(() => {
    const el = togglesSentinelRef.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      setStickyCompact(el.getBoundingClientRect().top <= stickyTop);
    };
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stickyTop]);

  const items = active.items;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const dayStart = items.length ? toMin(items[0].start) : toMin(DAY_START);
  const dayEnd = items.length ? toMin(items[items.length - 1].end) : toMin(DAY_END);
  const currentItem = items.find(
    (i) => nowMin >= toMin(i.start) && nowMin < toMin(i.end),
  );
  const outsideSchedule = !currentItem;

  // ---- Alert firing: when `now` crosses an item's priming or start time,
  // push a notification. Idempotent per (itemId, kind, day) via dedupeKey.
  const { push: pushNotification, prefs: notificationPrefs } = useNotifications();
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
          body: it.location,
          icon: alertCfg.mode === "audio" ? "bell-chime" : "bell",
          autofadeMs: alertCfg.autofade ? notificationPrefs.notificationDurationMs : undefined,
          allowSnooze: alertCfg.allowSnooze,
          sourceRef: { type: "activity", id: it.id },
        });
      }
      // alert-priming
      if (priming && priming.mode !== "off") {
        const primeMin = startMin - priming.minutesPrior;
        if (prevMin < primeMin && nowMin >= primeMin) {
          pushNotification({
            dedupeKey: `alert-priming:${it.id}:${dayKey}`,
            kind: "alert-priming",
            title: `In ${priming.minutesPrior} min: ${it.customName ?? it.activity}`,
            body: it.location,
            icon: priming.mode === "audio" ? "bell-chime" : "bell",
            autofadeMs: priming.autofade ? notificationPrefs.notificationDurationMs : undefined,
            allowSnooze: priming.allowSnooze,
            sourceRef: { type: "activity", id: it.id },
          });
        }
      }
    }
  }, [nowMin, items, now, pushNotification, notificationPrefs]);



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
    setSchedules((p) => [
      ...p,
      { name: final, items: [], appointments: [] },
    ]);
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
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  // Compute each row's top and height based on layoutMode.
  const rowLayout = useMemo(() => {
    if (layoutMode === "collapsed") {
      return items.map((it, idx) => ({
        item: it,
        top: idx * COLLAPSED_ROW_PX,
        height: COLLAPSED_ROW_PX,
      }));
    }
    return items.map((it) => {
      const top = (toMin(it.start) - dayStart) * PX_PER_MIN;
      const durMin = Math.max(toMin(it.end) - toMin(it.start), MIN_ROW_MIN);
      return { item: it, top, height: durMin * PX_PER_MIN };
    });
  }, [items, layoutMode, dayStart]);

  const totalHeight =
    layoutMode === "collapsed"
      ? Math.max(items.length * COLLAPSED_ROW_PX, COLLAPSED_ROW_PX)
      : (dayEnd - dayStart) * PX_PER_MIN;

  const arrowTop = (() => {
    if (editMode) return null;
    if (layoutMode === "proportional") {
      if (!outsideSchedule) return (nowMin - dayStart) * PX_PER_MIN;
      return nowMin < dayStart ? -2 : totalHeight + 16;
    }
    if (currentItem) {
      const row = rowLayout.find((r) => r.item.id === currentItem.id);
      if (row) return row.top + row.height / 2;
    }
    return nowMin < dayStart ? -2 : totalHeight + 16;
  })();
  const arrowGray = outsideSchedule;
  // Only the "after hours" case has genuine empty space below the last row
  // to show the label in without overlapping the header or a row.
  const showOutsideOfHoursLabel = arrowGray && nowMin >= dayEnd;

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToNow = () => {
    if (!currentItem) return;
    const el = rowRefs.current.get(currentItem.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerRowFlash(currentItem.id);
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
      window.scrollTo({ top: 0 });
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
      const pxWithinRow = (row: (typeof rowLayout)[number], minutes: number) => {
        const rowStart = toMin(row.item.start);
        const rowEnd = toMin(row.item.end);
        const span = Math.max(rowEnd - rowStart, 1);
        const frac = Math.min(1, Math.max(0, (minutes - rowStart) / span));
        return row.top + frac * row.height;
      };
      const aStart = toMin(a.start);
      const aEnd = toMin(a.end);
      const startRow =
        rowLayout.find((r) => aStart >= toMin(r.item.start) && aStart < toMin(r.item.end)) ??
        rowLayout.find((r) => toMin(r.item.start) >= aStart) ??
        rowLayout[rowLayout.length - 1];
      const endRow =
        rowLayout.find((r) => aEnd > toMin(r.item.start) && aEnd <= toMin(r.item.end)) ??
        startRow;
      const top = startRow ? pxWithinRow(startRow, aStart) : 0;
      const bottom = endRow ? pxWithinRow(endRow, aEnd) : top + COLLAPSED_ROW_PX;
      const MIN_APPT_PX = 20;
      return { appt: a, top, height: Math.max(bottom - top, MIN_APPT_PX) };
    });
  }, [active.appointments, layoutMode, dayStart, rowLayout]);


  return (
    <div className="max-w-3xl mx-auto pt-0 pb-12">
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
            disabled={!currentItem || editMode}
            className={cn(
              "mt-0.5 h-6 text-[10px] uppercase tracking-wide text-white rounded-full px-2 py-0 gap-1",
              !currentItem || editMode
                ? "bg-stone-300 hover:bg-stone-300"
                : "bg-blue-600 hover:bg-blue-700",
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
            className="flex-1 min-w-0 h-11 text-base rounded-full px-4 font-bold border-2 border-transparent bg-transparent shadow-none text-stone-800 transition-colors"
            style={{ transitionDuration: `${EDIT_MODE_DURATION_MS}ms` }}
          />
        ) : (
          <Select value={activeName} onValueChange={setActiveName}>
            <SelectTrigger
              // min-w-0 lets this shrink below its text's intrinsic width —
              // without it, a long schedule name can force the flex row wider
              // than the viewport and push Cancel/Save off screen.
              className="flex-1 min-w-0 h-11 text-base rounded-full px-4 font-bold border-2 bg-white border-blue-500 text-blue-700 focus:ring-blue-300 transition-colors"
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
        <div className="flex items-center gap-1 overflow-hidden">
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
                  className="h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 gap-1.5"
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
                    : "text-blue-600 hover:text-blue-700",
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
                className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 text-xs gap-1 [&_svg]:size-3"
                onClick={duplicateActive}
              >
                <Copy /> Duplicate
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 text-xs gap-1 [&_svg]:size-3"
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
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                <HandHelping className="size-4" /> Appointments
              </div>
              <Button
                size="sm"
                className="h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3 [&_svg]:size-3"
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
                        {a.type} <span className="text-stone-500">· {a.provider}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.days.join(", ")} · {fmt12(a.start)}–{fmt12(a.end)}
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

          <Button
            className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setCreatingNew(true)}
          >
            Add Activity <Plus className="size-4 ml-1.5" />
          </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggles row — sticky under StatusBar */}
      <div className="mt-3" />
      <div ref={togglesSentinelRef} className="h-0" aria-hidden />
      <div
        className={cn(
          "sticky z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] bg-background border-b border-stone-200/70 py-1.5 px-8",
          stickyCompact ? "shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]" : "shadow-none",
        )}
        style={{ top: stickyTop }}
      >
        <div className="relative flex items-center text-xs gap-2 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() =>
              setLayoutMode((m) => (m === "proportional" ? "collapsed" : "proportional"))
            }
            className="flex items-center gap-1.5 text-blue-600"
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
            disabled={!currentItem || editMode}
            aria-hidden={!stickyCompact}
            tabIndex={stickyCompact ? 0 : -1}
            className={cn(
              "btn-bevel ml-auto inline-flex items-center gap-1 h-6 pl-2 pr-2.5 rounded-full text-[11px] font-semibold text-white tabular-nums transition-all duration-300 ease-out",
              stickyCompact
                ? "opacity-100 translate-x-0 delay-300"
                : "opacity-0 translate-x-[130%] pointer-events-none delay-0",
              !currentItem || editMode
                ? "bg-stone-300"
                : "bg-blue-600 hover:bg-blue-700",
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
            {fmt12(`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`)}
          </button>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="mt-3 mx-1 rounded-xl border border-stone-200 relative">
        <div className="grid grid-cols-[40px_1fr_84px_34px] gap-1 px-1.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-stone-300 bg-stone-200 rounded-xl">
          <div className="text-right pr-1.5">Time</div>
          <div className="flex items-center gap-1.5">
            <span className="invisible text-sm leading-none shrink-0" aria-hidden>•</span>
            <span>Activity</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="invisible text-xs leading-none shrink-0" aria-hidden>•</span>
            <span>Location</span>
          </div>
          <div className="text-center">{editMode ? "Edit" : "Alert"}</div>
        </div>

        <div ref={listRef} className="relative" style={{ height: totalHeight }}>
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
                  fill={arrowGray ? "#a8a29e" : "#2563eb"}
                />
              </svg>
              {showOutsideOfHoursLabel && (
                <span className="ml-1 text-[10px] uppercase tracking-wide text-stone-400 whitespace-nowrap">
                  Outside of hours
                </span>
              )}
            </div>
          )}

          {rowLayout.map(({ item: it, top, height }) => {
            const isCurrent = !editMode && currentItem?.id === it.id;
            const displayName =
              it.activity === "Custom" ? it.customName ?? "Custom" : it.activity;
            const displayIcon =
              it.activity === "Custom"
                ? it.customIcon ?? "✨"
                : ACTIVITY_ICONS[it.activity] ?? "•";
            const alertMode = it.alert;
            const actualDurMin = toMin(it.end) - toMin(it.start);
            const gridLines =
              layoutMode === "proportional"
                ? Math.max(0, Math.floor((actualDurMin - 1) / 5))
                : 0;
            return (
              <div
                key={it.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(it.id, el);
                  else rowRefs.current.delete(it.id);
                }}
                className="absolute left-0 right-0 z-10"
                style={{ top, height }}
              >
                <div
                  key={flashRowId === it.id ? `bg-${flashGen}` : "bg"}
                  className={cn(
                    "absolute inset-0 rounded-md border border-stone-300 bg-white transition-colors",
                    isCurrent && "!border-2 !border-blue-500 !bg-blue-50",
                    flashRowId === it.id && flashGen > 0 && "animate-row-flash",
                  )}
                />
                {Array.from({ length: gridLines }, (_, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute left-1 right-1 border-t border-stone-100"
                    style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                  />
                ))}
                <div className="relative h-full grid grid-cols-[40px_1fr_84px_34px] gap-1 items-start pt-1.5 pb-1 px-2">
                  <div className="text-[11px] tabular-nums leading-tight text-right pr-1.5 pt-0.5">
                    {fmt12(it.start)}
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    {showIcons && (
                      <span className="text-sm leading-none shrink-0">{displayIcon}</span>
                    )}
                    <ScrubText text={displayName} className="text-xs font-medium flex-1 leading-tight" />
                  </div>
                  <div className="flex items-start gap-1 min-w-0">
                    {showIcons && (
                      <span className="text-xs leading-none shrink-0">
                        {LOCATION_ICONS[it.location] ?? "📍"}
                      </span>
                    )}
                    <ScrubText text={it.location} className="text-xs flex-1 leading-tight" />
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
                      "absolute inset-0 rounded-md bg-green-50 border-2 border-green-500 transition-opacity",
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
                    <div className="relative h-full grid grid-cols-[40px_1fr_30px] gap-1 px-1.5 pt-0.5 items-start">
                      <div className="text-[11px] tabular-nums leading-tight text-green-800 pl-0.5 pt-0.5">
                        {fmt12(a.start)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ScrubText
                            text={a.type}
                            className="text-xs font-semibold text-green-800 leading-tight truncate"
                          />
                          {a.tag && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-green-600 text-white text-[9px] uppercase tracking-wide px-1.5 py-px font-semibold">
                              {a.tag}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] italic text-green-700/90 leading-tight truncate">
                          {a.provider}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={collapse}
                        className="size-6 grid place-items-center rounded-full text-green-700 hover:bg-green-100"
                        aria-label="Collapse appointment"
                      >
                        <CollapseIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>


      <ItemDialog
        open={!!editing || creatingNew}
        item={editing}
        existing={active.items}
        onClose={() => {
          setEditing(null);
          setCreatingNew(false);
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
          setCreatingNew(false);
        }}
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
        body={confirmItemDelete ? `“${confirmItemDelete.activity}” at ${fmt12(confirmItemDelete.start)} will be removed.` : ""}
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

function AlertCycle({ mode, onChange }: { mode: AlertMode; onChange: (m: AlertMode) => void }) {
  const next: Record<AlertMode, AlertMode> = { off: "visual", visual: "audio", audio: "off" };
  const Icon = mode === "off" ? BellOff : mode === "visual" ? Bell : BellRing;
  return (
    <button
      type="button"
      onClick={() => onChange(next[mode])}
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

// Tracks how much the OS on-screen keyboard has eaten into the viewport
// (window.innerHeight minus the visualViewport's visible height/offset), so
// a centered modal can shift itself up to stay clear of it — the keyboard
// resizes/offsets the visualViewport but not the fixed-position layout
// viewport a centered dialog is normally positioned against.
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

// Shared with every text-entry dialog below: shifts the modal up by half
// the keyboard's height so it stays centered in the space actually left
// visible above it, instead of the keyboard covering its buttons. The base
// DialogContent centers via Tailwind's `translate-x-[-50%] translate-y-[-50%]`
// classes — Tailwind v4 compiles those to the standalone CSS `translate`
// property, not `transform`, so an inline `transform` here would compose
// with (not replace) it and double the offset. Overriding the same
// `translate` property is what actually wins.
function keyboardInsetStyle(inset: number): React.CSSProperties | undefined {
  return inset > 0 ? { translate: `-50% calc(-50% - ${inset / 2}px)` } : undefined;
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
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        <DialogFooter>
          <Button
            variant="outline"
            className={cn("rounded-full text-blue-700 hover:bg-blue-50", "border-2 border-blue-300")}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  item,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  item: ScheduleItem | null;
  existing: ScheduleItem[];
  onClose: () => void;
  onSave: (i: ScheduleItem) => void;
}) {
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("10:30");
  const [activity, setActivity] = useState<string>(ACTIVITIES[0]);
  const [customName, setCustomName] = useState("");
  const [customIcon, setCustomIcon] = useState("✨");
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [alertCfg, setAlertCfg] = useState<AlertSettings>(DEFAULT_ALERT);
  const [priming, setPriming] = useState<PrimingSettings>(DEFAULT_PRIMING);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(item?.start ?? "10:00");
      setEnd(item?.end ?? "10:30");
      setActivity(item?.activity ?? ACTIVITIES[0]);
      setCustomName(item?.customName ?? "");
      setCustomIcon(item?.customIcon ?? "✨");
      setLocation(item?.location ?? LOCATIONS[0]);
      setAlertCfg(item?.alertCfg ?? { ...DEFAULT_ALERT, mode: item?.alert ?? DEFAULT_ALERT.mode });
      setPriming(item?.priming ?? DEFAULT_PRIMING);
      setError(null);
    }
  }, [open, item]);

  const handleSave = () => {
    if (toMin(end) <= toMin(start)) {
      setError("End time must be after start time.");
      return;
    }
    const conflict = existing.some(
      (x) => x.id !== item?.id && overlaps(start, end, x.start, x.end),
    );
    if (conflict) {
      setError("Activities cannot overlap. Adjust the time.");
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
          <DialogTitle className="capitalize">{item ? "Edit Activity" : "Add Activity"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">From</span>
              <TimeField value={start} onChange={setStart} />
              <span className="text-xs text-muted-foreground">to</span>
              <TimeField value={end} onChange={setEnd} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {(LOCATION_ICONS[l] ?? "📍") + " " + l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertsBlock alert={alertCfg} setAlert={setAlertCfg} priming={priming} setPriming={setPriming} />
          {error && <p className="text-xs text-blue-700">{error}</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700"
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
          <DialogTitle className="capitalize">{appt ? "Edit Appointment" : "Add Appointment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">From</span>
              <TimeField value={start} onChange={setStart} />
              <span className="text-xs text-muted-foreground">to</span>
              <TimeField value={end} onChange={setEnd} />
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            icon={<HandHelping className="size-3.5" />}
            checked={coTreat}
            onChange={setCoTreat}
          />
          <AlertsBlock alert={alertCfg} setAlert={setAlertCfg} priming={priming} setPriming={setPriming} />
          {error && <p className="text-xs text-blue-700">{error}</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700"
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

function AlertModeSelect({
  mode,
  onMode,
}: {
  mode: AlertMode;
  onMode: (m: AlertMode) => void;
}) {
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
          <AlertModeSelect mode={priming.mode} onMode={(m) => setPriming({ ...priming, mode: m })} />
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

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value ? formatTimeOfDay(value) : "";
  return (
    <TimeOfDayKeypad value={value} onChange={onChange}>
      {({ isEditing, open }) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            "flex h-9 w-[96px] items-center justify-center rounded-full border-2 bg-white px-2 text-sm tabular-nums shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] transition-colors",
            isEditing ? "border-blue-500" : "border-blue-300",
            display ? "text-blue-700" : "text-stone-300",
          )}
        >
          {display || "00:00 AM"}
        </button>
      )}
    </TimeOfDayKeypad>
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
        className="max-w-sm rounded-2xl border-stone-200 shadow-xl transition-[translate] duration-150"
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
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700"
            onClick={() => onCreate(name)}
          >
            <Plus className="size-4" /> Create New Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


