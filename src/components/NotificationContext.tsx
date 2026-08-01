import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSettings, type AlarmSoundStyle } from "./SettingsContext";
import { playAlarmSound, primeAlarmAudio } from "@/lib/alarmSounds";

export type NotificationKind =
  | "alert-now"
  | "alert-priming"
  | "goal-change"
  | "message"
  | "announcement"
  | "appointment-new"
  | "appointment-cancelled"
  | "edit-request"
  | "edit-approved";

export type NotificationState = "live" | "snoozed" | "silenced" | "dismissed" | "archived";

export type NotificationIcon =
  | "bell"
  | "bell-chime"
  | "bell-muted"
  | "target"
  | "message"
  | "megaphone"
  | "edit-request"
  | "edit-approved";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  icon: NotificationIcon;
  createdAt: number;
  autofadeMs?: number; // undefined/null = persist until acted on
  allowSnooze?: boolean; // alerts only
  sourceRef?: { type: "activity" | "goal" | "thread" | "info"; id: string };
  state: NotificationState;
  // internal — when in 'snoozed' state, time at which it should re-fire as live
  snoozeUntil?: number;
  // Absolute epoch ms of the underlying activity/appointment's own start
  // time (alerts only) — lets the banner show a live "In 5 minutes" / "Now"
  // / "3 minutes ago" next to the location that keeps counting as real time
  // passes, instead of a string frozen at whatever it said the moment the
  // alert fired.
  activityAt?: number;
  // Overrides the user's own Settings-configured Default Alarm Sound for
  // this one notification's repeating alarm (see NotificationBar's own
  // activeAlarm effect) — for alerts where the sound needs to stay fixed
  // regardless of what the user picked as their general default (e.g. a
  // routine Timestamp interval check always uses a gentle "chime" rather
  // than whatever louder style the user may have set as their default).
  soundOverride?: AlarmSoundStyle;
  // Present only for a Timestamp card's own "time to check" alert — adds 3
  // extra buttons to the row (scroll-to-card, negative, positive) alongside
  // the standard audio/snooze/dismiss ones. The callbacks close directly
  // over the pushing card's own `score`/scroll-ref, so no separate lookup
  // registry is needed; see NotificationBar's own rendering of this.
  timestampCheck?: {
    positiveLabel: string;
    negativeLabel: string;
    initialStatus: "correct" | "incorrect" | null;
    onScore: (value: "correct" | "incorrect") => void;
    onScrollToCard: () => void;
  };
  // For a notification that's only ever meant to be a fleeting toast (e.g.
  // "you joined X's session") — still shows live/counts toward the tab
  // badge like any other, but NotificationsPane's own persistent history
  // list (which otherwise keeps every notification forever, live or
  // archived, by design) leaves it out rather than cluttering that log with
  // a confirmation nobody needs to look back on later.
  excludeFromHistory?: boolean;
}

interface PushInput {
  // de-duplication key (per day). If a notification with same dedupeKey already
  // exists in non-archived state, push is a no-op. Falls back to id if omitted.
  dedupeKey?: string;
  id?: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  icon: NotificationIcon;
  // Omit to use the kind's own default — see push()'s own resolution: 4s
  // for general (non-alert) notifications, no default at all for alerts
  // (each alert call site already decides its own via Settings' configured
  // notification duration). Pass a number to override that default, or
  // `null` to explicitly opt OUT of it and persist until dismissed
  // regardless of kind — see routes/index.tsx's "Session Unattended" push,
  // the one call site that actually needs this: a technician shouldn't be
  // able to miss a running-but-abandoned session just because its toast
  // auto-dismissed like an ordinary confirmation would.
  autofadeMs?: number | null;
  allowSnooze?: boolean;
  sourceRef?: Notification["sourceRef"];
  activityAt?: number;
  soundOverride?: AlarmSoundStyle;
  timestampCheck?: Notification["timestampCheck"];
  excludeFromHistory?: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  live: Notification[];
  // True while the header's own notification banner (NotificationBar) is
  // genuinely reflowing — a row entering/leaving the visible stack animates
  // that stack's real height (see NOTIFICATION_AREA_TRANSITION), which
  // changes the shared sticky container's real height exactly like the
  // session box's own collapse/expand does. Every layout-tracked sibling
  // below the header (the tab nav, the content pane) needs to fold this in
  // alongside SessionContext's own `headerReflowActive` to give up its
  // `layout="position"` FLIP for that window too, or it fights the banner's
  // real reflow the same way it used to fight the session box's.
  notificationsReflowActive: boolean;
  push: (n: PushInput) => string | null;
  dismiss: (id: string) => void;
  snooze: (id: string, ms?: number) => void;
  silence: (id: string) => void;
  // Reverses silence() — the alarm's own mute button toggles between the
  // two rather than silence being a one-way action (see NotificationBar).
  unsilence: (id: string) => void;
  // Upgrades a visual-only alert (icon "bell") into a chiming one (icon
  // "bell-chime") — the audio button shows (dimmed) even for alerts that
  // weren't originally configured audible, so this lets a user opt one in
  // on the spot instead of the button just being absent.
  enableChime: (id: string) => void;
  archive: (id: string) => void;
  // Distinct from dismiss/archive: those just stop a notification from
  // showing in the transient top banner (see NotificationBar) — it still
  // persists in the Notifications tab's own list either way. clear/clearAll
  // are the only things that actually remove it from that list for good.
  clear: (id: string) => void;
  clearAll: () => void;
  // Looks up a still-tracked notification by its own dedupeKey and clears
  // it outright — used by TimestampCard so scoring an interval directly on
  // the card (not via the alert's own buttons) also retires that interval's
  // now-pointless "time to check" alert, rather than leaving it to sit as
  // dead history in the Notifications tab. A no-op if nothing was ever
  // pushed under that key (e.g. scoring an interval before its alert has
  // even fired) or if it's already been cleared.
  clearByDedupeKey: (dedupeKey: string) => void;
  activate: (n: Notification) => void;
  prefs: UserPrefs;
}

