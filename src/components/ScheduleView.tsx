import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Bell,
  BellOff,
  BellRing,
  ChevronDown,
  Sun,
  Stethoscope,
  Copy,
  Type,
  Clock,
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

const LOCATIONS = [
  "Treatment Room",
  "Kitchen",
  "Classroom",
  "Big Gym",
  "Small Gym",
] as const;

const ACTIVITIES = [
  "Arrive/Pairing",
  "Sensory Play",
  "Snack",
  "Lunch",
  "Imaginative Play",
  "Social Group",
  "Arts and Crafts",
  "Gym Time",
  "Peer Play",
  "Client Choice",
  "Discreet Trials",
  "Pack Up/Dismissal",
] as const;

const ACTIVITY_ICONS: Record<string, string> = {
  "Arrive/Pairing": "👋",
  "Sensory Play": "🪀",
  "Snack": "🍎",
  "Lunch": "🥪",
  "Imaginative Play": "🦄",
  "Social Group": "👥",
  "Arts and Crafts": "🎨",
  "Gym Time": "🤸",
  "Peer Play": "🧩",
  "Client Choice": "⭐",
  "Discreet Trials": "📋",
  "Pack Up/Dismissal": "🎒",
};

const LOCATION_ICONS: Record<string, string> = {
  "Treatment Room": "🛋️",
  "Kitchen": "🍽️",
  "Classroom": "🏫",
  "Big Gym": "🏟️",
  "Small Gym": "🤾",
};

type AlertMode = "off" | "visual" | "audio";

type ScheduleItem = {
  id: string;
  start: string; // "HH:MM" 24h
  end: string;
  activity: string;
  location: string;
  alert: AlertMode;
};

type Schedule = {
  name: string;
  items: ScheduleItem[];
  baseScheduleName?: string | null;
};

type TreatmentOverlay = {
  id: string;
  label: string;
  start: string;
  end: string;
  color: string;
  enabled: boolean;
};

const DAY_START = "10:00";
const DAY_END = "16:00";

