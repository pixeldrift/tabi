import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  ChevronDown,
  Layers,
  Activity,
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

type ScheduleItem = {
  id: string;
  start: string; // "HH:MM" 24h
  end: string;
  activity: string;
  location: string;
  visualAlert: boolean;
  audioAlert: boolean;
};

type Schedule = {
  name: string;
  items: ScheduleItem[];
};

type TreatmentOverlay = {
  id: string;
  label: string;
  start: string;
  end: string;
  color: string; // tailwind text/border tinted
  enabled: boolean;
};

const DAY_START = "10:00";
const DAY_END = "16:00";

const GROUP_A: ScheduleItem[] = [
  { id: "a1", start: "10:00", end: "10:30", activity: "Arrive/Pairing", location: "Treatment Room", visualAlert: true, audioAlert: false },
  { id: "a2", start: "10:30", end: "11:15", activity: "Discreet Trials", location: "Treatment Room", visualAlert: true, audioAlert: true },
  { id: "a3", start: "11:15", end: "11:45", activity: "Gym Time", location: "Big Gym", visualAlert: true, audioAlert: true },
  { id: "a4", start: "11:45", end: "12:15", activity: "Lunch", location: "Kitchen", visualAlert: true, audioAlert: false },
  { id: "a5", start: "12:15", end: "13:00", activity: "Social Group", location: "Classroom", visualAlert: true, audioAlert: true },
  { id: "a6", start: "13:00", end: "13:30", activity: "Sensory Play", location: "Treatment Room", visualAlert: false, audioAlert: false },
  { id: "a7", start: "13:30", end: "14:15", activity: "Arts and Crafts", location: "Classroom", visualAlert: true, audioAlert: false },
  { id: "a8", start: "14:15", end: "14:45", activity: "Snack", location: "Kitchen", visualAlert: true, audioAlert: false },
  { id: "a9", start: "14:45", end: "15:30", activity: "Peer Play", location: "Small Gym", visualAlert: true, audioAlert: true },
  { id: "a10", start: "15:30", end: "16:00", activity: "Pack Up/Dismissal", location: "Treatment Room", visualAlert: true, audioAlert: true },
];

const GROUP_B: ScheduleItem[] = [
  { id: "b1", start: "10:00", end: "10:30", activity: "Arrive/Pairing", location: "Classroom", visualAlert: true, audioAlert: false },
  { id: "b2", start: "10:30", end: "11:15", activity: "Imaginative Play", location: "Classroom", visualAlert: false, audioAlert: false },
  { id: "b3", start: "11:15", end: "12:00", activity: "Discreet Trials", location: "Treatment Room", visualAlert: true, audioAlert: true },
  { id: "b4", start: "12:00", end: "12:30", activity: "Lunch", location: "Kitchen", visualAlert: true, audioAlert: false },
  { id: "b5", start: "12:30", end: "13:15", activity: "Gym Time", location: "Big Gym", visualAlert: true, audioAlert: true },
  { id: "b6", start: "13:15", end: "14:00", activity: "Client Choice", location: "Small Gym", visualAlert: false, audioAlert: false },
  { id: "b7", start: "14:00", end: "14:30", activity: "Snack", location: "Kitchen", visualAlert: true, audioAlert: false },
  { id: "b8", start: "14:30", end: "15:30", activity: "Social Group", location: "Classroom", visualAlert: true, audioAlert: true },
  { id: "b9", start: "15:30", end: "16:00", activity: "Pack Up/Dismissal", location: "Treatment Room", visualAlert: true, audioAlert: true },
];

const PRESETS: Schedule[] = [
  { name: "Group A", items: GROUP_A },
  { name: "Group B", items: GROUP_B },
];