export function isAlert(kind: NotificationKind) {
  return kind === "alert-now" || kind === "alert-priming";
}

// Coarser grouping than NotificationKind itself — used by the Notifications
// tab's own filter chips (see NotificationBar's NotificationsPane), where
// nine individual kinds would read as too many buttons but the four-ish
// categories a technician actually thinks in (alarms, program changes,
// messages, edits) — plus schedule, to give appointment kinds a home too —
// read cleanly.
export type NotificationCategory = "alarms" | "program-changes" | "messages" | "edits" | "schedule";

export const NOTIFICATION_CATEGORIES: { category: NotificationCategory; label: string }[] = [
  { category: "alarms", label: "Alarms" },
  { category: "schedule", label: "Schedule" },
  { category: "program-changes", label: "Program" },
  { category: "messages", label: "Messages" },
  { category: "edits", label: "Edits" },
];

export function categoryForKind(kind: NotificationKind): NotificationCategory {
  switch (kind) {
    case "alert-now":
    case "alert-priming":
      return "alarms";
    case "goal-change":
      return "program-changes";
    case "message":
    case "announcement":
      return "messages";
    case "edit-request":
    case "edit-approved":
      return "edits";
    case "appointment-new":
    case "appointment-cancelled":
      return "schedule";
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* noop */
  }
}

// Reads the user-configurable Settings-tab values (snooze time, notification
// duration, alarm sound) plus a couple of constants not yet worth exposing.
export interface UserPrefs {
  snoozeMs: number;
  notificationDurationMs: number;
  maxStackVisible: number;
  alarmSound: AlarmSoundStyle;
}

export function useUserPrefs(): UserPrefs {
  const { values, alarmSound } = useSettings();
  return {
    snoozeMs: (values.snoozeMinutes ?? 1) * 60_000,
    notificationDurationMs: (values.notificationDurationSeconds ?? 7) * 1000,
    maxStackVisible: 3,
    alarmSound,
  };
}

