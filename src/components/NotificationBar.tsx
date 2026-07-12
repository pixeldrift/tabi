import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate, type MotionStyle } from "motion/react";
import { Bell, BellRing, BellOff, Target, MessageSquare, Megaphone, X, Volume2, VolumeX, ArrowRight } from "lucide-react";
import { useNotifications, isAlert, vibrate, type Notification, type NotificationIcon, type NotificationKind } from "./NotificationContext";
import { playAlarmSound } from "@/lib/alarmSounds";
import { RequestEditIcon } from "./icons/RequestEditIcon";
import { ApproveEditIcon } from "./icons/ApproveEditIcon";
import { cn } from "@/lib/utils";

// Swipe tuning — TODO: surface in user settings.
const SWIPE_THRESHOLD_PX = 88;
const SWIPE_SPRING_STIFFNESS = 400;
const SWIPE_SPRING_DAMPING = 30;

// Shared with the tabs nav's own `layout` transition in StatusBar.tsx, so
// the notification area's push/collapse and the tabs/pane moving to make
// room for it read as one attached unit rather than two independent motions.
export const NOTIFICATION_AREA_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

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

const ICON_MAP: Record<NotificationIcon, ComponentType<{ className?: string }>> = {
  bell: Bell,
  "bell-chime": BellRing,
  "bell-muted": BellOff,
  target: Target,
  message: MessageSquare,
  megaphone: Megaphone,
  "edit-request": RequestEditIcon,
  "edit-approved": ApproveEditIcon,
};

// Tint per kind — semantic-ish colors using existing palette. `button` matches
// the same hue as `ring`/`iconFg` so a row's action buttons read as part of
// the same alert, not a generic fixed blue/gray.
const KIND_STYLES: Record<NotificationKind, { ring: string; iconFg: string; accent: string; button: string }> = {
  "alert-now": {
    ring: "border-red-300 bg-red-50",
    iconFg: "text-red-700",
    accent: "bg-red-500",
    button: "bg-red-500 hover:bg-red-600 active:bg-red-700",
  },
  "alert-priming": {
    ring: "border-amber-300 bg-amber-50",
    iconFg: "text-amber-700",
    accent: "bg-amber-500",
    button: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
  },
  "goal-change": {
    ring: "border-blue-300 bg-blue-50",
    iconFg: "text-blue-700",
    accent: "bg-blue-500",
    button: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
  },
  message: {
    ring: "border-emerald-300 bg-emerald-50",
    iconFg: "text-emerald-700",
    accent: "bg-emerald-500",
    button: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700",
  },
  announcement: {
    ring: "border-violet-300 bg-violet-50",
    iconFg: "text-violet-700",
    accent: "bg-violet-500",
    button: "bg-violet-500 hover:bg-violet-600 active:bg-violet-700",
  },
  "appointment-new": {
    ring: "border-teal-300 bg-teal-50",
    iconFg: "text-teal-700",
    accent: "bg-teal-500",
    button: "bg-teal-500 hover:bg-teal-600 active:bg-teal-700",
  },
  "appointment-cancelled": {
    ring: "border-rose-300 bg-rose-50",
    iconFg: "text-rose-700",
    accent: "bg-rose-500",
    button: "bg-rose-500 hover:bg-rose-600 active:bg-rose-700",
  },
  "edit-approved": {
    ring: "border-indigo-300 bg-indigo-50",
    iconFg: "text-indigo-700",
    accent: "bg-indigo-500",
    button: "bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700",
  },
};

