import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSettings, type AlarmSoundStyle } from "./SettingsContext";
import { playAlarmSound } from "@/lib/alarmSounds";



export type NotificationKind =
  | "alert-now"
  | "alert-priming"
  | "goal-change"
  | "message"
  | "announcement"
  | "appointment-new"
  | "appointment-cancelled"
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
  autofadeMs?: number;        // undefined = persist until acted on
  allowSnooze?: boolean;      // alerts only
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
  autofadeMs?: number;
  allowSnooze?: boolean;
  sourceRef?: Notification["sourceRef"];
  activityAt?: number;
}

interface NotificationContextValue {
  notifications: Notification[];
  live: Notification[];
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
  activate: (n: Notification) => void;
  prefs: UserPrefs;
}

export function isAlert(kind: NotificationKind) {
  return kind === "alert-now" || kind === "alert-priming";
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
  ];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

const MAX_RETAINED = 50;

export function NotificationProvider({ children, onActivate }: { children: ReactNode; onActivate?: (n: Notification) => void }) {
  const prefs = useUserPrefs();
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const dedupeRef = useRef<Map<string, string>>(new Map()); // dedupeKey -> id
  const onActivateRef = useRef(onActivate);
  useEffect(() => { onActivateRef.current = onActivate; }, [onActivate]);

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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, state: "silenced" } : n)),
    );
  }, []);

  const unsilence = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, state: "live" } : n)),
    );
  }, []);

  const enableChime = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, icon: "bell-chime" } : n)),
    );
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
    const next: Notification = {
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      icon: input.icon,
      createdAt: Date.now(),
      autofadeMs: input.autofadeMs,
      allowSnooze: input.allowSnooze,
      sourceRef: input.sourceRef,
      activityAt: input.activityAt,
      state: "live",
    };
    if (dedupeKey) dedupeRef.current.set(dedupeKey, id);
    setNotifications((prev) => {
      const trimmed = prev.length >= MAX_RETAINED ? prev.slice(prev.length - MAX_RETAINED + 1) : prev;
      return [...trimmed, next];
    });
    // Alert kinds get their own repeating chime for as long as they're
    // visible in the banner (see NotificationBar's own effect, keyed to
    // that row actually being on screen) — this is everything else's only
    // sound, a single chime the moment it's created, using the same
    // Settings-configured alarm style so all notifications share one
    // consistent alarm system rather than some being silent.
    if (!isAlert(input.kind)) {
      playAlarmSound(prefs.alarmSound);
      vibrate(40);
    }
    return id;
  }, [prefs.alarmSound]);

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
            return { ...n, state: "live" as NotificationState, createdAt: now, snoozeUntil: undefined };
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

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, live, push, dismiss, snooze, silence, unsilence, enableChime, archive, clear, clearAll, activate, prefs }),
    [notifications, live, push, dismiss, snooze, silence, unsilence, enableChime, archive, clear, clearAll, activate, prefs],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;

}
