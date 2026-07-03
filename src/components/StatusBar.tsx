import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, animate } from "motion/react";
import {
  Play,
  Pause,
  Timer,
  ClipboardList,
  CalendarDays,
  Bell,
  Check,
  Trash2,
  ArrowUp,
  ArrowLeft,
  RefreshCw,
  User,
  ArrowRight,
  Upload,
  Settings as SettingsIcon,
} from "lucide-react";
import { InfoIcon } from "./icons/InfoIcon";
import {
  useSession,
  HEADER_MORPH_MS,
  BOX_COLLAPSE_MS,
  DIGIT_SETTLE_MS,
  PILL_TRAVEL_MS,
  PILL_CROSSFADE_MS,
  type SaveStatus,
  type SessionStatus,
} from "./SessionContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NotificationBar, NOTIFICATION_AREA_TRANSITION } from "@/components/NotificationBar";


export type StatusTab = "info" | "data" | "schedule" | "notifications" | "settings";

interface StatusBarProps {
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
  title?: string;
}

const TABS: { id: StatusTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "info", label: "Info", icon: InfoIcon },
  { id: "data", label: "Data", icon: ClipboardList },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

// Stage 2 (see SessionContext's CARD_EXIT_MS/HEADER_MORPH_MS comment) is
// where the odometer rolls to zero, settles from gray to black, the pill
// shrinks/moves into the mini slot, and the session box collapses — all
// sharing HEADER_MORPH_MS/this ease so they read as a single movement.
const SESSION_MORPH_MS = HEADER_MORPH_MS;
const SESSION_MORPH_EASE = NOTIFICATION_AREA_TRANSITION.ease;
// A softer landing than the standard ease-in-out above — the pill's own
// shrink/travel is the one motion in this whole sequence meant to feel
// physical (something arriving somewhere), so it gets a more pronounced
// ease-out than the rest of the header's snappier, mechanical transitions.
const PILL_TRAVEL_EASE = [0.22, 1, 0.36, 1] as const;

