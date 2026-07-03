import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate, type MotionStyle } from "motion/react";
import { Bell, BellRing, BellOff, Target, MessageSquare, Megaphone, X, VolumeX, ArrowRight } from "lucide-react";
import { useNotifications, type Notification, type NotificationIcon, type NotificationKind } from "./NotificationContext";
import type { AlarmSoundStyle } from "./SettingsContext";
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

const ICON_MAP: Record<NotificationIcon, typeof Bell> = {
  bell: Bell,
  "bell-chime": BellRing,
  "bell-muted": BellOff,
  target: Target,
  message: MessageSquare,
  megaphone: Megaphone,
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
};

function isAlert(k: NotificationKind) {
  return k === "alert-now" || k === "alert-priming";
}

// Play a short alarm chime via WebAudio (no asset dependency) — three
// styles ranging from a soft heads-up to a properly obnoxious wake-you-up
// alarm, so the "heavy" option actually reads as more urgent than "normal"
// rather than just louder.
function playChime(style: AlarmSoundStyle = "normal") {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;

    const tone = (freq: number, t0: number, duration: number, peakGain: number, waveType: OscillatorType) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = waveType;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peakGain, t0 + duration * 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + duration + 0.05);
    };

    let closeAt = 900;
    if (style === "gentle") {
      // Two soft, slow sine notes, a gentle two-tone doorbell.
      tone(587, now, 0.5, 0.11, "sine"); // D5
      tone(784, now + 0.32, 0.6, 0.11, "sine"); // G5
      closeAt = 1100;
    } else if (style === "heavy") {
      // A rapid, insistent square-wave siren — three sharp high/low pulses.
      const pulseTimes = [0, 0.16, 0.32];
      pulseTimes.forEach((offset) => {
        tone(988, now + offset, 0.12, 0.3, "square");
        tone(740, now + offset + 0.12, 0.12, 0.3, "square");
      });
      closeAt = 700;
    } else {
      // Normal — the original pleasant two-tone chime.
      tone(880, now, 0.35, 0.18, "sine"); // A5
      tone(1318, now + 0.18, 0.4, 0.18, "sine"); // E6
      closeAt = 900;
    }

    window.setTimeout(() => ctx.close().catch(() => {}), closeAt);
  } catch {
    /* noop */
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* noop */
  }
}

export function NotificationBar() {
  const { live, dismiss, snooze, silence, activate } = useNotifications();
  const { prefs } = useNotifications();

  // Newest on top — show up to maxStackVisible.
  const ordered = [...live].sort((a, b) => b.createdAt - a.createdAt);
  const visible = ordered.slice(0, prefs.maxStackVisible);
  const overflow = ordered.length - visible.length;

  return (
    // Full viewport width (not the centered max-w column) so a row has room
    // to actually slide off the edge of the screen when dragged/committed,
    // instead of getting clipped by a narrow centered container.
    <div className="px-3 pt-2 overflow-x-hidden pointer-events-none ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen">
      <motion.div layout transition={{ layout: NOTIFICATION_AREA_TRANSITION }} className="max-w-2xl mx-auto flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              alarmSound={prefs.alarmSound}
              onActivate={() => activate(n)}
              onDismiss={() => dismiss(n.id)}
              onSnooze={() => snooze(n.id)}
              onSilence={() => silence(n.id)}
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
  alarmSound,
  onActivate,
  onDismiss,
  onSnooze,
  onSilence,
}: {
  n: Notification;
  alarmSound: AlarmSoundStyle;
  onActivate: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onSilence: () => void;
}) {
  const silenced = n.state === "silenced";
  // Once silenced the row stays but reads as muted, regardless of the
  // notification's own stored icon (which is what drives the chime).
  const Icon = silenced ? BellOff : ICON_MAP[n.icon];
  const styles = KIND_STYLES[n.kind];
  const alert = isAlert(n.kind);
  const showSnooze = alert && n.allowSnooze;
  const hasChime = n.icon === "bell-chime" && !silenced;
  const showSilence = alert && hasChime;
  const canSwipeRight = showSnooze || showSilence;
  const rightAction = showSnooze ? onSnooze : showSilence ? onSilence : undefined;

  // Chime + vibrate every 2s while an alert with chime is visible.
  useEffect(() => {
    if (!alert || !hasChime) return;
    playChime(alarmSound);
    vibrate(n.kind === "alert-now" ? [60, 40, 60] : 50);
    const id = window.setInterval(() => {
      playChime(alarmSound);
      vibrate(n.kind === "alert-now" ? [60, 40, 60] : 50);
    }, 2000);
    return () => window.clearInterval(id);
  }, [alert, hasChime, n.kind, alarmSound]);

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

  const handleDragEnd = (_e: unknown, info: { velocity: { x: number } }) => {
    const val = dragX.get();
    const vx = info.velocity.x;
    const commitLeft = val <= -threshold;
    const commitRight = val >= threshold && !!rightAction;
    if (commitLeft) {
      commit(-1, onDismiss, vx);
    } else if (commitRight) {
      commit(1, rightAction!, vx);
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
            <div className="text-sm font-semibold text-stone-900 truncate">{n.title}</div>
            {n.body && (
              <div className="text-xs text-stone-600 truncate">{n.body}</div>
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
              <RowButton label="Silence" colorClass={styles.button} style={{ opacity: silenceOpacity, scale: silenceScale }} onClick={() => commit(1, onSilence)}>
                <VolumeX className="size-4" />
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