// Every person a notification title might mention — matched literally
// (not derived from StaffDirectory/ClientInfoPane's own records) since this
// is just cosmetic highlighting, not a data dependency. Kept as one flat
// list here rather than importing each source file's own roster, to avoid
// coupling this purely-visual concern to wherever those happen to live.
const KNOWN_NAMES = [
  "Phineas Flynn",
  "Linda Flynn-Fletcher",
  "Lawrence Fletcher",
  "Heinz Doofenshmirtz",
  "Perry Plat",
  "Isabella Garcia-Shapiro",
  "Baljeet Tjinder",
  "Vanessa Doofenshmirtz",
  "Jeremy Johnson",
];
const NAME_PATTERN = new RegExp(
  `(${KNOWN_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

// A title's own "Category: rest of it" shape (every kind uses this, from
// the seeded examples to Request Edit's own "Edit requested: <field>")
// only bolds the category, not the whole line — and any known person's
// name within the remainder reads as a plain italic blue mention instead
// of a full interactive PersonPill, since a notification title isn't a
// place to open someone's contact menu.
function NotificationTitle({ title, className }: { title: string; className?: string }) {
  const colonIdx = title.indexOf(":");
  const label = colonIdx === -1 ? title : title.slice(0, colonIdx + 1);
  const rest = colonIdx === -1 ? "" : title.slice(colonIdx + 1);
  return (
    <span className={className}>
      <span className="font-semibold">{label}</span>
      {rest.split(NAME_PATTERN).map((part, i) =>
        KNOWN_NAMES.includes(part) ? (
          <span key={i} className="italic text-blue-600">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function NotificationBar() {
  const { live, dismiss, snooze, silence, unsilence, activate } = useNotifications();
  const { prefs } = useNotifications();

  // Newest on top — show up to maxStackVisible.
  const ordered = [...live].sort((a, b) => b.createdAt - a.createdAt);
  const visible = ordered.slice(0, prefs.maxStackVisible);
  const overflow = ordered.length - visible.length;

  // Only one alarm audibly plays at a time. Each chime-capable alert still
  // ticks/vibrates independently (see NotificationRow's own effect), but
  // the actual repeating sound is owned by whichever eligible (live, not
  // silenced) one has been waiting longest — muting the current owner or
  // dismissing it hands the shared "audio slot" to the next-oldest one
  // instead of everything going quiet.
  const chiming = live.filter((n) => isAlert(n.kind) && n.icon === "bell-chime" && n.state === "live");
  const activeAlarm = chiming.reduce<Notification | null>(
    (oldest, n) => (!oldest || n.createdAt < oldest.createdAt ? n : oldest),
    null,
  );
  useEffect(() => {
    if (!activeAlarm) return;
    playAlarmSound(prefs.alarmSound);
    const id = window.setInterval(() => playAlarmSound(prefs.alarmSound), 2000);
    return () => window.clearInterval(id);
  }, [activeAlarm?.id, prefs.alarmSound]);

  // Drives the live "In 5 minutes" / "Now" / "3 minutes ago" label next to
  // an alert's location (see formatActivityRelativeTime) — coarse enough
  // that a single shared interval for the whole stack is plenty, rather
  // than every row running its own.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    // Full viewport width (not the centered max-w column) so a row has room
    // to actually slide off the edge of the screen when dragged/committed,
    // instead of getting clipped by a narrow centered container. The top
    // padding only applies when there's actually a notification to show —
    // otherwise this wrapper still rendered an unconditional 8px gap
    // between the header above and the tabs row below with nothing in it.
    <div
      className={cn(
        "px-3 overflow-x-hidden pointer-events-none ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen",
        visible.length > 0 && "pt-2",
      )}
    >
      <motion.div layout transition={{ layout: NOTIFICATION_AREA_TRANSITION }} className="max-w-2xl mx-auto flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              nowMs={nowMs}
              onActivate={() => activate(n)}
              onDismiss={() => dismiss(n.id)}
              onSnooze={() => snooze(n.id)}
              onSilence={() => silence(n.id)}
              onUnsilence={() => unsilence(n.id)}
            />
          ))}
          {overflow > 0 && (
            <motion.div
              key="overflow"
              layout
              transition={{ layout: NOTIFICATION_AREA_TRANSITION }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pointer-events-auto self-center rounded-full bg-stone-700/90 text-white text-xs px-2.5 py-0.5"
            >
              +{overflow} more
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function NotificationRow({
  n,
  nowMs,
  onActivate,
  onDismiss,
  onSnooze,
  onSilence,
  onUnsilence,
}: {
  n: Notification;
  nowMs: number;
  onActivate: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onSilence: () => void;
  onUnsilence: () => void;
}) {
  const silenced = n.state === "silenced";
  // Once silenced the row stays but reads as muted, regardless of the
  // notification's own stored icon (which is what drives the chime).
  const Icon = silenced ? BellOff : ICON_MAP[n.icon];
  const styles = KIND_STYLES[n.kind];
  const alert = isAlert(n.kind);
  const showSnooze = alert && n.allowSnooze;
  const hasChime = n.icon === "bell-chime" && !silenced;
  // Whether this alert HAS a chime at all — unlike hasChime, doesn't drop
  // out once silenced, so the mute button stays put as a toggle instead of
  // vanishing the moment it's pressed (see the RowButton below).
  const isChimeCapable = n.icon === "bell-chime";
  const showSilence = alert && isChimeCapable;
  const canSwipeRight = showSnooze || showSilence;
  const rightAction = showSnooze ? onSnooze : showSilence ? (silenced ? onUnsilence : onSilence) : undefined;

  // Vibrate every 2s while an alert with chime is visible — the actual
  // repeating alarm SOUND is owned centrally (see NotificationBar), so at
  // most one plays at a time even with several chiming alerts on screen.
  useEffect(() => {
    if (!alert || !hasChime) return;
    vibrate(n.kind === "alert-now" ? [60, 40, 60] : 50);
    const id = window.setInterval(() => {
      vibrate(n.kind === "alert-now" ? [60, 40, 60] : 50);
    }, 2000);
    return () => window.clearInterval(id);
  }, [alert, hasChime, n.kind]);

  const relativeTime = n.activityAt != null ? formatActivityRelativeTime(n.activityAt, nowMs) : null;

  const threshold = SWIPE_THRESHOLD_PX;
  const dragX = useMotionValue(0);
  const wasDragging = useRef(false);
  // The bubble itself fades out as it clears the threshold, so it's already
  // invisible well before the (larger) offscreen travel finishes.
  const bubbleOpacity = useTransform(dragX, [-threshold * 2.5, -threshold, 0, threshold, threshold * 2.5], [0, 1, 1, 1, 0]);

  // Three points: home (dragX 0, everything full size), and a trigger point
  // in each direction where only that direction's action stays — everything
  // else recedes to 0 by the time you reach it, so the row buttons visually
  // narrow down to just the one about to fire.
  const rightIsSnooze = showSnooze;
  const rightIsSilence = !showSnooze && showSilence;
  const dismissOpacity = useTransform(dragX, [-threshold, 0, threshold], [1, 1, 0]);
  const dismissScale = useTransform(dragX, [-threshold, 0, threshold], [1, 1, 0.5]);
  const snoozeOpacity = useTransform(dragX, [-threshold, 0, threshold], [0, 1, rightIsSnooze ? 1 : 0]);
  const snoozeScale = useTransform(dragX, [-threshold, 0, threshold], [0.5, 1, rightIsSnooze ? 1 : 0.5]);
  const silenceOpacity = useTransform(dragX, [-threshold, 0, threshold], [0, 1, rightIsSilence ? 1 : 0]);
  const silenceScale = useTransform(dragX, [-threshold, 0, threshold], [0.5, 1, rightIsSilence ? 1 : 0.5]);
  const openOpacity = useTransform(dragX, [-threshold, 0, threshold], [0, 1, 0]);
  const openScale = useTransform(dragX, [-threshold, 0, threshold], [0.5, 1, 0.5]);

  // Shared by both a completed drag-past-threshold and a direct button tap —
  // either way the row should fling off in the matching direction the same
  // way, continuing from wherever it currently sits (0 for a tap) rather than
  // a button-tap just teleporting the row away with a plain fade.
  const commit = (direction: 1 | -1, action: () => void, velocity = 0) => {
    const val = dragX.get();
    const target = direction * 500;
    const remaining = target - val;
    const fastFlick = Math.abs(velocity) > 800;
    animate(dragX, target, {
      type: "tween",
      ease: "easeIn",
      duration: fastFlick ? 0.12 : Math.min(0.28, Math.max(0.16, Math.abs(remaining) / 1400)),
    }).then(action);
  };

  // Silencing doesn't remove the notification from the list (it stays,
  // just muted — see NotificationContext's silence()), so unlike the other
  // actions the row must settle back to its resting position instead of
  // flinging off: committing it off-screen left the row's own content gone
  // but its action-button layer (which isn't part of the draggable bubble,
  // and clamps to full opacity past the drag threshold) stranded in view.
  const silenceInPlace = (action: () => void) => {
    action();
    animate(dragX, 0, {
      type: "spring",
      stiffness: SWIPE_SPRING_STIFFNESS,
      damping: SWIPE_SPRING_DAMPING,
    });
  };

  const handleDragEnd = (_e: unknown, info: { velocity: { x: number } }) => {
    const val = dragX.get();
    const vx = info.velocity.x;
    const commitLeft = val <= -threshold;
    const commitRight = val >= threshold && !!rightAction;
    if (commitLeft) {
      commit(-1, onDismiss, vx);
    } else if (commitRight) {
      if (rightIsSilence) {
        silenceInPlace(rightAction!);
      } else {
        commit(1, rightAction!, vx);
      }
    } else {
      animate(dragX, 0, {
        type: "spring",
        velocity: vx,
        stiffness: SWIPE_SPRING_STIFFNESS,
        damping: SWIPE_SPRING_DAMPING,
      });
    }
    window.setTimeout(() => { wasDragging.current = false; }, 80);
  };

  return (
    <motion.div
      layout
      // The area's own push/collapse (a plain ease, matched to the tabs
      // nav's layout transition) is kept separate from the bar's entrance
      // (a bouncier spring): starting a little low and popping up into
      // place reads as emerging from behind the tabs/pane as they make
      // room, rather than sliding in from above them.
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
      transition={{
        layout: NOTIFICATION_AREA_TRANSITION,
        default: { type: "spring", stiffness: 420, damping: 20 },
      }}
      className="pointer-events-auto relative"
    >
      <motion.div
        drag="x"
        dragConstraints={
          canSwipeRight
            ? { left: -threshold * 1.4, right: threshold * 1.4 }
            : { left: -threshold * 1.4, right: 0 }
        }
        dragElastic={0.15}
        dragMomentum={false}
        style={{ x: dragX, opacity: bubbleOpacity }}
        onDragStart={() => { wasDragging.current = true; }}
        onDragEnd={handleDragEnd}
        className={cn("relative rounded-full border shadow-sm", styles.ring)}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (!wasDragging.current) onActivate(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(); } }}
          className="w-full flex items-center gap-3 pl-3 pr-24 py-1.5 text-left cursor-pointer"
        >
          <div
            className={cn(
              "flex items-center justify-center size-7 shrink-0",
              styles.iconFg,
              // animate-bounce's arc sits above the resting baseline, which
              // reads as off-center within this box — nudged down so its
              // resting position looks vertically centered.
              !silenced && n.kind === "alert-now" && "animate-bounce translate-y-0.5",
              !silenced && n.kind === "alert-priming" && "animate-pulse",
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <NotificationTitle title={n.title} className="block text-sm text-stone-900 truncate" />
            {n.body && (
              <div className="text-xs text-stone-600 truncate">
                {n.body}
                {relativeTime && (
                  <>
                    {" · "}
                    <span className="font-semibold">{relativeTime}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Action buttons sit fixed in place — NOT part of the draggable
          bubble above — so they read as a stable preview of "what will
          happen" that shrinks away rather than something that slides off
          with the gesture. */}
      <div
        className="absolute inset-y-0 right-2 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {alert ? (
          <>
            {showSilence && (
              <RowButton
                label={silenced ? "Unmute alarm" : "Mute alarm"}
                colorClass={styles.button}
                style={{ opacity: silenceOpacity, scale: silenceScale }}
                onClick={() => silenceInPlace(silenced ? onUnsilence : onSilence)}
              >
                {/* Crossfades rather than swapping instantly — a toggle, not
                    a one-shot action, so it needs to read as flipping a
                    state rather than the button itself changing identity. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={silenced ? "muted" : "unmuted"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid"
                  >
                    {silenced ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </motion.span>
                </AnimatePresence>
              </RowButton>
            )}
            {showSnooze && (
              <RowButton label="Snooze" colorClass={styles.button} style={{ opacity: snoozeOpacity, scale: snoozeScale }} onClick={() => commit(1, onSnooze)}>
                <ZzIcon className="size-4" />
              </RowButton>
            )}
          </>
        ) : (
          <RowButton label="Open" colorClass={styles.button} style={{ opacity: openOpacity, scale: openScale }} onClick={() => commit(1, onActivate)}>
            <ArrowRight className="size-4" />
          </RowButton>
        )}
        <RowButton label="Dismiss" colorClass={styles.button} style={{ opacity: dismissOpacity, scale: dismissScale }} onClick={() => commit(-1, onDismiss)}>
          <X className="size-4" />
        </RowButton>
      </div>
    </motion.div>
  );
}

// Full persistent history — unlike the transient banner above (which only
// ever shows `live`, and whose own dismiss/snooze/silence actions merely
// stop a row from chiming/showing up there), this renders every
// notification regardless of state and only drops one when the user hits
// Clear here. That's the "persists until explicitly cleared" half of the
// notification system; auto-expiring old ones after some duration is
// still just a roadmap idea (see README) — not built yet.
export function NotificationsPane() {
  const { notifications, clear, clearAll, activate } = useNotifications();
  const ordered = [...notifications].sort((a, b) => b.createdAt - a.createdAt);

  if (ordered.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <h2 className="font-display text-xl">Alerts &amp; announcements</h2>
        <p className="mt-2 text-sm text-muted-foreground">Messages, reminders, and supervisor notes will appear here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Notifications</h2>
        <button type="button" onClick={clearAll} className="text-xs font-medium text-blue-600 hover:text-blue-700">
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {ordered.map((n) => (
            <NotificationListRow key={n.id} n={n} onClear={() => clear(n.id)} onActivate={() => activate(n)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NotificationListRow({
  n,
  onClear,
  onActivate,
}: {
  n: Notification;
  onClear: () => void;
  onActivate: () => void;
}) {
  const silenced = n.state === "silenced";
  const Icon = silenced ? BellOff : ICON_MAP[n.icon];
  const styles = KIND_STYLES[n.kind];
  // Names the actual destination (matches "(View Schedule)"/"(View Info)"
  // phrasing) rather than a bare "View" — sourceRef.type is what
  // handleNotificationActivate itself switches on to pick a tab.
  const viewLabel =
    n.sourceRef?.type === "activity" ? "View Schedule" : n.sourceRef?.type === "info" ? "View Info" : "View";

  // Same "slide fully off, then remove" beat as the live alarm bar's own
  // Dismiss button (see NotificationRow's commit()) — x is driven entirely
  // by this motion value rather than the `exit` variant below, so the two
  // don't fight over the same property. `exit` only ever touches opacity,
  // which still covers Clear All wiping every row at once with no individual
  // click to slide from. The same value now also drives an actual drag
  // gesture (see drag props below), so a tap on the X button and a real
  // swipe-to-dismiss both end up animating the identical property.
  const threshold = SWIPE_THRESHOLD_PX;
  const dismissX = useMotionValue(0);
  const wasDragging = useRef(false);
  // Fades out once dragged well past the commit point, echoing the live
  // alert bar's own bubble fade — otherwise the row would still read as
  // "fully there" right up until it's flung offscreen.
  const cardOpacity = useTransform(dismissX, [-threshold * 2.5, -threshold, 0], [0, 1, 1]);

  const commitDismiss = (velocity = 0) => {
    const val = dismissX.get();
    const target = -500;
    const remaining = target - val;
    const fastFlick = Math.abs(velocity) > 800;
    animate(dismissX, target, {
      type: "tween",
      ease: "easeIn",
      duration: fastFlick ? 0.12 : Math.min(0.28, Math.max(0.16, Math.abs(remaining) / 1400)),
    }).then(onClear);
  };

  const handleDragEnd = (_e: unknown, info: { velocity: { x: number } }) => {
    if (dismissX.get() <= -threshold) {
      commitDismiss(info.velocity.x);
    } else {
      animate(dismissX, 0, {
        type: "spring",
        velocity: info.velocity.x,
        stiffness: SWIPE_SPRING_STIFFNESS,
        damping: SWIPE_SPRING_DAMPING,
      });
    }
    window.setTimeout(() => { wasDragging.current = false; }, 80);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ layout: NOTIFICATION_AREA_TRANSITION, default: { type: "spring", stiffness: 420, damping: 20 } }}
      drag="x"
      dragConstraints={{ left: -threshold * 1.4, right: 0 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragStart={() => { wasDragging.current = true; }}
      onDragEnd={handleDragEnd}
      style={{ x: dismissX, opacity: cardOpacity }}
      className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className={cn("flex items-center justify-center size-8 shrink-0 rounded-full", styles.ring, styles.iconFg)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <NotificationTitle title={n.title} className="block text-sm text-stone-900" />
        {n.body && <p className="mt-0.5 text-xs text-stone-600">{n.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          {n.sourceRef && (
            <button
              type="button"
              onClick={() => { if (!wasDragging.current) onActivate(); }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {viewLabel}
            </button>
          )}
          <span className="text-[10px] text-stone-400">{formatRelativeTime(n.createdAt)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => { if (!wasDragging.current) commitDismiss(); }}
        aria-label="Clear notification"
        className="shrink-0 grid place-items-center size-7 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

function formatRelativeTime(ts: number) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Live countdown/countup to an alert's own activity, shown next to its
// location (see NotificationRow) — distinct from formatRelativeTime above
// (which only ever counts backward from when a notification was created)
// since this one also has to read naturally before the activity starts.
function formatActivityRelativeTime(activityAt: number, nowMs: number) {
  const diffMin = Math.round((activityAt - nowMs) / 60_000);
  if (diffMin === 0) return "Now";
  if (diffMin > 0) return `In ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  const past = -diffMin;
  return `${past} minute${past === 1 ? "" : "s"} ago`;
}

function RowButton({
  label,
  onClick,
  colorClass,
  style,
  children,
}: {
  label: string;
  onClick: () => void;
  colorClass: string;
  style?: MotionStyle;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex items-center justify-center size-8 rounded-full text-white shadow-sm transition-colors",
        colorClass,
      )}
    >
      {children}
    </motion.button>
  );
}
