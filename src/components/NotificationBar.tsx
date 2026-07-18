import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate, type MotionStyle } from "motion/react";
import { Bell, BellRing, BellOff, Target, MessageSquare, Megaphone, CalendarDays, Group, X, Check, Volume2, VolumeX, ArrowRight, ArrowDownToLine } from "lucide-react";
import {
  useNotifications,
  isAlert,
  vibrate,
  categoryForKind,
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationIcon,
  type NotificationKind,
  type NotificationCategory,
} from "./NotificationContext";
import { playAlarmSound } from "@/lib/alarmSounds";
import { RequestEditIcon } from "./icons/RequestEditIcon";
import { ApproveEditIcon } from "./icons/ApproveEditIcon";
import { ToggleChip } from "./DataToolbar";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<NotificationCategory, ComponentType<{ className?: string }>> = {
  alarms: BellRing,
  "program-changes": Target,
  messages: MessageSquare,
  edits: RequestEditIcon,
  schedule: CalendarDays,
};

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
    button: "bg-red-500 hover:bg-red-600 active:bg-red-600",
  },
  "alert-priming": {
    ring: "border-amber-300 bg-amber-50",
    iconFg: "text-amber-700",
    accent: "bg-amber-500",
    button: "bg-amber-500 hover:bg-amber-600 active:bg-amber-600",
  },
  "goal-change": {
    ring: "border-blue-300 bg-blue-50",
    iconFg: "text-blue-700",
    accent: "bg-blue-500",
    button: "bg-blue-500 hover:bg-blue-600 active:bg-blue-600",
  },
  message: {
    ring: "border-emerald-300 bg-emerald-50",
    iconFg: "text-emerald-700",
    accent: "bg-emerald-500",
    button: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-600",
  },
  announcement: {
    ring: "border-violet-300 bg-violet-50",
    iconFg: "text-violet-700",
    accent: "bg-violet-500",
    button: "bg-violet-500 hover:bg-violet-600 active:bg-violet-600",
  },
  "appointment-new": {
    ring: "border-teal-300 bg-teal-50",
    iconFg: "text-teal-700",
    accent: "bg-teal-500",
    button: "bg-teal-500 hover:bg-teal-600 active:bg-teal-600",
  },
  "appointment-cancelled": {
    ring: "border-rose-300 bg-rose-50",
    iconFg: "text-rose-700",
    accent: "bg-rose-500",
    button: "bg-rose-500 hover:bg-rose-600 active:bg-rose-600",
  },
  "edit-request": {
    ring: "border-orange-300 bg-orange-50",
    iconFg: "text-orange-700",
    accent: "bg-orange-500",
    button: "bg-orange-500 hover:bg-orange-600 active:bg-orange-600",
  },
  "edit-approved": {
    ring: "border-indigo-300 bg-indigo-50",
    iconFg: "text-indigo-700",
    accent: "bg-indigo-500",
    button: "bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-600",
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
  const { live, dismiss, clear, snooze, silence, unsilence, enableChime, activate } = useNotifications();
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
    const style = activeAlarm.soundOverride ?? prefs.alarmSound;
    playAlarmSound(style);
    const id = window.setInterval(() => playAlarmSound(style), 2000);
    return () => window.clearInterval(id);
  }, [activeAlarm?.id, activeAlarm?.soundOverride, prefs.alarmSound]);

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
              onClear={() => clear(n.id)}
              onSnooze={() => snooze(n.id)}
              onSilence={() => silence(n.id)}
              onUnsilence={() => unsilence(n.id)}
              onEnableChime={() => enableChime(n.id)}
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
  onClear,
  onSnooze,
  onSilence,
  onUnsilence,
  onEnableChime,
}: {
  n: Notification;
  nowMs: number;
  onActivate: () => void;
  onDismiss: () => void;
  onClear: () => void;
  onSnooze: () => void;
  onSilence: () => void;
  onUnsilence: () => void;
  onEnableChime: () => void;
}) {
  const silenced = n.state === "silenced";
  // Once silenced the row stays but reads as muted, regardless of the
  // notification's own stored icon (which is what drives the chime).
  const Icon = silenced ? BellOff : ICON_MAP[n.icon];
  // Local, optimistic highlight for the Timestamp check's own two extra
  // score buttons — seeded from the interval's status at the moment this
  // alert fired, then just toggled in place on tap (matching the actual
  // card's own score() toggle-on-repeat-press semantics) rather than
  // re-reading the card's live state on every render.
  const [intervalStatus, setIntervalStatus] = useState(n.timestampCheck?.initialStatus ?? null);
  const dismissTimeoutRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (dismissTimeoutRef.current != null) window.clearTimeout(dismissTimeoutRef.current);
  }, []);
  const handleIntervalScore = (value: "correct" | "incorrect") => {
    if (!n.timestampCheck) return;
    setIntervalStatus((prev) => (prev === value ? null : value));
    n.timestampCheck.onScore(value);
    // A brief pause — long enough to actually see the button fill in — then
    // clear outright (the same slide-off `commit` every other dismissal
    // uses, just backed by `clear` instead of `dismiss`) so a recorded
    // interval's alert doesn't linger as dead history in the Notifications
    // tab. Scoring from the alert is meant to fully resolve the check, not
    // just leave it sitting there waiting for a separate manual dismiss.
    dismissTimeoutRef.current = window.setTimeout(() => commit(-1, onClear), 550);
  };
  const styles = KIND_STYLES[n.kind];
  const alert = isAlert(n.kind);
  const showSnooze = alert && n.allowSnooze;
  const isChimeCapable = n.icon === "bell-chime";
  const hasChime = isChimeCapable && !silenced;
  // "off": never configured audible — button shows dimmed, tapping it opts
  // the alert into audio rather than the button just being absent, so
  // there's still a way to turn one on that wasn't originally set to be.
  // "on"/"muted" behave as the existing mute toggle once chime-capable.
  const audioState: "off" | "on" | "muted" = !isChimeCapable ? "off" : silenced ? "muted" : "on";
  const showAudioButton = alert;
  const audioAction = audioState === "off" ? onEnableChime : audioState === "muted" ? onUnsilence : onSilence;
  const canSwipeRight = showSnooze || showAudioButton;
  const rightAction = showSnooze ? onSnooze : showAudioButton ? audioAction : undefined;

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

  const rightIsSnooze = showSnooze;
  const rightIsAudio = !showSnooze && showAudioButton;
  // The background layer's own labels — plain words revealed in the gap the
  // bubble opens up as it slides away from that side (see the backdrop div
  // below), rather than the buttons themselves shrinking/growing. Clamped
  // by default past the threshold, so they hold at full opacity through the
  // rest of a commit fling and only actually fade once the row's own exit
  // transition takes over (see the outer motion.div's `exit`).
  const rightLabelOpacity = useTransform(dragX, [-threshold, 0], [1, 0]);
  const leftLabelOpacity = useTransform(dragX, [0, threshold], [0, 1]);
  const leftLabel = rightIsSnooze
    ? "Snooze"
    : rightIsAudio
      ? audioState === "off"
        ? "Turn On"
        : audioState === "muted"
          ? "Unmute"
          : "Mute"
      : "";

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

  // The audio button's own actions (mute/unmute/turn-on) don't remove the
  // notification from the list — unlike the other actions, the row must
  // settle back to its resting position instead of flinging off.
  const settleInPlace = (action: () => void) => {
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
      if (rightIsAudio) {
        settleInPlace(rightAction!);
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
      {/* Sits behind the draggable bubble — as it slides away from one
          side, this shows through in the gap it leaves, with a word naming
          what letting go there would do. Plain text on the page's own
          background, not a filled panel: the bubble itself still fades as
          it clears the drag threshold (see bubbleOpacity), and a solid
          color back there showed through as a muddy blend during that
          fade. Matches NotificationListRow's own swipe-to-dismiss below,
          which is likewise just a plain slide+fade with no reveal panel
          of its own. Each label's opacity is a direct function of dragX (not a
          fixed fade-in/out), so it reads as the bubble's own motion
          uncovering it rather than a separately-timed animation, and it
          only actually disappears once the row itself exits (see the outer
          motion.div's `exit` above) — a commit fling keeps it lit the whole
          way off rather than fading early. */}
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <motion.span style={{ opacity: leftLabelOpacity }} className={cn("text-sm font-semibold", styles.iconFg)}>
          {leftLabel}
        </motion.span>
        <motion.span style={{ opacity: rightLabelOpacity }} className={cn("text-sm font-semibold", styles.iconFg)}>
          Dismiss
        </motion.span>
      </div>

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
        <div className="w-full flex items-center gap-2 pl-3 pr-2 py-1.5">
          <div
            role="button"
            tabIndex={0}
            // Timestamp's own "time to check" alert has no sourceRef to
            // activate — tapping it instead does what its old standalone
            // "Now" button used to (jump straight to the card), rather than
            // giving up that whole tap target to a no-op.
            onClick={() => {
              if (wasDragging.current) return;
              if (n.timestampCheck) n.timestampCheck.onScrollToCard();
              else onActivate();
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              if (n.timestampCheck) n.timestampCheck.onScrollToCard();
              else onActivate();
            }}
            className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
          >
            <div
              className={cn(
                "relative flex items-center justify-center size-7 shrink-0",
                styles.iconFg,
                // animate-bounce's arc sits above the resting baseline, which
                // reads as off-center within this box — nudged down so its
                // resting position looks vertically centered.
                !silenced && n.kind === "alert-now" && "animate-bounce translate-y-0.5",
                !silenced && n.kind === "alert-priming" && "animate-pulse",
              )}
            >
              <Icon className="size-5" />
              {/* Badges the bell with the same "jump to it" cue this alert's
                  own standalone Now button used to carry, now that tapping
                  the whole row does what that button did — otherwise nothing
                  here signals the tap does anything beyond dismiss/silence
                  like every other alert kind. */}
              {n.timestampCheck && (
                <ArrowDownToLine
                  className="absolute -bottom-1 -right-1 size-3 rounded-full bg-background p-px"
                  aria-hidden
                />
              )}
            </div>
            {n.timestampCheck && <span className="sr-only">Tap to jump to the card</span>}
            <div className="flex-1 min-w-0">
              <NotificationTitle title={n.title} className="block text-sm text-foreground truncate" />
              {n.body && (
                <div className="text-xs text-muted-foreground truncate">
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

          {/* Card-specific cluster (Timestamp's own "time to check" alert) —
              kept as its own group, distinct from the standard audio/snooze/
              dismiss cluster on the right, rather than all six buttons
              reading as one undifferentiated row. `shrink-0` (rather than
              matching the title block's own `flex-1`) so it only ever
              claims the width its two buttons actually need — the title
              block picks up the rest, instead of the two splitting evenly
              regardless of how little this cluster needs. The scroll-to-card
              jump this used to have its own dedicated button for now lives
              on the title/icon tap target itself (see its own onClick). */}
          {n.timestampCheck && (
            <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label={n.timestampCheck.negativeLabel}
                title={n.timestampCheck.negativeLabel}
                onClick={() => handleIntervalScore("incorrect")}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center size-8 rounded-full border-2 transition-colors",
                  intervalStatus === "incorrect"
                    ? "btn-bevel bg-red-500 border-red-600 text-white"
                    : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
                )}
              >
                <X className="size-4" strokeWidth={3} />
              </button>
              <button
                type="button"
                aria-label={n.timestampCheck.positiveLabel}
                title={n.timestampCheck.positiveLabel}
                onClick={() => handleIntervalScore("correct")}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center size-8 rounded-full border-2 transition-colors",
                  intervalStatus === "correct"
                    ? "btn-bevel bg-green-500 border-green-600 text-white"
                    : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
                )}
              >
                <Check className="size-4" strokeWidth={3} />
              </button>
            </div>
          )}

          {/* Standard alert cluster — always the rightmost group. */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {alert ? (
              <>
                {showAudioButton && (
                  <RowButton
                    label={audioState === "off" ? "Turn on alarm" : audioState === "muted" ? "Unmute alarm" : "Mute alarm"}
                    colorClass={cn(
                      audioState === "off" ? "bg-stone-500 hover:bg-stone-600 active:bg-stone-600" : styles.button,
                      // Muting used to only swap the icon, leaving the button
                      // at full strength — reads as still "on." Fading it
                      // here is what actually sells "this is now off,"
                      // matching the never-configured "off" state's own
                      // already-dimmed look instead of just its icon.
                      audioState === "muted" && "opacity-50",
                    )}
                    onClick={() => settleInPlace(audioAction)}
                  >
                    {/* Crossfades rather than swapping instantly — a toggle,
                        not a one-shot action, so it needs to read as flipping
                        a state rather than the button itself changing identity. */}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={audioState}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="grid"
                      >
                        {audioState === "on" ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                      </motion.span>
                    </AnimatePresence>
                  </RowButton>
                )}
                {showSnooze && (
                  <RowButton label="Snooze" colorClass={styles.button} onClick={() => commit(1, onSnooze)}>
                    <ZzIcon className="size-4" />
                  </RowButton>
                )}
              </>
            ) : (
              <RowButton label="Open" colorClass={styles.button} onClick={() => commit(1, onActivate)}>
                <ArrowRight className="size-4" />
              </RowButton>
            )}
            <RowButton label="Dismiss" colorClass={styles.button} onClick={() => commit(-1, onDismiss)}>
              <X className="size-4" />
            </RowButton>
          </div>
        </div>
      </motion.div>
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
  // Empty set = no filter applied (show all), same convention as the Data
  // toolbar's own kind filter — multi-select rather than a single cycling
  // toggle, since "alarms and edits" is a perfectly reasonable combination
  // to want at once.
  const [categoryFilter, setCategoryFilter] = useState<Set<NotificationCategory>>(new Set());
  const toggleCategory = (c: NotificationCategory) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };
  // Separate from the filter chips — this controls how the (already
  // filtered) list is laid out, not which notifications are in it.
  const [groupByType, setGroupByType] = useState(false);

  const allOrdered = [...notifications].sort((a, b) => b.createdAt - a.createdAt);
  const ordered =
    categoryFilter.size === 0
      ? allOrdered
      : allOrdered.filter((n) => categoryFilter.has(categoryForKind(n.kind)));

  if (allOrdered.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-xl border border-dashed border-border bg-white p-8 text-center">
        <h2 className="font-display text-xl">Alerts &amp; announcements</h2>
        <p className="mt-2 text-sm text-muted-foreground">Messages, reminders, and supervisor notes will appear here.</p>
      </div>
    );
  }

  const renderRow = (n: Notification) => (
    <NotificationListRow key={n.id} n={n} onClear={() => clear(n.id)} onActivate={() => activate(n)} />
  );

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Notifications</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupByType((v) => !v)}
            aria-pressed={groupByType}
            aria-label={groupByType ? "Show one combined list" : "Group notifications by type"}
            className={cn(
              "grid place-items-center size-6 rounded-full transition-colors",
              groupByType ? "text-blue-500" : "text-stone-400 hover:text-stone-600",
            )}
          >
            <Group className="size-4" />
          </button>
          <button type="button" onClick={clearAll} className="text-xs font-medium text-blue-500 hover:text-blue-600">
            Clear all
          </button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {/* Label-only (no icon), unlike every category chip below it — reads
            as the "reset" action rather than one more category to pick. */}
        <ToggleChip
          label="See All"
          selected={categoryFilter.size === 0}
          onClick={() => setCategoryFilter(new Set())}
        />
        {NOTIFICATION_CATEGORIES.map(({ category, label }) => {
          const Icon = CATEGORY_ICON[category];
          return (
            <ToggleChip
              key={category}
              icon={<Icon className="size-3" />}
              label={label}
              selected={categoryFilter.has(category)}
              onClick={() => toggleCategory(category)}
            />
          );
        })}
      </div>
      {ordered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No notifications match the selected filters.
        </p>
      ) : groupByType ? (
        <div className="space-y-4">
          {NOTIFICATION_CATEGORIES.map(({ category, label }) => {
            const items = ordered.filter((n) => categoryForKind(n.kind) === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</h3>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>{items.map(renderRow)}</AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>{ordered.map(renderRow)}</AnimatePresence>
        </div>
      )}
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
    n.sourceRef?.type === "activity"
      ? "View Schedule"
      : n.sourceRef?.type === "info"
        ? "View Info"
        : n.sourceRef?.type === "goal"
          ? "View Card"
          : "View";

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
      className="flex items-start gap-3 rounded-xl border border-border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className={cn("flex items-center justify-center size-8 shrink-0 rounded-full", styles.ring, styles.iconFg)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <NotificationTitle title={n.title} className="block text-sm text-foreground" />
        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          {n.sourceRef && (
            <button
              type="button"
              onClick={() => { if (!wasDragging.current) onActivate(); }}
              className="text-xs font-medium text-blue-500 hover:text-blue-600"
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
