import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  Bell,
  BellOff,
  BellRing,
  HandHelping,
  Copy,
  Type,
  Check,
  X,
  FilePlus,
  PencilOff,
  Star,
  Rows3,
  AlignVerticalJustifyStart,
  ChevronRight,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrubText } from "@/components/ScrubText";


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
const PX_PER_MIN = 4.5;       // proportional: 5min smallest row ≈ 22px
const MIN_ROW_MIN = 5;
const COLLAPSED_ROW_PX = 40;  // uniform row height in collapsed mode
const CLIENT_GROUP = "Group A"; // demo: this client belongs to Group A

// Defaults — TODO: surface in user settings.
const DEFAULT_PRIMING_MINUTES = 5;
const SNOOZE_MINUTES = 1;
const AUTOFADE_SECONDS = 5;



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

const SELECT_ITEM_CLS =
  "focus:bg-blue-100 focus:text-blue-900 data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-900";

const INPUT_BLUE_CLS = "border-2 border-blue-300 focus-visible:ring-blue-300";

export function ScheduleView() {
  const [now, setNow] = useState<Date>(() => randomDemoTime());
  const bumpTime = () => {
    setNow((prev) => {
      const d = new Date(prev);
      d.setMinutes(d.getMinutes() + 10);
      return d;
    });
  };

  const [schedules, setSchedules] = useState<Schedule[]>(PRESETS);
  const [activeName, setActiveName] = useState<string>("Phineas' Schedule");
  const active = schedules.find((s) => s.name === activeName) ?? schedules[0];
  const isLocked = !!active.locked;

  const [editMode, setEditMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"proportional" | "collapsed">("proportional");
  const [showAppts, setShowAppts] = useState(true);
  const [collapsedAppts, setCollapsedAppts] = useState<Record<string, boolean>>({});
  const [allApptsCollapsed, setAllApptsCollapsed] = useState(false);

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [creatingAppt, setCreatingAppt] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newSchedOpen, setNewSchedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmItemDelete, setConfirmItemDelete] = useState<ScheduleItem | null>(null);
  const [confirmApptDelete, setConfirmApptDelete] = useState<Appointment | null>(null);
  const [nowAnim, setNowAnim] = useState(0); // bump to retrigger bounce/flash

  const items = active.items;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const dayStart = items.length ? toMin(items[0].start) : toMin(DAY_START);
  const dayEnd = items.length ? toMin(items[items.length - 1].end) : toMin(DAY_END);
  const currentItem = items.find(
    (i) => nowMin >= toMin(i.start) && nowMin < toMin(i.end),
  );
  const outsideSchedule = !currentItem;

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
      return nowMin < dayStart ? -2 : totalHeight + 2;
    }
    if (currentItem) {
      const row = rowLayout.find((r) => r.item.id === currentItem.id);
      if (row) return row.top + row.height / 2;
    }
    return nowMin < dayStart ? -2 : totalHeight + 2;
  })();
  const arrowGray = outsideSchedule;

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToNow = () => {
    if (!currentItem) return;
    const el = rowRefs.current.get(currentItem.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el) {
      el.classList.remove("animate-row-flash");
      void el.offsetWidth;
      el.classList.add("animate-row-flash");
    }
    setNowAnim((n) => n + 1);
  };

  // Auto-scroll to current activity when it changes (or layout/schedule changes).
  useEffect(() => {
    if (!currentItem) return;
    const el = rowRefs.current.get(currentItem.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id, layoutMode, activeName]);

  const setAlertFor = (it: ScheduleItem, m: AlertMode) => {
    updateActive((list) => list.map((x) => (x.id === it.id ? { ...x, alert: m } : x)));
  };


  // Appointment overlays, positioned via rowLayout so collapsed mode also lines up.
  const visibleAppts = useMemo(() => {
    if (!showAppts) return [];
    return active.appointments.map((a) => {
      if (layoutMode === "proportional") {
        const top = (toMin(a.start) - dayStart) * PX_PER_MIN;
        const height = Math.max(toMin(a.end) - toMin(a.start), MIN_ROW_MIN) * PX_PER_MIN;
        return { appt: a, top, height };
      }
      // collapsed: pin to row containing the appt start
      const aStart = toMin(a.start);
      const aEnd = toMin(a.end);
      const startRow =
        rowLayout.find((r) => aStart >= toMin(r.item.start) && aStart < toMin(r.item.end)) ??
        rowLayout.find((r) => toMin(r.item.start) >= aStart) ??
        rowLayout[rowLayout.length - 1];
      const endRow =
        rowLayout.find((r) => aEnd > toMin(r.item.start) && aEnd <= toMin(r.item.end)) ??
        startRow;
      const top = startRow ? startRow.top : 0;
      const bottom = endRow ? endRow.top + endRow.height : top + COLLAPSED_ROW_PX;
      return { appt: a, top, height: Math.max(bottom - top, COLLAPSED_ROW_PX) };
    });
  }, [showAppts, active.appointments, layoutMode, dayStart, rowLayout]);


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
              "mt-0.5 h-6 text-[10px] uppercase tracking-wide text-white rounded-full px-2 py-0 gap-1 [&_svg]:size-3",
              !currentItem || editMode
                ? "bg-stone-300 hover:bg-stone-300"
                : "bg-blue-600 hover:bg-blue-700",
            )}
          >
            <ChevronRight strokeWidth={3} />
            Now
          </Button>
        </div>
      </div>

      {/* Schedule selector */}
      <div className="mt-4 flex items-center gap-2 px-1">
        <Select value={activeName} onValueChange={(v) => { setActiveName(v); setEditMode(false); }} disabled={editMode}>
          <SelectTrigger className={cn(
            "flex-1 h-11 text-base rounded-full px-4",
            editMode
              ? "bg-transparent border-0 shadow-none text-stone-800 font-medium disabled:opacity-100 [&>svg]:hidden"
              : "bg-white border-2 border-blue-500 text-blue-700 focus:ring-blue-300",
          )}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {schedules.map((s) => (
              <SelectItem key={s.name} value={s.name} className={SELECT_ITEM_CLS}>
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
        {editMode ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              className="h-11 w-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setEditMode(false)}
              aria-label="Save"
            >
              <Check className="size-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 rounded-full text-stone-500 hover:bg-stone-100"
              onClick={() => setEditMode(false)}
              aria-label="Cancel"
            >
              <X className="size-5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isLocked) return;
              setEditMode(true);
            }}
            disabled={isLocked}
            className={cn(
              "h-11 w-11 grid place-content-center rounded-full",
              isLocked
                ? "text-stone-300 cursor-not-allowed"
                : "text-blue-600 hover:bg-blue-50",
            )}
            aria-label={isLocked ? "Locked — duplicate to edit" : "Edit schedule"}
            title={isLocked ? "Locked — duplicate to edit" : "Edit schedule"}
          >
            {isLocked ? <PencilOff className="size-5" /> : <Pencil className="size-5" />}
          </button>
        )}
      </div>

      {editMode && (
        <div className="mt-2 space-y-2 px-1">
          <div className="flex items-center gap-1 flex-nowrap">
            <Button
              size="sm"
              className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 text-xs gap-1 [&_svg]:size-3"
              onClick={() => {
                setRenameValue(active.name);
                setRenameOpen(true);
              }}
            >
              <Type /> Rename
            </Button>
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
              <FilePlus /> New
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 text-xs gap-1 [&_svg]:size-3 ml-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      )}


      {/* Toggles row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs">
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
            <Rows3 className="size-3.5" />
          ) : (
            <AlignVerticalJustifyStart className="size-3.5" />
          )}
          {layoutMode === "proportional" ? "Show Collapsed" : "Show Proportional"}
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
          <HandHelping className="size-3.5" />
          {showAppts ? "Hide Appointments" : "Show Appointments"}
        </button>
      </div>


      {editMode && (
        <div className="mt-3 px-1 space-y-3">
          <Button
            className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setCreatingNew(true)}
          >
            Add activity <Plus className="size-4 ml-1.5" />
          </Button>

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
        </div>
      )}

      {/* Schedule grid */}
      <div className="mt-3 mx-1 rounded-xl bg-white border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-[44px_1fr_88px_36px] gap-1.5 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-stone-300 bg-stone-50">
          <div className="text-right">Time</div>
          <div>Activity</div>
          <div>Location</div>
          <div className="text-center">Alert</div>
        </div>

        <div ref={listRef} className="relative" style={{ height: totalHeight }}>
          {arrowTop !== null && !editMode && (
            <div
              key={`arrow-${nowAnim}`}
              className={cn(
                "absolute z-30 pointer-events-none -translate-y-1/2",
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
                  className={cn(
                    "absolute inset-0 rounded-md border border-stone-300 bg-white transition-colors",
                    isCurrent && "!border-2 !border-blue-500 !bg-blue-50",
                    isCurrent && nowAnim > 0 && "animate-row-flash",
                  )}
                />
                {Array.from({ length: gridLines }, (_, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute left-1 right-1 border-t border-stone-100"
                    style={{ top: (i + 1) * 5 * PX_PER_MIN }}
                  />
                ))}
                <div className="relative h-full grid grid-cols-[44px_1fr_88px_36px] gap-1.5 items-start pt-1.5 px-2">
                  <div className="text-[11px] tabular-nums leading-tight pl-0.5 pt-0.5">
                    {fmt12(it.start)}
                  </div>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="text-base leading-none shrink-0">{displayIcon}</span>
                    <ScrubText text={displayName} className="text-xs font-medium flex-1 leading-tight" />
                  </div>
                  <div className="flex items-start gap-1 min-w-0">
                    <span className="text-sm leading-none shrink-0">
                      {LOCATION_ICONS[it.location] ?? "📍"}
                    </span>
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


          {/* Appointment overlays — top layer, on top of activity rows */}
          {visibleAppts.map(({ appt: a, top, height }) => {
            const collapsed = allApptsCollapsed || collapsedAppts[a.id];
            if (collapsed) {
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setCollapsedAppts((p) => ({ ...p, [a.id]: false }));
                    setAllApptsCollapsed(false);
                  }}
                  className="absolute left-[4px] right-[4px] z-20 h-1.5 rounded-full bg-green-500 hover:bg-green-600 shadow-[0_2px_6px_-1px_rgba(34,197,94,0.45)] transition-all"
                  style={{ top }}
                  aria-label={`Expand ${a.type}`}
                  title={`${a.type} · ${a.provider}`}
                />
              );
            }
            return (
              <div
                key={a.id}
                className="absolute left-[4px] right-[4px] z-20 rounded-md bg-green-50 border-2 border-green-500 shadow-[0_4px_14px_-2px_rgba(34,197,94,0.35)] overflow-hidden transition-all"
                style={{ top, height }}
              >
                <div className="relative h-full grid grid-cols-[44px_1fr_36px] gap-1.5 px-2 pt-1.5 items-start">
                  <div className="text-[11px] tabular-nums leading-tight text-green-800 pl-0.5 pt-0.5">
                    {fmt12(a.start)}
                  </div>
                  <div className="min-w-0">
                    <ScrubText
                      text={a.type}
                      className="text-xs font-semibold text-green-800 leading-tight"
                    />
                    <div className="text-[10px] italic text-green-700/90 leading-tight truncate">
                      {a.provider}
                    </div>
                    {a.tag && (
                      <div className="mt-0.5 inline-flex items-center rounded-full bg-green-600 text-white text-[9px] uppercase tracking-wide px-1.5 py-px font-semibold">
                        {a.tag}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedAppts((p) => ({ ...p, [a.id]: true }))
                    }
                    className="size-6 grid place-items-center rounded-full text-green-700 hover:bg-green-100"
                    aria-label="Collapse appointment"
                  >
                    <EyeOff className="size-3.5" />
                  </button>
                </div>
              </div>
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

      <PromptDialog
        open={renameOpen}
        title="Rename schedule"
        value={renameValue}
        onChange={setRenameValue}
        onCancel={() => setRenameOpen(false)}
        onSave={() => {
          renameActive(renameValue.trim());
          setRenameOpen(false);
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
        title="Delete schedule?"
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
        title="Delete activity?"
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
        title="Delete appointment?"
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

function PromptDialog({
  open,
  title,
  value,
  placeholder,
  onChange,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
            }}
            className={cn("flex-1 rounded-full px-4", INPUT_BLUE_CLS)}
          />
          <Button
            size="icon"
            className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            onClick={onSave}
            aria-label="Save"
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full border-2 border-stone-200 text-stone-500 hover:bg-stone-100 shrink-0"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [alert, setAlert] = useState<AlertMode>("visual");
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(item?.start ?? "10:00");
      setEnd(item?.end ?? "10:30");
      setActivity(item?.activity ?? ACTIVITIES[0]);
      setCustomName(item?.customName ?? "");
      setCustomIcon(item?.customIcon ?? "✨");
      setLocation(item?.location ?? LOCATIONS[0]);
      setAlert(item?.alert ?? "visual");
      setTimeOpen(false);
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
      alert,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit activity" : "Add activity"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            {!timeOpen ? (
              <button
                type="button"
                onClick={() => setTimeOpen(true)}
                className="mt-1 w-full h-10 rounded-full border-2 border-blue-300 bg-white text-blue-700 px-4 text-sm flex items-center gap-2 hover:bg-blue-50"
              >
                <Clock className="size-4" />
                <span className="tabular-nums">{fmt12(start)} – {fmt12(end)}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-blue-500">Edit</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT_BLUE_CLS} />
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT_BLUE_CLS} />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="rounded-full border-2 border-blue-300 text-blue-700"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a} className={SELECT_ITEM_CLS}>
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
              <SelectTrigger className="rounded-full border-2 border-blue-300 text-blue-700"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l} className={SELECT_ITEM_CLS}>
                    {(LOCATION_ICONS[l] ?? "📍") + " " + l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Alert</Label>
            <div className="flex gap-2 mt-1">
              {(["off", "visual", "audio"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAlert(m)}
                  className={cn(
                    "flex-1 h-9 rounded-full border-2 text-xs capitalize",
                    alert === m
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-blue-300 text-blue-700",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-blue-700">{error}</p>}
        </div>
        <DialogFooter>
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
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(appt?.start ?? "11:00");
      setEnd(appt?.end ?? "11:30");
      setDays(appt?.days ?? ["Mon"]);
      setType(appt?.type ?? APPOINTMENT_TYPES[0]);
      setProvider(appt?.provider ?? "");
      setTimeOpen(false);
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>{appt ? "Edit appointment" : "Add appointment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Time</Label>
            {!timeOpen ? (
              <button
                type="button"
                onClick={() => setTimeOpen(true)}
                className="mt-1 w-full h-10 rounded-full border-2 border-blue-300 bg-white text-blue-700 px-4 text-sm flex items-center gap-2 hover:bg-blue-50"
              >
                <Clock className="size-4" />
                <span className="tabular-nums">{fmt12(start)} – {fmt12(end)}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-blue-500">Edit</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT_BLUE_CLS} />
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT_BLUE_CLS} />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Days</Label>
            <div className="mt-1 flex gap-1">
              {DAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "flex-1 h-9 rounded-full border-2 text-xs",
                      on
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-blue-300 text-blue-700",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-full border-2 border-blue-300 text-blue-700"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className={SELECT_ITEM_CLS}>{t}</SelectItem>
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
          {error && <p className="text-xs text-blue-700">{error}</p>}
        </div>
        <DialogFooter>
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>New schedule</DialogTitle>
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
        <DialogFooter>
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