const DEFAULT_OVERLAYS: TreatmentOverlay[] = [
  { id: "speech", label: "Speech", start: "11:00", end: "11:30", color: "bg-violet-100 border-violet-400 text-violet-800", enabled: false },
  { id: "ot", label: "Occupational", start: "13:00", end: "13:45", color: "bg-amber-100 border-amber-400 text-amber-800", enabled: false },
  { id: "pt", label: "Physical", start: "14:30", end: "15:00", color: "bg-emerald-100 border-emerald-400 text-emerald-800", enabled: false },
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

export function ScheduleView() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const [schedules, setSchedules] = useState<Schedule[]>(PRESETS);
  const [activeName, setActiveName] = useState<string>("Group A");
  const active = schedules.find((s) => s.name === activeName) ?? schedules[0];
  const masterName = active.name.startsWith("Custom (")
    ? active.name.slice(8, -1)
    : null;
  const master = masterName ? schedules.find((s) => s.name === masterName) : null;

  const [editMode, setEditMode] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [showMaster, setShowMaster] = useState(false);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [overlaysOpen, setOverlaysOpen] = useState(false);

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const dayStart = toMin(DAY_START);
  const dayEnd = toMin(DAY_END);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const inDay = nowMin >= dayStart && nowMin <= dayEnd;

  // current item by real time
  const currentItem = active.items.find(
    (i) => nowMin >= toMin(i.start) && nowMin < toMin(i.end),
  );

  const updateActive = (mut: (items: ScheduleItem[]) => ScheduleItem[]) => {
    setSchedules((prev) =>
      prev.map((s) => (s.name === activeName ? { ...s, items: mut(s.items) } : s)),
    );
  };

  const saveAsNew = () => {
    const baseName = active.name.replace(/^Custom \(|\)$/g, "");
    const name = `Custom (${baseName})`;
    if (schedules.some((s) => s.name === name)) {
      setActiveName(name);
      return;
    }
    setSchedules((p) => [...p, { name, items: active.items.map((x) => ({ ...x })) }]);
    setActiveName(name);
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

  // For the "now" arrow: position proportionally over the rendered list by
  // measuring item rows and interpolating between rows based on real time.
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
      // Find item containing now; if gap, find nearest neighbors
      const items = active.items;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
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
      // No exact match — interpolate by overall time window
      const ratio = (nowMin - dayStart) / Math.max(1, dayEnd - dayStart);
      setArrowTop(list.clientHeight * ratio);
    };
    update();
    const id = setInterval(update, 5_000);
    const ro = new ResizeObserver(update);
    if (listRef.current) ro.observe(listRef.current);
    return () => {
      clearInterval(id);
      ro.disconnect();
    };
  }, [active, nowMin, inDay, dayStart, dayEnd]);

  return (
    <div className="max-w-3xl mx-auto pt-4 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl leading-tight">{dateStr}</h1>
          <div className="text-xs text-muted-foreground tabular-nums">{numericDate}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl tabular-nums">{timeStr}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {inDay ? "Live" : nowMin < dayStart ? "Before day" : "After day"}
          </div>
        </div>
      </div>

      {/* Schedule selector */}
      <div className="mt-5 flex items-center gap-2 px-1">
        <Select value={activeName} onValueChange={setActiveName}>
          <SelectTrigger className="flex-1 h-11 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
          className="h-11 w-11"
          onClick={() => setEditMode((v) => !v)}
          aria-label="Edit schedule"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={saveAsNew}
          aria-label="Save as new schedule"
          title="Save as new"
        >
          <Save className="size-4" />
        </Button>
      </div>

      {/* Toggles row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-stone-600">
        <button
          type="button"
          onClick={() => setShowThumbs((v) => !v)}
          className="flex items-center gap-1.5 hover:text-stone-900"
        >
          {showThumbs ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          Thumbnails
        </button>
        <button
          type="button"
          onClick={() => setShowMaster((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 hover:text-stone-900",
            showMaster && "text-stone-900",
          )}
          title="Show master schedule behind custom"
        >
          <Layers className="size-3.5" />
          Master behind
        </button>
        <button
          type="button"
          onClick={() => setOverlaysOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 hover:text-stone-900 ml-auto",
            overlays.some((o) => o.enabled) && "text-stone-900",
          )}
        >
          <Activity className="size-3.5" />
          Treatment overlays ({overlays.filter((o) => o.enabled).length})
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
                  {fmt12(o.start)} – {fmt12(o.end)}
                </div>
              </div>
              <Switch
                checked={o.enabled}
                onCheckedChange={(v) =>
                  setOverlays((p) => p.map((x) => (x.id === o.id ? { ...x, enabled: v } : x)))
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Grid header */}
      <div className="mt-4 grid grid-cols-[14px_64px_1fr_88px_64px] gap-2 px-1 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <div />
        <div>Time</div>
        <div>Activity</div>
        <div>Location</div>
        <div className="text-center">Alerts</div>
      </div>

      {/* Schedule grid */}
      <div ref={listRef} className="relative border-t border-stone-200">
        {/* Current-time arrow */}
        {arrowTop !== null && (
          <div
            className="absolute left-0 z-10 pointer-events-none -translate-y-1/2"
            style={{ top: arrowTop }}
          >
            <div className="flex items-center">
              <div className="size-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-red-500" />
              <div className="h-px w-3 bg-red-500/70" />
            </div>
          </div>
        )}

        {active.items.map((it) => {
          const isCurrent = currentItem?.id === it.id;
          const masterMatch = showMaster && master
            ? master.items.find((m) => m.start === it.start)
            : null;
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
                "grid grid-cols-[14px_64px_1fr_88px_64px] gap-2 px-1 py-2.5 border-b border-stone-200 items-center transition-colors",
                isCurrent && "bg-yellow-50",
                overlapOverlay && cn("border-l-4", overlapOverlay.color.split(" ").find((c) => c.startsWith("border-"))),
              )}
            >
              <div />
              <div className="text-[11px] tabular-nums leading-tight">
                <div>{fmt12(it.start)}</div>
                <div className="text-muted-foreground">{fmt12(it.end)}</div>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {showThumbs && (
                  <span className="text-lg shrink-0">{ACTIVITY_ICONS[it.activity] ?? "•"}</span>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.activity}</div>
                  {masterMatch && masterMatch.activity !== it.activity && (
                    <div className="text-[10px] text-stone-400 truncate">
                      master: {masterMatch.activity}
                    </div>
                  )}
                  {overlapOverlay && (
                    <div className={cn("text-[10px] truncate", overlapOverlay.color.split(" ").find((c) => c.startsWith("text-")))}>
                      {overlapOverlay.label} overrides
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                {showThumbs && (
                  <span className="text-sm shrink-0">{LOCATION_ICONS[it.location] ?? "📍"}</span>
                )}
                <span className="text-xs truncate">{it.location}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                {editMode ? (
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
                  <>
                    <AlertToggle
                      on={it.visualAlert}
                      onChange={(v) =>
                        updateActive((items) =>
                          items.map((x) => (x.id === it.id ? { ...x, visualAlert: v } : x)),
                        )
                      }
                      OnIcon={Bell}
                      OffIcon={BellOff}
                    />
                    <AlertToggle
                      on={it.audioAlert}
                      onChange={(v) =>
                        updateActive((items) =>
                          items.map((x) => (x.id === it.id ? { ...x, audioAlert: v } : x)),
                        )
                      }
                      OnIcon={Volume2}
                      OffIcon={VolumeX}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editMode && (
        <div className="mt-3 px-1">
          <Button variant="outline" className="w-full" onClick={() => setCreatingNew(true)}>
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
    </div>
  );
}

function AlertToggle({
  on,
  onChange,
  OnIcon,
  OffIcon,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  OnIcon: typeof Bell;
  OffIcon: typeof BellOff;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "size-7 rounded-full grid place-content-center transition-colors",
        on ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-stone-400 hover:text-stone-600",
      )}
    >
      <Icon className="size-3.5" />
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
  const [visualAlert, setVisualAlert] = useState(true);
  const [audioAlert, setAudioAlert] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(item?.start ?? "10:00");
      setEnd(item?.end ?? "10:30");
      setActivity(item?.activity ?? ACTIVITIES[0]);
      setLocation(item?.location ?? LOCATIONS[0]);
      setVisualAlert(item?.visualAlert ?? true);
      setAudioAlert(item?.audioAlert ?? false);
    }
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
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
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs flex items-center gap-2">
              <Bell className="size-3.5" /> Visual alert
            </Label>
            <Switch checked={visualAlert} onCheckedChange={setVisualAlert} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-2">
              <Volume2 className="size-3.5" /> Audio alert
            </Label>
            <Switch checked={audioAlert} onCheckedChange={setAudioAlert} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onSave({
                id: item?.id ?? `c${Date.now()}`,
                start,
                end,
                activity,
                location,
                visualAlert,
                audioAlert,
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
