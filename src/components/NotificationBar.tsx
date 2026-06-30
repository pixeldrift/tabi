import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellRing, BellOff, Target, MessageSquare, Megaphone, X, VolumeX, Moon, ArrowRight } from "lucide-react";
import { useNotifications, type Notification, type NotificationIcon, type NotificationKind } from "./NotificationContext";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<NotificationIcon, typeof Bell> = {
  bell: Bell,
  "bell-chime": BellRing,
  "bell-muted": BellOff,
  target: Target,
  message: MessageSquare,
  megaphone: Megaphone,
};

// Tint per kind — semantic-ish colors using existing palette.
const KIND_STYLES: Record<NotificationKind, { ring: string; iconFg: string; accent: string }> = {
  "alert-now": {
    ring: "border-red-300 bg-red-50",
    iconFg: "text-red-700",
    accent: "bg-red-500",
  },
  "alert-priming": {
    ring: "border-amber-300 bg-amber-50",
    iconFg: "text-amber-700",
    accent: "bg-amber-500",
  },
  "goal-change": {
    ring: "border-blue-300 bg-blue-50",
    iconFg: "text-blue-700",
    accent: "bg-blue-500",
  },
  message: {
    ring: "border-emerald-300 bg-emerald-50",
    iconFg: "text-emerald-700",
    accent: "bg-emerald-500",
  },
  announcement: {
    ring: "border-violet-300 bg-violet-50",
    iconFg: "text-violet-700",
    accent: "bg-violet-500",
  },
};

function isAlert(k: NotificationKind) {
  return k === "alert-now" || k === "alert-priming";
}

// Play a short chime via WebAudio (no asset dependency).
function playChime() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const tones = [880, 1318]; // A5, E6
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t0 = now + i * 0.18;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.4);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 900);
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
  const { live, dismiss, snooze, silence, prefs } = useNotifications();

  // Newest on top — show up to maxStackVisible.
  const ordered = [...live].sort((a, b) => b.createdAt - a.createdAt);
  const visible = ordered.slice(0, prefs.maxStackVisible);
  const overflow = ordered.length - visible.length;

  return (
    <div className="px-3 pt-2 pointer-events-none">
      <div className="max-w-2xl mx-auto flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onDismiss={() => dismiss(n.id)}
              onSnooze={() => snooze(n.id)}
              onSilence={() => silence(n.id)}
            />
          ))}
          {overflow > 0 && (
            <motion.div
              key="overflow"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pointer-events-auto self-center rounded-full bg-stone-700/90 text-white text-xs px-2.5 py-0.5"
            >
              +{overflow} more
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NotificationRow({
  n,
  onDismiss,
  onSnooze,
  onSilence,
}: {
  n: Notification;
  onDismiss: () => void;
  onSnooze: () => void;
  onSilence: () => void;
}) {
  const Icon = ICON_MAP[n.icon];
  const styles = KIND_STYLES[n.kind];
  const alert = isAlert(n.kind);
  const showSnooze = alert && n.allowSnooze;
  const hasChime = n.icon === "bell-chime";

  // Fire chime + vibrate once when an alert with chime appears.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (alert && hasChime) {
      playChime();
      vibrate(n.kind === "alert-now" ? [60, 40, 60] : 50);
    }
  }, [alert, hasChime, n.kind]);


  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-full border shadow-sm",
        styles.ring,
      )}
    >
      <div className="flex items-center gap-3 pl-3 pr-2 py-1.5">
        <div
          className={cn(
            "flex items-center justify-center size-7 shrink-0",
            styles.iconFg,
            n.kind === "alert-now" && "animate-bounce",
            n.kind === "alert-priming" && "animate-pulse",
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
        <div className="flex items-center gap-0.5 shrink-0">
          {alert ? (
            <>
              <RowButton label="Silence" onClick={onSilence}>
                <VolumeX className="size-4" />
              </RowButton>
              {showSnooze && (
                <RowButton label="Snooze" onClick={onSnooze}>
                  <Moon className="size-4" />
                </RowButton>
              )}
            </>
          ) : (
            <RowButton label="Open" onClick={onDismiss}>
              <ArrowRight className="size-4" />
            </RowButton>
          )}
          <RowButton label="Dismiss" onClick={onDismiss}>
            <X className="size-4" />
          </RowButton>
        </div>
      </div>
    </motion.div>
  );
}

function RowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex items-center justify-center size-8 rounded-full text-stone-600 hover:text-stone-900 hover:bg-black/5 active:bg-black/10 transition-colors"
    >
      {children}
    </button>
  );
}
