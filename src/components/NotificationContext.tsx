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
import { useTour } from "./TourContext";
import { useTip } from "./TipContext";
import { useSession, CURRENT_STAFF_ID } from "./SessionContext";

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
  // Push directly into "archived" instead of "live" — skips the transient
  // top banner (and its chime/vibrate) entirely, landing straight in the
  // Notifications tab as history. Used for alerts that fire while nobody's
  // actually in a running session to receive them (see ScheduleView's own
  // alert-firing effect and TimestampCard's "time to check" push) — an
  // interruption nobody's there to act on isn't useful; the tab is where it
  // belongs instead. Defaults to true (the normal, interactive, live case).
  live?: boolean;
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
  // NotificationProvider sits inside both TourProvider and TipProvider (see
  // routes/index.tsx), so it can read this directly rather than routing a
  // prop down. A push that lands while either overlay owns the screen, or
  // while a fresh session start or join is still actively handing off (see
  // `sessionJustStarted`/`justJoined` below), is nobody's-there-to-act-on-it
  // in exactly the same sense as an alert firing with no one in the running
  // session (see push()'s own `live`
  // resolution below) — same treatment: straight into "archived," no
  // banner popping the layout out from under the tour/tip spotlight, no
  // chime competing with it, still fully present in the Notifications tab.
  const { active: tourActive } = useTour();
  const { active: tipActive } = useTip();
  // SessionContext sits above this provider (see routes/index.tsx's own
  // nesting), so it's safe to read directly here rather than needing a
  // bridging child component the way pushing FROM session events does (see
  // GoalChangeDemoTrigger/SessionActivityTrigger's own comments on that
  // one-way constraint). `resetSignal` — not `status` — is what actually
  // means "a genuinely fresh session," same reasoning as those two
  // triggers': it bumps once per real start-new, not on every pause/resume
  // in between.
  const { resetSignal, status, isSessionMine, startedById, boxCollapsed } = useSession();
  // Cleared the instant `boxCollapsed` actually goes true — the real
  // completion signal for the box->pill handoff, not a guessed duration.
  // A flat timeout here used to drift out of sync with the real transition
  // (start-new/join's own box-collapse delay is DIGIT_SETTLE_MS +
  // HEADER_MORPH_MS, scaled by SESSION_TRANSITION_SPEED — nothing in this
  // file tracked that, so a short flat constant let anything queued in the
  // gap between "suppression expired" and "the box actually finished
  // collapsing" chime audibly mid-transition), and there's no reason to
  // reinvent that duration here when the same boolean SessionActivityTrigger
  // already waits on for its own "You joined X's session" push is right
  // there to read directly.
  const [sessionJustStarted, setSessionJustStarted] = useState(false);
  const prevResetSignalRef = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal === prevResetSignalRef.current) return;
    prevResetSignalRef.current = resetSignal;
    setSessionJustStarted(true);
  }, [resetSignal]);
  useEffect(() => {
    if (sessionJustStarted && boxCollapsed) setSessionJustStarted(false);
  }, [sessionJustStarted, boxCollapsed]);
  // Same treatment for joining someone else's already-running session —
  // same handoff-in-progress reasoning, just a different trigger than a
  // fresh start (no resetSignal bump on a join, see its own comment in
  // SessionContext). Same detection SessionActivityTrigger already uses for
  // its own "You joined X's session" push (routes/index.tsx) — recomputed
  // here rather than threaded through, since this only needs the boolean's
  // own rising edge, not anything that component pushes.
  const joinedSomeoneElse =
    status === "running" && isSessionMine && !!startedById && startedById !== CURRENT_STAFF_ID;
  const [justJoined, setJustJoined] = useState(false);
  const prevJoinedRef = useRef(joinedSomeoneElse);
  useEffect(() => {
    if (joinedSomeoneElse === prevJoinedRef.current) return;
    prevJoinedRef.current = joinedSomeoneElse;
    if (!joinedSomeoneElse) {
      setJustJoined(false);
      return;
    }
    setJustJoined(true);
  }, [joinedSomeoneElse]);
  useEffect(() => {
    if (justJoined && boxCollapsed) setJustJoined(false);
  }, [justJoined, boxCollapsed]);
  const notificationsSuppressed = tourActive || tipActive || sessionJustStarted || justJoined;
  const onActivateRef = useRef(onActivate);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  // Unlocks alarm audio the moment the user makes ANY first gesture
  // anywhere in the app — long before a real alert has a reason to fire —
  // rather than leaving that first unlock to whatever button happens to get
  // pressed on the first alert itself (see primeAlarmAudio's own comment).
  // Only "chime" (every routine push's own fixed style, see push()'s own
  // comment) and the user's actually-configured alarmSound preference need
  // priming — not every style that exists, which would just be more silent-
  // but-real `.play()` calls than this moment (usually the very first tap
  // in the whole app) needs.
  const alarmSoundRef = useRef(prefs.alarmSound);
  alarmSoundRef.current = prefs.alarmSound;
  useEffect(() => {
    const unlock = () => {
      primeAlarmAudio(["chime", alarmSoundRef.current]);
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

  const push = useCallback(
    (input: PushInput): string | null => {
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
      // A tour/tip in progress collapses to the exact same "nobody's there to
      // act on it" case a running-but-unattended session already handles —
      // see the `live` prop's own doc comment above.
      const live = input.live !== false && !notificationsSuppressed;
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
        state: live ? "live" : "archived",
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
      // default. Neither applies to one pushed straight into "archived" —
      // there's no banner row for it to chime/vibrate alongside.
      if (live && !isAlert(input.kind)) {
        playAlarmSound("chime");
        vibrate(40);
      }
      return id;
    },
    [notificationsSuppressed],
  );

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

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      live,
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