export function StatusBar({ activeTab, onTabChange, title = "Phineas Flynn's Data Sheet" }: StatusBarProps) {
  const {
    status,
    elapsedMs,
    pause,
    endAndSubmit,
    transitionStage,
    transitionKind,
    requestStartNew,
    requestContinuePrevious,
    requestResume,
    requestDiscard,
    activeTimers,
    saveStatus,
    lastSavedAt,
    forceSync,
  } = useSession();

  const durationTimers = activeTimers.filter((t) => t.source === "duration");

  // Random previous session length between 1-5 hours, generated once on the client.
  const [previousSessionMs, setPreviousSessionMs] = useState(2 * 3600 * 1000);
  const [previousSessionEndedAt, setPreviousSessionEndedAt] = useState<Date | null>(null);
  useEffect(() => {
    setPreviousSessionMs(Math.floor((1 + Math.random() * 4) * 3600 * 1000));
    // Random end time: somewhere between 1 minute and 3 days ago.
    const minMs = 60 * 1000;
    const maxMs = 3 * 24 * 3600 * 1000;
    setPreviousSessionEndedAt(new Date(Date.now() - (minMs + Math.random() * (maxMs - minMs))));
  }, []);

  const isRunning = status === "running";
  const [discardOpen, setDiscardOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  // Stage 1 (old stuff exiting) dims the box's own text/buttons; stage 2 is
  // when the box collapses — except for discard, where the box was already
  // expanded (paused) and stays that way; only its displayed value swaps.
  const dimmed = transitionStage > 0;
  const collapsed = isRunning || (transitionStage === 2 && transitionKind !== "discard");

  // The box itself waits for the pill's SESSION_MORPH_MS morph to land in
  // the mini slot before collapsing, so the two reads as sequential beats
  // ("clock moves, then box closes") instead of happening at once. A real
  // state flip (not a Motion `transition.delay`) so it can't be disturbed by
  // the elapsed-timer's frequent re-renders once the session is running.
  // SessionContext's stage-2 dwell is extended by BOX_COLLAPSE_MS to match,
  // so `dimmed` doesn't reset (and box content reappear) before this lands.
  const [boxCollapsed, setBoxCollapsed] = useState(collapsed);
  useEffect(() => {
    if (collapsed) {
      const id = window.setTimeout(() => setBoxCollapsed(true), SESSION_MORPH_MS);
      return () => window.clearTimeout(id);
    }
    setBoxCollapsed(false);
  }, [collapsed]);

  // Same "never animate to the literal string auto" fix as actionsHeight
  // below: without it, whenever the pill itself enters/leaves this box (its
  // biggest content change), Motion's cached "auto" resolution snaps the
  // whole box to its new natural height instead of smoothly tracking it,
  // which was bleeding into the tabs/nav below as a brief desync. A
  // ResizeObserver keeps this current through any content change, not just
  // the specific ones a dependency array would need to know about.
  const boxWrapRef = useRef<HTMLDivElement>(null);
  const [boxNaturalHeight, setBoxNaturalHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = boxWrapRef.current;
    if (!el) return;
    const measure = () => setBoxNaturalHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const requestPlay = () => {
    if (status === "paused") requestResume();
    else requestContinuePrevious(previousSessionMs);
  };

  // What time to show inside the pill during the morph: keep continuity so
  // the big pill and mini pill display the same value while animating.
  const pillElapsed = isRunning
    ? elapsedMs
    : status === "paused"
      ? elapsedMs
      : transitionStage === 2 && transitionKind === "start-new"
        ? 0
        : previousSessionMs;

  // Manual FLIP for the pill's big<->mini morph. Motion's layoutId FLIP
  // turned out to ignore the configured duration entirely for a size delta
  // this large (verified by setting it to 2s and seeing no change in pace)
  // — this replaces it with a shape we animate ourselves (so timing is
  // actually ours to control), then crossfade into the real, correctly
  // laid-out element once it lands. See the overlay render below.
  const bigPillRef = useRef<HTMLDivElement>(null);
  const miniPillRef = useRef<HTMLDivElement>(null);
  const [pillView, setPillView] = useState<"big" | "mini">(isRunning ? "mini" : "big");
  const [pillTraveling, setPillTraveling] = useState(false);
  const [pillTravelRect, setPillTravelRect] = useState<{ from: DOMRect; to: DOMRect } | null>(null);
  const pillTravelFromRef = useRef<DOMRect | null>(null);
  const prevIsRunningForPillRef = useRef(isRunning);

  // The instant `isRunning` flips, decide whether to travel right away or
  // wait first. A fresh start resets the odometer to zero at this same
  // instant (see pillElapsed above) — DIGIT_SETTLE_MS holds the pill still
  // (big) so that reset is visibly readable before anything starts
  // shrinking/moving, instead of the roll and the travel happening on top
  // of each other. Resume/pause have no such reset, so they travel
  // immediately. Either way, the outgoing rect is captured fresh at the
  // moment travel actually begins (post-settle, if delayed), and the
  // destination element mounts (invisible) so the next effect can measure
  // where it naturally lands.
  useLayoutEffect(() => {
    if (isRunning === prevIsRunningForPillRef.current) return;
    prevIsRunningForPillRef.current = isRunning;
    const startingFresh = isRunning && transitionKind === "start-new";
    const fromEl = isRunning ? bigPillRef.current : miniPillRef.current;
    if (!fromEl) {
      setPillView(isRunning ? "mini" : "big");
      return;
    }
    const beginTravel = () => {
      pillTravelFromRef.current = fromEl.getBoundingClientRect();
      setPillTravelRect(null);
      setPillTraveling(true);
      setPillView(isRunning ? "mini" : "big");
    };
    if (startingFresh) {
      const id = window.setTimeout(beginTravel, DIGIT_SETTLE_MS);
      return () => window.clearTimeout(id);
    }
    beginTravel();
  }, [isRunning, transitionKind]);

  // Once the destination element exists in the DOM (still invisible),
  // measure its natural resting rect and let the overlay start traveling
  // toward it.
  useLayoutEffect(() => {
    if (!pillTraveling || pillTravelRect) return;
    const toEl = pillView === "mini" ? miniPillRef.current : bigPillRef.current;
    const fromRect = pillTravelFromRef.current;
    if (!toEl || !fromRect) return;
    setPillTravelRect({ from: fromRect, to: toEl.getBoundingClientRect() });
  }, [pillTraveling, pillTravelRect, pillView]);

  const renderBigPill = pillView === "big" || pillTraveling;
  const renderMiniPill = pillView === "mini" || pillTraveling;
  const bigPillVisible = pillView === "big" && !pillTraveling;
  const miniPillVisible = pillView === "mini" && !pillTraveling;


  return (
    <>
      <div data-status-bar className="relative overflow-hidden sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-stone-200">
        <div className={cn("max-w-5xl mx-auto px-4", isRunning ? "pt-1" : "pt-2")}>
          {/* Title row — static, never scales or layout-animates */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 pt-1">
              <button
                type="button"
                aria-label="Back to sessions"
                title="Back to sessions"
                className="grid place-items-center size-8 -ml-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h1 className="font-display text-base sm:text-lg leading-tight truncate">{title}</h1>
            </div>

            <div className="pt-1">
              <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onSync={forceSync} />
            </div>
          </div>

          <LayoutGroup id="session-bar">
            {/* Session box area — always rendered; height animates symmetrically both ways.
                The pill inside is hidden when running so only the mini pill carries the
                shared layoutId, letting motion morph cleanly between the two positions. */}
            <motion.div
              initial={false}
              animate={{ height: boxCollapsed ? 0 : (boxNaturalHeight ?? "auto"), opacity: boxCollapsed ? 0 : 1 }}
              transition={
                boxCollapsed
                  ? {
                      // Quick, decisive snap once it finally starts — by this
                      // point the pill has already landed in the mini slot and
                      // the box's own content has long since faded (stage 1's
                      // `dimmed`), so there's nothing left to see except the
                      // space closing up.
                      height: { duration: BOX_COLLAPSE_MS / 1000, ease: SESSION_MORPH_EASE },
                      opacity: { duration: (BOX_COLLAPSE_MS / 1000) * 0.6 },
                    }
                  : {
                      // Mirrors the collapsed branch (same ease, opacity starting
                      // together with height rather than after a delay) so the
                      // box's own fade-in and the tabs/nav's layout push — which
                      // shares SESSION_MORPH_MS via NOTIFICATION_AREA_TRANSITION —
                      // move as one instead of the box appearing to lag behind.
                      height: { duration: SESSION_MORPH_MS / 1000, ease: SESSION_MORPH_EASE },
                      opacity: { duration: (SESSION_MORPH_MS / 1000) * 0.6 },
                    }
              }
              className="flex justify-center overflow-hidden"
            >
              {/* Unstyled, never height-controlled — safe to observe for its
                  natural content size without the observer feeding back into
                  its own target (which the outer motion.div's height is).
                  The parent is a row flex (`flex justify-center`), so its
                  default align-items:stretch would otherwise force this
                  child to match the parent's (possibly momentarily-stale)
                  height instead of sizing to its own content — self-start
                  opts out of that stretch. */}
              <div ref={boxWrapRef} className="self-start shrink-0">
                <ExpandedSessionBox
                  status={status}
                  elapsedMs={pillElapsed}
                  contextTime={status === "paused" ? null : previousSessionEndedAt}
                  renderPill={renderBigPill}
                  pillVisible={bigPillVisible}
                  pillRef={bigPillRef}
                  dimmed={dimmed}
                  onPlay={requestPlay}
                  onStartNew={requestStartNew}
                  onEnd={() => setEndOpen(true)}
                  onRequestDiscard={() => setDiscardOpen(true)}
                />
              </div>
            </motion.div>



            <NotificationBar />

            {/* Tabs row + mini session (when running) */}
            <motion.nav
              layout="position"
              transition={{ layout: NOTIFICATION_AREA_TRANSITION }}
              className={cn("flex items-end justify-between gap-2 -mb-px", isRunning ? "mt-1" : "mt-2")}
              role="tablist"
              aria-label="Session sections"
            >
              <div className="flex items-end gap-1 -ml-3">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = t.id === activeTab;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onTabChange(t.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-lg border border-b-0 transition-[color,background-color,opacity] duration-300",
                        isActive
                          ? "bg-background text-foreground border-stone-200 font-medium"
                          : "bg-stone-200/70 text-stone-600 border-transparent hover:text-foreground hover:bg-stone-200",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="hidden sm:inline">{t.label}</span>
                      {isActive && (
                        <span className="absolute -bottom-px left-0 right-0 h-px bg-background" aria-hidden />
                      )}
                    </button>
                  );
                })}
                <ActiveDurationIndicator timers={durationTimers} />
              </div>

              {renderMiniPill && (
                // -mr-4 cancels the header's own px-4 edge padding, then
                // pr-1.5/pr-2 re-adds it to match pb-1.5/pb-2 exactly — same
                // clearance on the right as there is below the pill. Reserves
                // its slot in the tabs row whenever it's the resting view OR
                // mid-travel (so the destination has somewhere to measure/
                // crossfade into); visibility itself is separate, see
                // pillVisible below.
                <div className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2 -mr-4">
                  <MiniSession
                    elapsedMs={pillElapsed}
                    onPause={pause}
                    disabled={!isRunning}
                    pillVisible={miniPillVisible}
                    pillRef={miniPillRef}
                  />
                </div>
              )}
            </motion.nav>


          </LayoutGroup>
        </div>
      </div>
      {/* The pill's own travel shape — carries real digits (not an empty
          outline) so the clock reads as the same object shrinking and
          moving, not a blank placeholder. Animated with real numeric
          top/left/width/height/font-size targets (not layoutId), so the
          duration is actually honored. Rendered outside data-status-bar's
          overflow-hidden so position:fixed isn't clipped. */}
      <AnimatePresence>
        {pillTraveling && pillTravelRect && (() => {
          const toMini = pillView === "mini";
          const digitPx = { from: toMini ? 30 : 14, to: toMini ? 14 : 30 };
          const digitColor = { from: toMini ? "#292524" : "#1d4ed8", to: toMini ? "#1d4ed8" : "#292524" };
          const buttonPx = { from: toMini ? 56 : 28, to: toMini ? 28 : 56 };
          const borderColor = { from: toMini ? "#d6d3d1" : "#3b82f6", to: toMini ? "#3b82f6" : "#d6d3d1" };
          return (
            <motion.div
              key="pill-travel-overlay"
              initial={{
                top: pillTravelRect.from.top,
                left: pillTravelRect.from.left,
                width: pillTravelRect.from.width,
                height: pillTravelRect.from.height,
                borderColor: borderColor.from,
                opacity: 1,
              }}
              animate={{
                top: pillTravelRect.to.top,
                left: pillTravelRect.to.left,
                width: pillTravelRect.to.width,
                height: pillTravelRect.to.height,
                borderColor: borderColor.to,
                opacity: 1,
              }}
              exit={{ opacity: 0, transition: { duration: PILL_CROSSFADE_MS / 1000 } }}
              transition={{ duration: PILL_TRAVEL_MS / 1000, ease: PILL_TRAVEL_EASE }}
              onAnimationComplete={() => setPillTraveling(false)}
              className="fixed z-50 flex items-stretch rounded-full border-2 bg-white shadow-md pointer-events-none overflow-hidden"
            >
              <motion.span
                initial={{ fontSize: digitPx.from, color: digitColor.from }}
                animate={{ fontSize: digitPx.to, color: digitColor.to }}
                transition={{ duration: PILL_TRAVEL_MS / 1000, ease: PILL_TRAVEL_EASE }}
                className="flex-1 flex items-center justify-center leading-none font-medium px-2"
              >
                <OdometerDigits text={formatTime(pillElapsed)} />
              </motion.span>
              <motion.span
                initial={{ width: buttonPx.from }}
                animate={{ width: buttonPx.to }}
                transition={{ duration: PILL_TRAVEL_MS / 1000, ease: PILL_TRAVEL_EASE }}
                className="shrink-0 bg-blue-500"
              />
            </motion.div>
          );
        })()}
      </AnimatePresence>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-red-500 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle className="text-red-600">Warning!</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure? This will end the current session and discard any data collected during the session so far!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
            <DiscardAction
              onConfirm={() => {
                requestDiscard();
                setDiscardOpen(false);
              }}
            />
            <span className="text-xs text-muted-foreground text-center">Or</span>
            <button
              onClick={() => setDiscardOpen(false)}
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              Continue Session Safely
              <Play className="size-4" fill="currentColor" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-green-500 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle className="text-green-600">End Session & Graph Data</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure? This will end the current session and submit collected data for graphing? Targets that have not met their minimums will not be graphed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
            <button
              onClick={() => {
                endAndSubmit();
                setEndOpen(false);
              }}
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              End & Submit Data
              <Upload className="size-4" strokeWidth={2.5} />
            </button>
            <span className="text-xs text-muted-foreground text-center">Or</span>
            <button
              onClick={() => setEndOpen(false)}
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              Return to Session
              <Play className="size-4" fill="currentColor" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ActiveDurationIndicator({ timers }: { timers: { id: string; label: string; scrollTo: () => void; activate?: () => void }[] }) {
  const [index, setIndex] = useState(0);
  const count = timers.length;
  const visible = count > 0;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const handleClick = () => {
    if (count === 0) return;
    const next = index % count;
    timers[next]?.scrollTo();
    timers[next]?.activate?.();
    setIndex((i) => (count > 0 ? (i + 1) % count : 0));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="duration-indicator"
          onClick={handleClick}
          aria-label={count > 1 ? `Jump to next running timer (${count} active)` : `Jump to running timer`}
          title={count > 1 ? `${count} timers running — tap to cycle` : timers[0]?.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{
            y: { type: "spring", stiffness: 400, damping: 12 },
            opacity: { duration: 0.25 },
          }}
          className="relative flex items-center justify-center px-2 py-1.5 sm:py-2 cursor-pointer text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span className="inline-block animate-pulse-scale">
            <Timer className="size-4" />
          </span>

          {count > 1 && (
            <sup className="text-[9px] font-semibold leading-none -ml-px -mt-1.5">
              {count}
            </sup>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}


function SaveIndicator({
  status,
  lastSavedAt,
  onSync,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onSync: () => void;
}) {
  const isDirty = status === "dirty";
  const isSaving = status === "saving";

  const cloudColorClass = isDirty || isSaving ? "text-blue-500" : "text-stone-400";
  const SymbolIcon = isDirty ? ArrowUp : isSaving ? RefreshCw : Check;

  const label = isSaving ? "Saving" : isDirty ? "Unsaved" : "Saved";
  const labelColor = isSaving || isDirty ? "text-blue-600" : "text-stone-700";

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center text-right hover:opacity-80 transition-opacity h-8"
          >
            <span className={cn("text-[11px] font-medium leading-none", labelColor)}>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="relative w-72 rounded-xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          {/* Arrow — right-aligned to point at the cloud icon */}
          <span
            aria-hidden
            className="absolute -top-[7px] right-4 size-3 rotate-45 border-l-2 border-t-2 border-blue-400 bg-white"
          />
          <PopoverPrimitive.Close
            aria-label="Close"
            className="absolute top-2 right-2 grid place-items-center size-7 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors z-10"
          >
            <X className="size-4" />
          </PopoverPrimitive.Close>
          <div className="relative px-5 pt-4 pb-2 border-b border-stone-200 bg-white rounded-t-xl">
            <h3 className="font-display text-lg leading-tight pr-8">Session Data Status</h3>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <span className="relative grid place-items-center size-6 text-stone-400 shrink-0">
                  <CloudShape className="absolute inset-0 size-6" />
                  <SymbolIcon
                    className={cn("relative text-white", isSaving ? "size-2" : "size-2.5")}
                    strokeWidth={3.5}
                    style={{ transform: isSaving ? "translateY(-0.5px)" : "translateY(1px)" }}
                  />
                </span>
                <span className="font-medium">
                  {status === "saving"
                    ? "Saving changes…"
                    : status === "dirty"
                      ? "Unsaved changes"
                      : "All changes saved"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Saved</div>
              <div className="tabular-nums leading-tight">
                <div>{formatFullDate(lastSavedAt)}</div>
                <div>{formatFullTime(lastSavedAt)}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved by</div>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm"
              >
                <User className="size-3" fill="currentColor" strokeWidth={0} />
                <span>Perry Plat</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={isDirty ? onSync : undefined}
        aria-label={isDirty ? "Save now" : isSaving ? "Saving" : "All changes saved"}
        title={isDirty ? "Save now" : isSaving ? "Saving…" : "All changes saved"}
        className={cn(
          "relative grid place-items-center size-8 transition-colors",
          isDirty ? "cursor-pointer" : "cursor-default",
        )}
      >
        <CloudShape className={cn("absolute inset-0 size-8", cloudColorClass, isDirty && "hover:text-blue-600")} />
        <SymbolIcon
          className={cn("relative text-white", isSaving ? "size-2.5" : "size-3")}
          strokeWidth={3.5}
          style={{ transform: isSaving ? "translateY(0px)" : "translateY(1.5px)" }}
        />
      </button>
    </div>
  );
}



function CloudShape({ className }: { className?: string }) {
  // Filled cloud silhouette so the badge reads as a "cloud" with a symbol on top.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M7 18a5 5 0 0 1-.5-9.97A6 6 0 0 1 18 9.08 4.5 4.5 0 0 1 17.5 18H7Z"
      />
    </svg>
  );
}


function formatRelativeDay(d: Date | null) {
  if (!d) return "Never";
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSavedLabel(status: SaveStatus, d: Date | null) {
  if (status === "dirty") return "Unsaved";
  if (!d) return "Never saved";
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diffDays === 0) return "Data Saved";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


function formatTimeOfDay(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatFullDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatFullTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatRelativeFromNow(d: Date) {
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "One minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = diff / 3600000;
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    if (rounded === 1) return "One hour ago";
    return `${rounded} hours ago`;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today.getTime() - that.getTime()) / 86400000);
  const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(/\s*am/g, "a")
    .replace(/\s*pm/g, "p");
  if (days === 1) return `Yesterday at ${timeStr}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${timeStr}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
}

function ExpandedSessionBox({
  status,
  elapsedMs,
  contextTime,
  renderPill = true,
  pillVisible = true,
  pillRef,
  dimmed = false,
  onPlay,
  onStartNew,
  onEnd,
  onRequestDiscard,
}: {
  status: SessionStatus;
  elapsedMs: number;
  contextTime: Date | null;
  renderPill?: boolean;
  pillVisible?: boolean;
  pillRef?: React.RefObject<HTMLDivElement | null>;
  dimmed?: boolean;
  onPlay: () => void;
  onStartNew: () => void;
  onEnd: () => void;
  onRequestDiscard: () => void;
}) {
  const isPaused = status === "paused";
  const label = isPaused ? "Session Paused" : "Previous Session";
  const ease = SESSION_MORPH_EASE;
  // Gray only while genuinely idle and showing a leftover previous-session
  // value — once paused (this session's own time) or once a start/resume has
  // been pressed (about to become live), it reads as black.
  const digitsGray = status === "idle" && !dimmed;

  // Motion's "auto" height resolution wasn't reliable here (the collapse
  // kept resolving in under 40ms instead of easing over 250) — measuring
  // the real pixel height ourselves and animating between two concrete
  // numbers (never "auto") sidesteps that entirely. scrollHeight reports the
  // full content size even while overflow-hidden is clipping it to 0, so
  // this stays accurate regardless of the current animated state.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsHeight, setActionsHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (actionsRef.current) {
      setActionsHeight(actionsRef.current.scrollHeight);
    }
  }, [isPaused]);


  // Re-render to refresh "x ago" string.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!contextTime) return;
    const i = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, [contextTime]);




  return (
    <div className="shrink-0 px-3 py-1.5 w-[280px] flex flex-col items-stretch gap-2">
      <div className="flex flex-col items-center gap-1">
        <motion.span
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={false}
          transition={{ duration: 0.2 }}
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </motion.span>

        <motion.div
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={false}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1 leading-tight"
        >
          {contextTime && (
            <span className="text-[10px] text-muted-foreground text-center tabular-nums whitespace-nowrap">
              {formatRelativeFromNow(contextTime)}{"\u00a0"}({formatMDY(contextTime)}) by{"\u00a0"}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 text-[10px]">
                <User className="size-2.5" fill="currentColor" strokeWidth={0} />
                <span>Perry Plat</span>
              </span>
            </span>
          )}
        </motion.div>

        {/* No layoutId morph — see the manual-FLIP overlay comment in
            StatusBar for why. This just crossfades in/out at its own,
            always-correct position/size once the traveling shape lands. */}
        {renderPill && (
          <div
            ref={pillRef}
            style={{ transitionDuration: `${PILL_CROSSFADE_MS}ms` }}
            className={cn(
              "flex items-stretch rounded-full overflow-hidden border-2 border-stone-300 bg-white w-full h-12 transition-opacity",
              pillVisible ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <span
              className={cn(
                "flex-1 flex items-center justify-center text-3xl leading-none font-medium px-3 transition-colors",
                digitsGray ? "text-stone-400" : "text-stone-800",
              )}
              style={{ transitionDuration: `${SESSION_MORPH_MS}ms` }}
            >
              <OdometerDigits text={formatTime(elapsedMs)} />
            </span>
            <button
              onClick={onPlay}
              aria-label={isPaused ? "Resume session" : "Continue session"}
              className="btn-bevel grid place-items-center w-14 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 active:scale-95 active:brightness-90"
            >
              <span className="grid place-items-center">
                <Play className="size-5" fill="currentColor" strokeWidth={0} />
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Stays mounted (no AnimatePresence) and only ever fades for the
          `dimmed` stage — it does NOT also collapse its height there, so the
          box's overall size stays put while things fade in place, and the
          whole (now-blank) box collapses as a single later beat instead of
          reshuffling mid-fade. Height only changes for genuine content
          swaps (isPaused's button set), via the measured actionsHeight
          number — never "auto", see the comment above. */}
      <motion.div
        ref={actionsRef}
        animate={{ opacity: dimmed ? 0 : 1, height: actionsHeight ?? "auto" }}
        transition={{ duration: 0.25, ease }}
        className="flex flex-col gap-1 overflow-hidden"
      >
        {isPaused ? (
          <button
            onClick={onEnd}
            className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
          >
            End & Submit Data
            <Upload className="size-3.5" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={onStartNew}
            className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
          >
            Start New Session
            <RefreshCw className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
        {isPaused && (
          <button
            onClick={onRequestDiscard}
            className="shrink-0 flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors active:scale-95"
          >
            End & Discard Session!
            <Trash2 className="size-3" />
          </button>
        )}
      </motion.div>

    </div>
  );
}


function DiscardAction({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [maxX, setMaxX] = useState(0);

  const handleSize = 36; // size-9
  const sidePad = 8;

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setMaxX(Math.max(0, el.clientWidth - handleSize - sidePad));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [armed]);

  const labelOpacity = useTransform(x, [0, Math.max(1, maxX * 0.7)], [1, 0]);

  return (
    <div
      ref={trackRef}
      onClick={!armed ? () => setArmed(true) : undefined}
      className={cn(
        "btn-bevel relative h-11 w-full rounded-full bg-red-500 overflow-hidden select-none transition-colors",
        !armed && "cursor-pointer hover:bg-red-600",
      )}
    >
      {/* Label + trash crossfade between tap and drag states */}
      <AnimatePresence mode="wait" initial={false}>
        {!armed ? (
          <motion.span
            key="tap-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center gap-2 text-white text-sm font-medium pointer-events-none"
          >
            <span>End &amp; Discard Session!</span>
            <motion.span layoutId="discard-trash">
              <Trash2 className="size-4" />
            </motion.span>
          </motion.span>
        ) : (
          <>
            <motion.span
              key="drag-label"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              style={{ opacity: labelOpacity }}
              className="absolute inset-0 grid place-items-center px-14 text-white text-xs font-medium whitespace-nowrap pointer-events-none"
            >
              Drag to trash to confirm
            </motion.span>
            <motion.span
              layoutId="discard-trash"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
            >
              <Trash2 className="size-4" />
            </motion.span>
          </>
        )}
      </AnimatePresence>


      {/* Drag handle: scales up from 0 when armed */}
      <motion.button
        type="button"
        aria-label="Drag to confirm discard"
        initial={false}
        animate={{ scale: armed ? 1 : 0, opacity: armed ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 22, delay: armed ? 0.05 : 0 }}
        drag={armed && !confirmed ? "x" : false}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() >= maxX - 4) {
            setConfirmed(true);
            animate(x, maxX, { duration: 0.15 });
            setTimeout(onConfirm, 150);
          } else {
            animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
            setTimeout(() => setArmed(false), 250);
          }
        }}
        className="absolute left-1 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-white text-red-600 shadow-md cursor-grab active:cursor-grabbing"
      >
        <ArrowRight className="size-4" strokeWidth={2.75} />
      </motion.button>
    </div>
  );
}


function MiniSession({
  elapsedMs,
  onPause,
  disabled = false,
  pillVisible = true,
  pillRef,
}: {
  elapsedMs: number;
  onPause: () => void;
  disabled?: boolean;
  pillVisible?: boolean;
  pillRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // No layoutId morph — see the manual-FLIP overlay comment in StatusBar.
  // This just crossfades in/out at its own, always-correct position/size
  // once the traveling shape lands.
  return (
    <div
      ref={pillRef}
      style={{ transitionDuration: `${PILL_CROSSFADE_MS}ms` }}
      className={cn(
        "flex items-stretch rounded-full overflow-hidden border-2 border-blue-500 bg-white h-7 transition-opacity",
        pillVisible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <span className="flex items-center px-2 text-sm leading-none text-blue-700 font-medium">
        <OdometerDigits text={formatTime(elapsedMs)} />
      </span>
      <button
        onClick={disabled ? undefined : onPause}
        aria-label="Pause session"
        title="Pause session"
        className="btn-bevel grid place-items-center w-7 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 active:scale-95 active:brightness-90"
      >
        <span className="grid place-items-center">
          <Pause className="size-3 -translate-x-0.5" fill="currentColor" strokeWidth={0} />
        </span>
      </button>
    </div>
  );
}

function formatMDY(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}




function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Renders a fixed-format time string as an odometer: each character sits in
 * its own slot and rolls vertically only when that position's value changes
 * (colons never do), rather than the whole string just replacing itself. */
function OdometerDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      {text.split("").map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" style={{ height: "1em" }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={{ y: "70%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-70%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