// Demo seed data so the Notifications tab isn't empty on first load —
// same idea as the static GUARDIANS/VEHICLES arrays elsewhere (ClientInfoPane),
// not something a user action created. Seeded as "archived" (not "live") so
// they show up in the persistent tab list but don't also burst onto screen
// as fresh top-banner alerts, and staggered createdAt timestamps so the
// relative "Xh/Xd ago" stamps read as a real history instead of four
// identical "just now"s.
const HOUR_MS = 60 * 60 * 1000;
function seedNotifications(): Notification[] {
  const now = Date.now();
  return [
    {
      id: "seed-appt-new",
      kind: "appointment-new",
      title: "New Appointment: Dr. Lopez at 11:00 AM on Monday.",
      icon: "bell",
      createdAt: now - 2 * HOUR_MS,
      sourceRef: { type: "activity", id: "ap1" },
      state: "archived",
    },
    {
      id: "seed-appt-cancelled",
      kind: "appointment-cancelled",
      title: "Cancellation: Sam Patel at 1:00 PM on Tuesday.",
      icon: "bell",
      createdAt: now - 5 * HOUR_MS,
      sourceRef: { type: "activity", id: "ap2" },
      state: "archived",
    },
    {
      id: "seed-edit-approved",
      kind: "edit-approved",
      title: 'Edit Approved: "About Me" for Phineas Flynn by Heinz Doofenshmirtz',
      icon: "edit-approved",
      createdAt: now - 24 * HOUR_MS,
      sourceRef: { type: "info", id: "section-about-me" },
      state: "archived",
    },
    {
      id: "seed-goal-change",
      kind: "goal-change",
      title: "Changes: New goal added to Phineas Flynn's treatment plan by Baljeet Tjinder.",
      icon: "target",
      createdAt: now - 48 * HOUR_MS,
      state: "archived",
    },
    {
      id: "seed-goal-phase-change",
      kind: "goal-change",
      title: 'Phase Change: "Requests preferred item" moved from Baseline to Intervention.',
      body: "Updated by Baljeet Tjinder",
      icon: "target",
      createdAt: now - 20 * HOUR_MS,
      sourceRef: { type: "goal", id: "requests-preferred-item" },
      state: "archived",
    },
    {
      id: "seed-goal-graduated",
      kind: "goal-change",
      title: 'Graduated: Phineas has met criteria and graduated from "Follows one-step direction."',
      body: "Marked by Heinz Doofenshmirtz",
      icon: "target",
      createdAt: now - 30 * HOUR_MS,
      sourceRef: { type: "goal", id: "follows-one-step-direction" },
      state: "archived",
    },
    {
      id: "seed-goal-program-update",
      kind: "goal-change",
      title: 'Program Updated: The teaching procedure for "Washing hands" was revised.',
      body: "Updated by Heinz Doofenshmirtz",
      icon: "target",
      createdAt: now - 6 * HOUR_MS,
      sourceRef: { type: "goal", id: "washing-hands" },
      state: "archived",
    },
  ];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

const MAX_RETAINED = 50;

// See push()'s own comment: the default auto-fade for a general (non-alert)
// notification's transient banner toast, when its own call site doesn't
// specify one.
const DEFAULT_GENERAL_AUTOFADE_MS = 4000;

export function NotificationProvider({
  children,
  onActivate,
}: {
  children: ReactNode;
  onActivate?: (n: Notification) => void;
}) {
  const prefs = useUserPrefs();
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const dedupeRef = useRef<Map<string, string>>(new Map()); // dedupeKey -> id
  const onActivateRef = useRef(onActivate);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  // Unlocks alarm audio the moment the user makes ANY first gesture
  // anywhere in the app — long before a real alert has a reason to fire —
  // rather than leaving that first unlock to whatever button happens to get
  // pressed on the first alert itself (see primeAlarmAudio's own comment).
  useEffect(() => {
    const unlock = () => {
      primeAlarmAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const activate = useCallback((n: Notification) => {
    onActivateRef.current?.(n);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, state: "archived" } : x)));
  }, []);

  const archive = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, state: "archived" } : n)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, state: "archived" } : n)));
  }, []);

  // Distinct from dismiss: the notification stays visible (so it's still
  // there to reference or dismiss later), it just stops chiming/vibrating.
  const silence = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, state: "silenced" } : n)));
  }, []);

  const unsilence = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, state: "live" } : n)));
  }, []);

  const enableChime = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, icon: "bell-chime" } : n)));
  }, []);

  const snooze = useCallback(
    (id: string, ms?: number) => {
      const until = Date.now() + (ms ?? prefs.snoozeMs);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, state: "snoozed", snoozeUntil: until } : n)),
      );
    },
    [prefs.snoozeMs],
  );

  // clear/clearAll actually remove from the list — unlike dismiss/archive,
  // which only affect the transient top banner (see that comment on the
  // context value interface above).
  const clear = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    dedupeRef.current.clear();
  }, []);

  const clearByDedupeKey = useCallback(
    (dedupeKey: string) => {
      const id = dedupeRef.current.get(dedupeKey);
      if (id) clear(id);
    },
    [clear],
  );

  const push = useCallback((input: PushInput): string | null => {
    const dedupeKey = input.dedupeKey ?? input.id;
    if (dedupeKey) {
      const existingId = dedupeRef.current.get(dedupeKey);
      if (existingId) {
        let stillLive = false;
        setNotifications((prev) => {
          const found = prev.find((n) => n.id === existingId);
          if (found && found.state !== "archived") stillLive = true;
          return prev;
        });
        if (stillLive) return null;
      }
    }
    const id = input.id ?? `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // General (non-alert) notifications default to a brief 4s auto-fade —
    // a technician glances at the toast, then it clears itself, rather
    // than sitting in the transient banner until manually dismissed.
    // Alerts get no blanket default here; each of their own call sites
    // (ScheduleView) already decides via Settings' configured duration.
    // `null` opts a specific push out of the default entirely.
    const autofadeMs =
      input.autofadeMs === null
        ? undefined
        : (input.autofadeMs ?? (isAlert(input.kind) ? undefined : DEFAULT_GENERAL_AUTOFADE_MS));
    const next: Notification = {
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      icon: input.icon,
      createdAt: Date.now(),
      autofadeMs,
      allowSnooze: input.allowSnooze,
      sourceRef: input.sourceRef,
      activityAt: input.activityAt,
      soundOverride: input.soundOverride,
      timestampCheck: input.timestampCheck,
      excludeFromHistory: input.excludeFromHistory,
      state: "live",
    };
    if (dedupeKey) dedupeRef.current.set(dedupeKey, id);
    setNotifications((prev) => {
      const trimmed =
        prev.length >= MAX_RETAINED ? prev.slice(prev.length - MAX_RETAINED + 1) : prev;
      return [...trimmed, next];
    });
    // Alert kinds get their own repeating chime for as long as they're
    // visible in the banner (see NotificationBar's own effect, keyed to
    // that row actually being on screen), using the Settings-configured
    // alarm style — that preference is specifically about how urgent an
    // actual alarm should sound, not what a routine "phase changed"/"you
    // joined" toast plays. Everything else always gets the short chime
    // style, fixed, regardless of what the user picked as their alarm
    // default.
    if (!isAlert(input.kind)) {
      playAlarmSound("chime");
      vibrate(40);
    }
    return id;
  }, []);

  // Tick: handle autofade expiration + snooze re-fire.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setNotifications((prev) => {
        let changed = false;
        const next = prev.map((n) => {
          if (n.state === "live" && n.autofadeMs) {
            if (now - n.createdAt >= n.autofadeMs) {
              changed = true;
              return { ...n, state: "archived" as NotificationState };
            }
          }
          if (n.state === "snoozed" && n.snoozeUntil && now >= n.snoozeUntil) {
            changed = true;
            return {
              ...n,
              state: "live" as NotificationState,
              createdAt: now,
              snoozeUntil: undefined,
            };
          }
          return n;
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const live = useMemo(
    () => notifications.filter((n) => n.state === "live" || n.state === "silenced"),
    [notifications],
  );

  // True while the header's notification banner is genuinely reflowing —
  // see notificationsReflowActive's own comment on the context value
  // interface above. Tracks the VISIBLE stack's own count (capped at
  // maxStackVisible), not `live.length` directly: going from, say, 4 live
  // notifications to 5 only bumps the "+N more" badge's number, not its
  // size, so that transition doesn't actually reflow anything. Same
  // same-render "adjust during render" pattern SessionContext's own
  // boxHeightAnimating/bannerReflowActive use, for the same reason: an
  // effect would fire one render too late for a sibling whose own
  // conditional rendering reacts in this very render.
  const visibleNotificationCount = Math.min(live.length, prefs.maxStackVisible);
  const prevVisibleNotificationCountRef = useRef(visibleNotificationCount);
  const [notificationsReflowActive, setNotificationsReflowActive] = useState(false);
  if (visibleNotificationCount !== prevVisibleNotificationCountRef.current) {
    prevVisibleNotificationCountRef.current = visibleNotificationCount;
    setNotificationsReflowActive(true);
  }
  useEffect(() => {
    // Matches NotificationBar's own NOTIFICATION_AREA_TRANSITION.duration —
    // kept as a plain number here (not imported) since NotificationBar.tsx
    // already imports FROM this file; importing back would be circular.
    const id = window.setTimeout(() => setNotificationsReflowActive(false), 350);
    return () => window.clearTimeout(id);
  }, [visibleNotificationCount]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      live,
      notificationsReflowActive,
      push,
      dismiss,
      snooze,
      silence,
      unsilence,
      enableChime,
      archive,
      clear,
      clearAll,
      clearByDedupeKey,
      activate,
      prefs,
    }),
    [
      notifications,
      live,
      notificationsReflowActive,
      push,
      dismiss,
      snooze,
      silence,
      unsilence,
      enableChime,
      archive,
      clear,
      clearAll,
      clearByDedupeKey,
      activate,
      prefs,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