const GROUP_A: ScheduleItem[] = [
  { id: "a1", start: "10:00", end: "10:30", activity: "Arrive/Pairing", location: "Treatment Room", alert: "visual" },
  { id: "a2", start: "10:30", end: "11:15", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "a3", start: "11:15", end: "11:45", activity: "Gym Time", location: "Big Gym", alert: "audio" },
  { id: "a4", start: "11:45", end: "12:15", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "a5", start: "12:15", end: "13:00", activity: "Social Group", location: "Classroom", alert: "audio" },
  { id: "a6", start: "13:00", end: "13:30", activity: "Sensory Play", location: "Treatment Room", alert: "off" },
  { id: "a7", start: "13:30", end: "14:15", activity: "Arts and Crafts", location: "Classroom", alert: "visual" },
  { id: "a8", start: "14:15", end: "14:45", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "a9", start: "14:45", end: "15:30", activity: "Peer Play", location: "Small Gym", alert: "audio" },
  { id: "a10", start: "15:30", end: "16:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const GROUP_B: ScheduleItem[] = [
  { id: "b1", start: "10:00", end: "10:30", activity: "Arrive/Pairing", location: "Classroom", alert: "visual" },
  { id: "b2", start: "10:30", end: "11:15", activity: "Imaginative Play", location: "Classroom", alert: "off" },
  { id: "b3", start: "11:15", end: "12:00", activity: "Discreet Trials", location: "Treatment Room", alert: "audio" },
  { id: "b4", start: "12:00", end: "12:30", activity: "Lunch", location: "Kitchen", alert: "visual" },
  { id: "b5", start: "12:30", end: "13:15", activity: "Gym Time", location: "Big Gym", alert: "audio" },
  { id: "b6", start: "13:15", end: "14:00", activity: "Client Choice", location: "Small Gym", alert: "off" },
  { id: "b7", start: "14:00", end: "14:30", activity: "Snack", location: "Kitchen", alert: "visual" },
  { id: "b8", start: "14:30", end: "15:30", activity: "Social Group", location: "Classroom", alert: "audio" },
  { id: "b9", start: "15:30", end: "16:00", activity: "Pack Up/Dismissal", location: "Treatment Room", alert: "audio" },
];

const PRESETS: Schedule[] = [
  { name: "Group A", items: GROUP_A },
  { name: "Group B", items: GROUP_B },
];

const DEFAULT_OVERLAYS: TreatmentOverlay[] = [
  { id: "speech", label: "Speech Therapy", start: "11:00", end: "11:30", color: "bg-blue-100 border-blue-400 text-blue-800", enabled: false },
  { id: "ot", label: "Occupational Therapy", start: "13:00", end: "13:45", color: "bg-blue-100 border-blue-400 text-blue-800", enabled: false },
  { id: "pt", label: "Physical Therapy", start: "14:30", end: "15:00", color: "bg-blue-100 border-blue-400 text-blue-800", enabled: false },
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

// Demo clock — initialized to a random time inside the schedule window.
function randomDemoTime(): Date {
  const d = new Date();
  const startMin = toMin(DAY_START);
  const endMin = toMin(DAY_END);
  const m = startMin + Math.floor(Math.random() * (endMin - startMin));
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

type MergedRow = ScheduleItem & { fromBase?: boolean };

function mergeWithBase(custom: ScheduleItem[], base: ScheduleItem[] | null): MergedRow[] {
  if (!base) return custom.map((i) => ({ ...i }));
  const result: MergedRow[] = custom.map((i) => ({ ...i }));
  for (const b of base) {
    const bs = toMin(b.start);
    const be = toMin(b.end);
    const conflict = custom.some(
      (c) => toMin(c.start) < be && toMin(c.end) > bs,
    );
    if (!conflict) result.push({ ...b, fromBase: true });
  }
  result.sort((a, b) => toMin(a.start) - toMin(b.start));
  return result;
}

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
  const [activeName, setActiveName] = useState<string>("Group A");
  const active = schedules.find((s) => s.name === activeName) ?? schedules[0];
  const base = active.baseScheduleName
    ? schedules.find((s) => s.name === active.baseScheduleName) ?? null
    : null;

  const [editMode, setEditMode] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [showFullDay, setShowFullDay] = useState(true);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [overlaysOpen, setOverlaysOpen] = useState(false);

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const dayStart = toMin(DAY_START);
  const dayEnd = toMin(DAY_END);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const inDay = nowMin >= dayStart && nowMin <= dayEnd;

  const merged = mergeWithBase(active.items, showFullDay ? base?.items ?? null : null);

  const currentItem = merged.find(
    (i) => nowMin >= toMin(i.start) && nowMin < toMin(i.end),
  );

  const updateActive = (mut: (items: ScheduleItem[]) => ScheduleItem[]) => {
    setSchedules((prev) =>
      prev.map((s) => (s.name === activeName ? { ...s, items: mut(s.items) } : s)),
    );
  };

  const setBaseSchedule = (name: string | null) => {
    setSchedules((prev) =>
      prev.map((s) => (s.name === activeName ? { ...s, baseScheduleName: name } : s)),
    );
  };

  const saveAsCopy = () => {
    const baseName = active.name.replace(/^Custom \(|\)$/g, "");
    let name = `Custom (${baseName})`;
    let n = 2;
    while (schedules.some((s) => s.name === name)) {
      name = `Custom (${baseName}) ${n++}`;
    }
    setSchedules((p) => [...p, { name, items: active.items.map((x) => ({ ...x })) }]);
    setActiveName(name);
  };

  const renameActive = (newName: string) => {
    if (!newName.trim() || schedules.some((s) => s.name === newName)) return;
    setSchedules((p) => p.map((s) => (s.name === activeName ? { ...s, name: newName } : s)));
    setActiveName(newName);
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

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const list = listRef.current;
      if (!list) return setArrowTop(null);
      if (!inDay) {
        setArrowTop(nowMin < dayStart ? 0 : list.clientHeight);
        return;
      }
      const listTop = list.getBoundingClientRect().top;
      for (let i = 0; i < merged.length; i++) {
        const it = merged[i];
        const s = toMin(it.start);
        const e = toMin(it.end);
        const el = rowRefs.current.get(it.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (nowMin >= s && nowMin <= e) {
          const ratio = (nowMin - s) / Math.max(1, e - s);
          setArrowTop(r.top - listTop + r.height * ratio);
          return;
        }
      }
      const ratio = (nowMin - dayStart) / Math.max(1, dayEnd - dayStart);
      setArrowTop(list.clientHeight * ratio);
    };
    update();
    const ro = new ResizeObserver(update);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [merged, nowMin, inDay, dayStart, dayEnd]);

  const otherSchedules = schedules.filter((s) => s.name !== activeName);

  return (
    <div className="max-w-3xl mx-auto pt-1 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl leading-tight">{dateStr}</h1>
          <div className="text-xs text-muted-foreground tabular-nums">{numericDate}</div>
        </div>
        <button
          type="button"
          onClick={bumpTime}
          className="text-right rounded-md px-1 -mr-1 active:bg-stone-100"
          title="Tap to advance 10 minutes (demo)"
        >
          <div className="font-display text-xl tabular-nums">{timeStr}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {inDay ? "Live" : nowMin < dayStart ? "Before day" : "After day"}
          </div>
        </button>
      </div>

      {/* Schedule selector */}
      <div className="mt-4 flex items-center gap-2 px-1">
        <Select value={activeName} onValueChange={setActiveName}>
          <SelectTrigger className="flex-1 h-11 text-base rounded-full bg-white border-2 border-blue-500 text-blue-700 px-4 focus:ring-blue-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {schedules.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={editMode ? "default" : "outline"}
          size="icon"
          className={cn(
            "h-11 w-11 rounded-full border-2",
            editMode
              ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
              : "bg-white border-blue-500 text-blue-600 hover:bg-blue-50",
          )}
          onClick={() => setEditMode((v) => !v)}
          aria-label="Edit schedule"
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {editMode && (
        <div className="mt-2 space-y-2 px-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={saveAsCopy}
            >
              <Copy className="size-3.5 mr-1.5" /> Save copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => {
                setRenameValue(active.name);
                setRenameOpen(true);
              }}
            >
              <Type className="size-3.5 mr-1.5" /> Rename
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-stone-600 shrink-0">Base schedule</Label>
            <Select
              value={active.baseScheduleName ?? "__none__"}
              onValueChange={(v) => setBaseSchedule(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-9 rounded-full bg-white border-2 border-blue-500 text-blue-700 px-3 text-sm focus:ring-blue-300">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="__none__">None</SelectItem>
                {otherSchedules.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Toggles row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs">
        <button
          type="button"
          onClick={() => setShowThumbs((v) => !v)}
          className={cn(
            "flex items-center gap-1.5",
            showThumbs ? "text-blue-600" : "text-stone-400 hover:text-stone-600",
          )}
        >
          <Eye className="size-3.5" />
          Thumbnails
        </button>
        <button
          type="button"
          onClick={() => setShowFullDay((v) => !v)}
          className={cn(
            "flex items-center gap-1.5",
            showFullDay ? "text-blue-600" : "text-stone-400 hover:text-stone-600",
          )}
          title="Show base (full day) schedule behind custom"
        >
          <Sun className="size-3.5" />
          Full Day
        </button>
        <button
          type="button"
          onClick={() => setOverlaysOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 ml-auto",
            overlays.some((o) => o.enabled) ? "text-blue-600" : "text-stone-400 hover:text-stone-600",
          )}
        >
          <Stethoscope className="size-3.5" />
          Appointments ({overlays.filter((o) => o.enabled).length})
          <ChevronDown className={cn("size-3 transition-transform", overlaysOpen && "rotate-180")} />
        </button>
      </div>

      {overlaysOpen && (
        <div className="mt-2 mx-1 rounded-lg border border-stone-200 bg-white p-3 space-y-2">
          {overlays.map((o) => (
            <div key={o.id} className="flex items-center gap-3">
              <div className={cn("size-3 rounded-full border", o.color)} />
              <div className="flex-1 text-sm">
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">
                  {`${fmt12(o.start)} – ${fmt12(o.end)}`}
                </div>
              </div>
              <Switch
                checked={o.enabled}
                onCheckedChange={(v) =>
                  setOverlays((p) => p.map((x) => (x.id === o.id ? { ...x, enabled: v } : x)))
                }
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-white border-2 border-blue-500 [&>span]:data-[state=checked]:bg-white [&>span]:data-[state=unchecked]:bg-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      {/* Schedule grid */}
      <div className="mt-3 mx-1 rounded-xl bg-white border border-stone-200 overflow-visible">
        {/* header */}
        <div className="grid grid-cols-[44px_1fr_88px_36px] gap-1.5 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-stone-300 bg-stone-50 rounded-t-xl">
          <div>Time</div>
          <div>Activity</div>
          <div>Location</div>
          <div className="text-center">Alert</div>
        </div>

        <div ref={listRef} className="relative">
          {arrowTop !== null && (
            <div
              className="absolute z-20 pointer-events-none -translate-y-1/2"
              style={{ top: arrowTop, left: -8 }}
              aria-hidden
            >
              <svg
                width="20"
                height="18"
                viewBox="0 0 20 18"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
              >
                <path
                  d="M2 3 Q2 1 4 2 L17 8 Q19 9 17 10 L4 16 Q2 17 2 15 Z"
                  fill="#2563eb"
                />
              </svg>
            </div>
          )}

          {merged.map((it, idx) => {
            const isCurrent = currentItem?.id === it.id;
            const overlapOverlay = overlays.find(
              (o) =>
                o.enabled &&
                toMin(o.start) < toMin(it.end) &&
                toMin(o.end) > toMin(it.start),
            );
            return (
              <div
                key={it.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(it.id, el);
                  else rowRefs.current.delete(it.id);
                }}
                className={cn(
                  "grid grid-cols-[44px_1fr_88px_36px] gap-1.5 px-2 py-1.5 items-center transition-colors",
                  idx !== merged.length - 1 && "border-b border-stone-300",
                  isCurrent && "bg-blue-50",
                  it.fromBase && "opacity-50",
                  overlapOverlay && cn(
                    "border-l-4",
                    overlapOverlay.color.split(" ").find((c) => c.startsWith("border-")),
                  ),
                )}
              >
                <div className="text-[11px] tabular-nums leading-tight pl-0.5">
                  {fmt12(it.start)}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  {showThumbs && (
                    <span className="text-base shrink-0">{ACTIVITY_ICONS[it.activity] ?? "•"}</span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{it.activity}</div>
                    {overlapOverlay && (
                      <div className={cn("text-[10px] truncate", overlapOverlay.color.split(" ").find((c) => c.startsWith("text-")))}>
                        {overlapOverlay.label}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  {showThumbs && (
                    <span className="text-sm shrink-0">{LOCATION_ICONS[it.location] ?? "📍"}</span>
                  )}
                  <span className="text-xs truncate">{it.location}</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  {editMode && !it.fromBase ? (
                    <>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(it)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-red-600 hover:text-red-700"
                        onClick={() => updateActive((items) => items.filter((x) => x.id !== it.id))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <AlertCycle
                      mode={it.alert}
                      onChange={(m) =>
                        updateActive((items) =>
                          items.map((x) => (x.id === it.id ? { ...x, alert: m } : x)),
                        )
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editMode && (
        <div className="mt-3 px-1">
          <Button
            variant="outline"
            className="w-full rounded-full border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => setCreatingNew(true)}
          >
            <Plus className="size-4 mr-1" /> Add item
          </Button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Future: global chimes every 15 minutes.
          </p>
        </div>
      )}

      <ItemDialog
        open={!!editing || creatingNew}
        item={editing}
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-stone-200">
          <DialogHeader>
            <DialogTitle>Rename schedule</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                renameActive(renameValue.trim());
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ItemDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: ScheduleItem | null;
  onClose: () => void;
  onSave: (i: ScheduleItem) => void;
}) {
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("10:30");
  const [activity, setActivity] = useState<string>(ACTIVITIES[0]);
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [alert, setAlert] = useState<AlertMode>("visual");
  const [timeOpen, setTimeOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(item?.start ?? "10:00");
      setEnd(item?.end ?? "10:30");
      setActivity(item?.activity ?? ACTIVITIES[0]);
      setLocation(item?.location ?? LOCATIONS[0]);
      setAlert(item?.alert ?? "visual");
      setTimeOpen(false);
    }
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl border-stone-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
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
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="rounded-full border-2 border-blue-300 text-blue-700"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {(ACTIVITY_ICONS[a] ?? "•") + " " + a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="rounded-full border-2 border-blue-300 text-blue-700"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
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
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700"
            onClick={() =>
              onSave({
                id: item?.id ?? `c${Date.now()}`,
                start,
                end,
                activity,
                location,
                alert,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
