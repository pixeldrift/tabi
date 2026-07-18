import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
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
  ArrowRight,
  Upload,
  Settings as SettingsIcon,
  TriangleAlert,
  CheckCircle2,
  ChevronDown,
  Ban,
} from "lucide-react";
import { InfoIcon } from "./icons/InfoIcon";
import { PersonPill } from "./StaffDirectory";
import { markInitialLayoutSettled, useInitialLayoutSettled } from "@/hooks/use-initial-layout-settle";
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
import { playSoundEffect } from "@/lib/soundEffects";
import { useDataToolbar } from "@/components/DataToolbarContext";
import { DATA_TYPE_INFO } from "@/lib/dataTypeInfo";
import { NotificationBar, NOTIFICATION_AREA_TRANSITION } from "@/components/NotificationBar";
import { useNotifications } from "@/components/NotificationContext";
import {
  TIMER_MORPH_DIGIT_MINI,
  TIMER_MORPH_DIGIT_FULL,
  TIMER_MORPH_BORDER_MINI,
  TIMER_MORPH_BORDER_FULL,
} from "@/lib/actionColors";


export type StatusTab = "info" | "data" | "schedule" | "notifications" | "settings";

interface StatusBarProps {
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
  title?: string;
  suppressNavLayout?: boolean;
  /** The Data tab's sticky filter/view toolbar (DataToolbar), rendered as a
   *  plain sibling of this component's own header content inside the SAME
   *  sticky container — see that outer wrapper's own comment below for why.
   *  `undefined`/`false` on every other tab. */
  dataToolbar?: React.ReactNode;
  /** Jumps to a specific card by id (switching to the Data tab first if
   *  needed) — used by the end-session review's "Did Not Meet Minimums"
   *  rows so tapping one takes you straight to it instead of just naming
   *  it. */
  onNavigateToCard?: (id: string) => void;
}

const TABS: { id: StatusTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "info", label: "Client Info", icon: InfoIcon },
  { id: "data", label: "Data", icon: ClipboardList },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "notifications", label: "Notifications", icon: Bell },
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

/** One collapsible group in the end-session review (Did Not Meet Minimums /
 *  Good Data / No Data) — a colored icon + label + count as the summary
 *  line, same twirldown chevron as AccordionRow (About Me's notes, the
 *  teaching-procedure accordion in card detail drawers), with its list
 *  indented underneath so it reads as the summary's children rather than a
 *  sibling. Each section scrolls on its own past a capped height — there's
 *  no fixed limit on how large a caseload might be. */
function ReviewSection({
  icon,
  label,
  count,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  /** Small, faded secondary line under the label — what actually happens
   *  to this group's data on submit (graphed, discarded, or never logged
   *  at all). */
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!open) playSoundEffect("twirldown");
          onToggle();
        }}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} ${label}`}
        className="flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        {icon}
        <span className="flex-1 normal-case tracking-normal">
          {label} <span className="font-bold text-foreground">({count})</span>
        </span>
      </button>
      <p className="pl-[22px] text-[11px] normal-case tracking-normal text-muted-foreground/70">
        {subtitle}
      </p>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr] mt-1.5" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pl-[22px] pr-1 -mr-1">
            {children}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** A review row's content — title left (wraps rather than truncating, so a
 *  long goal name is never cut off), key figure right: large/bold value
 *  with its unit as a small label underneath, rather than one sentence
 *  folding both together. */
function ReviewFigure({ title, value, unit }: { title: string; value: string; unit: string }) {
  return (
    <>
      <div className="min-w-0 flex-1 text-sm font-medium text-foreground break-words">{title}</div>
      <div className="shrink-0 text-right">
        <div className="text-xl font-bold leading-none text-foreground tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{unit}</div>
      </div>
    </>
  );
}

export function StatusBar({
  activeTab,
  onTabChange,
  title = "Phineas Flynn's Data Sheet",
  suppressNavLayout = false,
  dataToolbar,
  onNavigateToCard,
}: StatusBarProps) {
  const {
    status,
    elapsedMs,
    pause,
    endAndSubmit,
    transitionStage,
    transitionKind,
    collapsed,
    boxCollapsed,
    pillTraveling,
    headerReflowActive,
    requestStartNew,
    requestContinuePrevious,
    requestResume,
    requestDiscard,
    activeTimers,
    saveStatus,
    lastSavedAt,
    forceSync,
  } = useSession();

  // See use-initial-layout-settle's own comment — this box's demo-only
  // "Previous Session" row growing the box shortly after mount is real,
  // one-time growth that the tabs/nav below (and the content pane and
  // Data toolbar, in the shared LayoutGroup) shouldn't animate away from.
  const initialLayoutSettled = useInitialLayoutSettled();

  // Duration only — a Rate card's own timer just clocks the observation
  // window behind a tally, not something the user manually started/stopped
  // the way a Duration instance is, so it doesn't belong in "something's
  // running, tap to jump to it." Memoized on `activeTimers` itself (which
  // only gets a new reference on a genuine register/unregister — see its
  // own useState in SessionContext) rather than recomputed every render —
  // this component also re-renders on every ~250ms session tick, and a
  // plain `.filter()` there would hand ActiveDurationIndicator a brand-new
  // (if equally empty) array on every one of those renders. Its own 300ms
  // "wait to make sure this stays empty" grace window resets on any new
  // array reference, so it never got a large enough gap between renders to
  // actually let that timeout fire — the stopwatch indicator was staying
  // visible indefinitely after every timer had genuinely stopped.
  const runningTimers = useMemo(
    () => activeTimers.filter((t) => t.source === "duration"),
    [activeTimers],
  );

  // Notifications tab badge — count of everything currently live (still
  // showing in the transient banner, whether silenced or not; matches
  // NotificationBar's own idea of "live"). Hops once per net increase
  // (a new one arriving), not on every render or on a decrease from
  // dismissing one — prevCountRef starts at the initial count rather than
  // 0, so mounting with some already live doesn't itself read as "new."
  const { live: liveNotifications } = useNotifications();
  const notifCount = liveNotifications.length;
  const prevNotifCountRef = useRef(notifCount);
  const [notifHopGen, setNotifHopGen] = useState(0);
  useEffect(() => {
    if (notifCount > prevNotifCountRef.current) {
      setNotifHopGen((g) => g + 1);
    }
    prevNotifCountRef.current = notifCount;
  }, [notifCount]);

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

  // Since previousSessionEndedAt can only be generated client-side (see its
  // own comment — it's randomized, so it can never be seeded identically
  // for server and client), this box's "Previous Session" row necessarily
  // pops in a beat after mount, genuinely growing the box's natural
  // height — which every layout-tracked sibling in the shared "session-bar"
  // LayoutGroup (this nav, the content pane, the Data toolbar) faithfully
  // tracks. Marking the shared settle flag (see its own comment) once that
  // growth has actually landed — not on a guessed timer, but two frames
  // after the state change that causes it, giving the resulting reflow and
  // this box's own ResizeObserver time to actually commit — lets every
  // subscriber turn its OWN layout tracking on together, instead of
  // animating this one-time, page-load-only growth as a visible drop.
  useEffect(() => {
    if (previousSessionEndedAt === null) return;
    let settleFrame = 0;
    const growFrame = requestAnimationFrame(() => {
      settleFrame = requestAnimationFrame(() => {
        markInitialLayoutSettled();
      });
    });
    return () => {
      cancelAnimationFrame(growFrame);
      cancelAnimationFrame(settleFrame);
    };
  }, [previousSessionEndedAt]);

  const isRunning = status === "running";

  // Resuming un-hides this row (it's only absent while paused) the instant
  // `status` flips to "running" — which, for a staged resume, lands well
  // before the box has actually started collapsing (see boxCollapsed's own
  // delay below). Left live, that briefly grows boxNaturalHeight mid-fade,
  // which the nav/tabs below dutifully track — reading as the whole header
  // bouncing down and then sharply back up once the collapse catches up.
  // Since the box is headed for a full collapse to zero anyway the moment
  // it's running, there's nothing to gain by growing it first: frozen here,
  // it keeps showing whatever it last showed while genuinely paused/idle
  // until the box needs it again (i.e. the next time it isn't running).
  const rawContextTime = status === "paused" ? null : previousSessionEndedAt;
  const frozenContextTimeRef = useRef(rawContextTime);
  if (!isRunning) frozenContextTimeRef.current = rawContextTime;

  const [discardOpen, setDiscardOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [incompleteOpen, setIncompleteOpen] = useState(true);
  const [completeOpen, setCompleteOpen] = useState(true);
  const [untouchedOpen, setUntouchedOpen] = useState(true);
  // Every mounted card reports its own title/kind/key-figure here (see
  // useReportCardStatus) — read fresh each time the end-session dialog
  // opens, so its review list always reflects this session's actual
  // results rather than a stale snapshot from when StatusBar first mounted.
  const { hasData: cardHasData, completion: cardCompletion, cardMeta } = useDataToolbar();
  const allReviewCards = Object.keys(cardMeta).map((id) => ({
    id,
    title: cardMeta[id].title,
    kind: cardMeta[id].kind,
    value: cardMeta[id].value,
    unit: cardMeta[id].unit,
    hasData: cardHasData[id] ?? false,
    isComplete: cardCompletion[id] ?? false,
  }));
  const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
  const incompleteCards = allReviewCards.filter((c) => c.hasData && !c.isComplete).sort(byTitle);
  const completeCards = allReviewCards.filter((c) => c.hasData && c.isComplete).sort(byTitle);
  const untouchedCards = allReviewCards.filter((c) => !c.hasData).sort(byTitle);
  const hasAnyReviewData = incompleteCards.length + completeCards.length + untouchedCards.length > 0;
  const [showCommitSha, setShowCommitSha] = useState(false);
  // Stage 1 (old stuff exiting) dims the box's own text/buttons; stage 2 is
  // when the box collapses — except for discard, where the box was already
  // expanded (paused) and stays that way; only its displayed value swaps.
  const dimmed = transitionStage > 0;
  // `collapsed`, `boxCollapsed`, and `headerReflowActive` all live in
  // SessionContext now (see that file's own comments) — StatusBar reads
  // them rather than deriving its own copies, so the box's real height
  // `animate()` below, this nav's own suppression, and routes/index.tsx's
  // pane suppression all read the exact same values on the exact same
  // render, with nothing mirrored or a tick behind. `headerReflowActive`
  // is what used to be approximated here as `transitionStage === 2 &&
  // transitionKind !== "discard"` — that approximation missed a plain,
  // unstaged `pause()` click (never touches transitionStage/transitionKind
  // at all) and, separately, the dwell between `collapsed` changing and the
  // box's real height actually starting to move (during which this nav's
  // own `isRunning`-derived margin already changes) — both of which let
  // the tab nav, the toolbar riding on it, and the pane below visibly
  // hop/bounce out of step with the header's real motion.
  const suppressSessionLayout = headerReflowActive;

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
  // `pillTraveling` (from SessionContext) is the shared, purely-timed
  // window — StatusBar's own visual travel (capturing rects, mounting the
  // overlay below) is driven directly off it turning true/false rather
  // than keeping its own separate copy, so the two can't drift apart the
  // way a locally-mirrored flag could (see that field's own comment).
  // `visualTravelActive` is local: on the rare mount where there's no
  // outgoing pill element to travel FROM (no prior render to measure), the
  // shared window still opens/closes on schedule, but there's nothing to
  // actually animate — this stays false for that one case so the overlay
  // and the temporarily-doubled big+mini pills don't render for nothing.
  const [visualTravelActive, setVisualTravelActive] = useState(false);
  const [pillTravelRect, setPillTravelRect] = useState<{ from: DOMRect; to: DOMRect } | null>(null);
  const pillTravelFromRef = useRef<DOMRect | null>(null);
  const prevPillTravelingRef = useRef(pillTraveling);

  // Reacts to the shared travel window opening/closing. On open: capture
  // the outgoing element's rect fresh (before `pillView` flips and the DOM
  // changes under it), then flip the view. On close: drop the captured
  // rect so a future travel starts clean — the overlay below unmounts on
  // its own once `visualTravelActive` goes false, AnimatePresence playing
  // its own `exit` fade.
  useLayoutEffect(() => {
    if (pillTraveling === prevPillTravelingRef.current) return;
    prevPillTravelingRef.current = pillTraveling;
    if (!pillTraveling) {
      setVisualTravelActive(false);
      setPillTravelRect(null);
      return;
    }
    const fromEl = isRunning ? bigPillRef.current : miniPillRef.current;
    if (!fromEl) {
      setPillView(isRunning ? "mini" : "big");
      return;
    }
    pillTravelFromRef.current = fromEl.getBoundingClientRect();
    setPillTravelRect(null);
    setVisualTravelActive(true);
    setPillView(isRunning ? "mini" : "big");
  }, [pillTraveling, isRunning]);

  // Once the destination element exists in the DOM (still invisible),
  // measure its natural resting rect and let the overlay start traveling
  // toward it.
  useLayoutEffect(() => {
    if (!visualTravelActive || pillTravelRect) return;
    const toEl = pillView === "mini" ? miniPillRef.current : bigPillRef.current;
    const fromRect = pillTravelFromRef.current;
    if (!toEl || !fromRect) return;
    const rawTo = toEl.getBoundingClientRect();
    // Landing in "mini" happens before the session box collapses (see
    // boxCollapsed's own delay in SessionContext — deliberately, so the two
    // read as sequential beats). But the mini slot's rect right now still
    // reflects the box being open; travelling straight there lands the
    // pill well below the tab bar, into the content pane, and only THEN
    // does the box collapse and drag it back up to where it actually
    // belongs — a visible dip past its own final resting spot. Collapsing
    // the box frees exactly boxNaturalHeight of vertical space above the
    // nav, so predicting that shift now and landing there directly skips
    // the detour without touching the "land, then collapse" sequencing.
    const willCollapseAfterLanding = pillView === "mini" && collapsed && !boxCollapsed && (boxNaturalHeight ?? 0) > 0;
    const to = willCollapseAfterLanding
      ? new DOMRect(rawTo.left, rawTo.top - (boxNaturalHeight ?? 0), rawTo.width, rawTo.height)
      : rawTo;
    setPillTravelRect({ from: fromRect, to });
  }, [visualTravelActive, pillTravelRect, pillView, collapsed, boxCollapsed, boxNaturalHeight]);

  const renderBigPill = pillView === "big" || visualTravelActive;
  const renderMiniPill = pillView === "mini" || visualTravelActive;
  const bigPillVisible = pillView === "big" && !visualTravelActive;
  const miniPillVisible = pillView === "mini" && !visualTravelActive;

  // Same "never animate to the literal string auto" fix as boxNaturalHeight/
  // actionsHeight above — Motion's own "auto" resolution re-measures
  // whenever this slot's content shifts (the pill's own crossfade, the
  // digits rolling), and can settle at a value below its final height
  // before correcting back up, which read as the nav bouncing. A
  // ResizeObserver-measured pixel number never does that.
  const miniSlotRef = useRef<HTMLDivElement>(null);
  const [miniSlotHeight, setMiniSlotHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = miniSlotRef.current;
    if (!el) return;
    const measure = () => setMiniSlotHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The content pane below gets its own border-t (routes/index.tsx) so it
  // reads as a real seam under every OTHER tab and in the gaps between
  // pills — the active tab is meant to be the one exception, its own
  // background painting over that same 1px so it blends into the pane it
  // owns, the same way a browser's own selected tab does. That blend patch
  // has to render as a sibling *outside* data-status-bar's overflow-hidden:
  // it necessarily sits 1px past the active tab's own box (same reasoning
  // as the pill-travel overlay below), and being absolutely positioned it
  // never contributes to this container's own auto height either way — so
  // giving the container extra room here would just push the seam it's
  // supposed to sit on down with it, never actually closing the gap.
  const statusBarRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [tabBlend, setTabBlend] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const barEl = statusBarRef.current;
    const tabEl = tabButtonRefs.current.get(activeTab);
    if (!barEl || !tabEl) return;
    const measure = () => {
      const barRect = barEl.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      setTabBlend({ top: barRect.bottom, left: tabRect.left, width: tabRect.width });
    };
    measure();
    // A ResizeObserver on the bar itself (not the tab) catches every case
    // that actually moves this seam — the session box collapsing/expanding,
    // the mini-session slot rolling in, the pill landing — since all of
    // those change the bar's own rendered height, which is exactly what a
    // ResizeObserver reports, unlike a plain position shift.
    const ro = new ResizeObserver(measure);
    ro.observe(barEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeTab]);

  return (
    <>
      {/* Single shared sticky container for the header proper (title, box,
          notifications, tabs) AND the Data tab's own toolbar below it —
          `dataToolbar` renders here as a plain, normal-flow sibling rather
          than an independently `position: sticky` element computing its own
          `top` off this box's height. That earlier approach needed a
          ResizeObserver/rAF bridge just to keep two SEPARATE sticky
          elements in sync with each other; putting them in the one
          container means there's nothing left to keep in sync — the
          browser lays both out together on every reflow for free, the same
          way it already does for the title row and the tabs below it. */}
      <div className="sticky top-0 z-40">
        <div ref={statusBarRef} data-status-bar className="relative overflow-hidden bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
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
              <h1 className="min-w-0 font-display text-base sm:text-lg leading-tight truncate">{title}</h1>
              {/* Independent of the title's own text, so it stays visible
                  (shrink-0) even once the title itself has to truncate on a
                  narrow screen. __APP_VERSION__ (vite.config.ts) is a static
                  string bumped by hand per release, not derived from git —
                  the full commit SHA behind the tap is still real, for the
                  rarer case of pinning a bug to one exact build. */}
              <button
                type="button"
                onClick={() => setShowCommitSha((v) => !v)}
                title={showCommitSha ? "Tap to show version" : "Tap to show commit SHA"}
                className="shrink-0 italic font-normal text-stone-400 text-xs sm:text-sm overflow-hidden"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={showCommitSha ? "sha" : "version"}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="inline-block"
                  >
                    ({showCommitSha ? __APP_COMMIT_SHA__ : __APP_VERSION__})
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>

            <div className="pt-1">
              <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onSync={forceSync} />
            </div>
          </div>

          {/* LayoutGroup for this box/notification-bar/nav trio now lives in
              routes/index.tsx, wrapping this whole StatusBar plus the panel
              section below it, so the tabs and the panel FLIP in the same
              batch instead of drifting apart — see that file's comment. */}
          <>
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
                      // Zeroed instead while `initialLayoutSettled` is still
                      // false (see its own comment): `boxNaturalHeight`'s very
                      // first real measurement lands a beat after mount, once
                      // the demo-only "Previous Session" row appears — without
                      // this, THIS box played its own real 350ms grow on every
                      // page load, and every layout-tracked sibling below it
                      // (correctly) tracked that real, continuous reflow live,
                      // reading as the whole header/toolbar visibly settling
                      // in a beat after everything else. Any LATER, genuine
                      // height change (an actual session collapsing/expanding)
                      // still gets the real transition.
                      height: !initialLayoutSettled
                        ? { duration: 0 }
                        : { duration: SESSION_MORPH_MS / 1000, ease: SESSION_MORPH_EASE },
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
                  contextTime={frozenContextTimeRef.current}
                  renderPill={renderBigPill}
                  pillVisible={bigPillVisible}
                  pillRef={bigPillRef}
                  dimmed={dimmed}
                  startingNew={dimmed && transitionKind === "start-new"}
                  onPlay={requestPlay}
                  onStartNew={requestStartNew}
                  onEnd={() => {
                    playSoundEffect("question");
                    setEndOpen(true);
                  }}
                  onRequestDiscard={() => {
                    playSoundEffect("warning");
                    setDiscardOpen(true);
                  }}
                />
              </div>
            </motion.div>



            <NotificationBar />

            {/* Tabs row + mini session (when running) */}
            {/* suppressNavLayout (a prop from routes/index.tsx) zeroes the
                layout transition's duration during a data-tab display-mode
                morph. This nav sits sticky at top:0, so its own true
                position never changes for that reason — but Framer Motion's
                LayoutGroup batches it together with the data panel below
                (see index.tsx's "session-bar" LayoutGroup), and the panel's
                active-card scroll anchor calls window.scrollBy every frame
                while the morph runs. Motion's projection math isn't
                sticky-aware: it reads a stuck element's rect as having moved
                whenever scrollY changes mid-measurement, so it was playing a
                brief, spurious correction (a few px, decaying back to 0 over
                the whole morph) each time that scroll anchor nudged the
                page. Toggling the `layout` prop itself off/on around the
                window was tried and made this worse — Motion re-initializes
                its projection right as it re-enables, so it can catch the
                tail of the scroll correction and animate it with the full
                (non-zero) transition instead. Zeroing just the duration
                keeps measurement continuous and collapses whatever phantom
                delta it finds down to a single frame, which reads as no
                jump at all. `suppressSessionLayout` (computed above,
                already folding in the mini-session slot's own real height
                animation growing/shrinking directly inside this nav) zeroes
                it for the unrelated session-transition reason explained
                there. */}
            <motion.nav
              layout="position"
              transition={{
                layout:
                  suppressNavLayout || suppressSessionLayout || !initialLayoutSettled
                    ? { duration: 0 }
                    : NOTIFICATION_AREA_TRANSITION,
              }}
              className={cn("flex items-end justify-between gap-2 -mb-px", isRunning ? "mt-1" : "mt-1.5")}
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
                      ref={(el) => {
                        if (el) tabButtonRefs.current.set(t.id, el);
                        else tabButtonRefs.current.delete(t.id);
                      }}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onTabChange(t.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-lg border border-b-0 transition-[color,background-color,opacity] duration-300",
                        isActive
                          ? "bg-background text-foreground border-border font-medium"
                          : "bg-stone-200/70 text-muted-foreground border-transparent hover:text-foreground hover:bg-stone-200",
                      )}
                    >
                      <Icon className={cn("size-4", !isActive && "opacity-60")} />
                      <span className="hidden sm:inline">{t.label}</span>
                      {t.id === "notifications" && notifCount > 0 && (
                        <span
                          key={notifHopGen}
                          className="absolute -top-1 -right-1 grid place-items-center size-3.5 rounded-full bg-blue-500 text-white text-[9px] font-semibold leading-none animate-bubble-hop"
                        >
                          {notifCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                <ActiveDurationIndicator timers={runningTimers} activeTab={activeTab} onTabChange={onTabChange} />
              </div>

              <AnimatePresence initial={false}>
                {renderMiniPill && (
                  // -mr-4 cancels the header's own px-4 edge padding, then
                  // pr-1.5/pr-2 re-adds it to match pb-1.5/pb-2 exactly — same
                  // clearance on the right as there is below the pill. Reserves
                  // its slot in the tabs row whenever it's the resting view OR
                  // mid-travel (so the destination has somewhere to measure/
                  // crossfade into); visibility itself is separate, see
                  // pillVisible below. Animating this slot's OWN height (it
                  // used to just pop in) means the nav's real height grows
                  // in smoothly instead of jumping in one frame — that
                  // instant jump was what made the tabs/panel below visibly
                  // detach from it, since only a discrete size change like
                  // that (not a `layout="position"` reposition) needs its
                  // own transition to not be felt downstream. Targets
                  // miniSlotHeight (a measured pixel number), never the
                  // string "auto" — see its comment above.
                  <motion.div
                    key="mini-session-slot"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: miniSlotHeight ?? "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: PILL_TRAVEL_MS / 1000, ease: SESSION_MORPH_EASE }}
                    // No overflow-hidden here: the mini pill's -mr-4 below
                    // needs to bleed past this box's right edge to cancel
                    // the header's own padding, and CSS won't allow "clip Y
                    // only, stay visible on X" — any non-"visible" value on
                    // one axis silently forces the other from "visible" to
                    // "auto" (which still clips), so it clipped the pill
                    // regardless of which single axis was targeted. Left
                    // fully unclipped instead; the brief height animation
                    // doesn't read as messy without it.
                  >
                    <div ref={miniSlotRef} className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2 -mr-4">
                      <MiniSession
                        elapsedMs={pillElapsed}
                        onPause={pause}
                        disabled={!isRunning}
                        pillVisible={miniPillVisible}
                        pillRef={miniPillRef}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.nav>


          </>
        </div>
        </div>
        {dataToolbar}
      </div>
      {/* Blends the content pane's own border-t (routes/index.tsx) under
          whichever tab is active — see the tabBlend effect above for why
          this has to live outside data-status-bar's overflow-hidden rather
          than as a child of the active tab itself. */}
      {tabBlend && (
        <div
          aria-hidden
          className="fixed z-40 h-px bg-background pointer-events-none"
          style={{ top: tabBlend.top, left: tabBlend.left, width: tabBlend.width }}
        />
      )}
      {/* The pill's own travel shape — carries real digits (not an empty
          outline) so the clock reads as the same object shrinking and
          moving, not a blank placeholder. Animated with real numeric
          top/left/width/height/font-size targets (not layoutId), so the
          duration is actually honored. Rendered outside data-status-bar's
          overflow-hidden so position:fixed isn't clipped. */}
      <AnimatePresence>
        {visualTravelActive && pillTravelRect && (() => {
          const toMini = pillView === "mini";
          const digitPx = { from: toMini ? 30 : 14, to: toMini ? 14 : 30 };
          const digitColor = {
            from: toMini ? TIMER_MORPH_DIGIT_MINI : TIMER_MORPH_DIGIT_FULL,
            to: toMini ? TIMER_MORPH_DIGIT_FULL : TIMER_MORPH_DIGIT_MINI,
          };
          const buttonPx = { from: toMini ? 56 : 28, to: toMini ? 28 : 56 };
          const borderColor = {
            from: toMini ? TIMER_MORPH_BORDER_MINI : TIMER_MORPH_BORDER_FULL,
            to: toMini ? TIMER_MORPH_BORDER_FULL : TIMER_MORPH_BORDER_MINI,
          };
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
              className="fixed z-50 flex items-stretch rounded-full border-2 bg-white pointer-events-none overflow-hidden"
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-red-400/80 ring-2 ring-inset ring-red-400/80 rounded-xl">
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
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
            >
              Continue Session Safely
              <Play className="size-4" fill="currentColor" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={endOpen}
        onOpenChange={(open) => {
          setEndOpen(open);
          if (!open) {
            setIncompleteOpen(true);
            setCompleteOpen(true);
            setUntouchedOpen(true);
          }
        }}
      >
        {/* max-h/overflow so a review with several open sections scrolls as
            a whole rather than getting clipped by the viewport — same
            2rem-total margin convention the width already uses (see
            w-[calc(100%-2rem)]), just applied to height too. Each
            section's own list still caps and scrolls independently (see
            ReviewSection) — this is just the outer safety net for when
            multiple sections are open at once. */}
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto border-2 border-green-400/80 ring-2 ring-inset ring-green-400/80 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle className="text-green-600">End Session & Graph Data</DialogTitle>
            <DialogDescription className="text-left">
              {hasAnyReviewData
                ? "Review what's been recorded before submitting."
                : "Are you sure? This will end the current session and submit collected data for graphing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {incompleteCards.length > 0 && (
              <ReviewSection
                icon={<TriangleAlert className="size-4 text-amber-500" />}
                label="Did Not Meet Minimums"
                count={incompleteCards.length}
                subtitle="and will be discarded/not graphed"
                open={incompleteOpen}
                onToggle={() => setIncompleteOpen((v) => !v)}
              >
                {incompleteCards.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEndOpen(false);
                        onNavigateToCard?.(c.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg bg-stone-50 hover:bg-stone-100 active:bg-stone-100 px-2.5 py-2 text-left transition-colors"
                    >
                      <ReviewFigure title={c.title} value={c.value} unit={c.unit} />
                    </button>
                  </li>
                ))}
              </ReviewSection>
            )}
            {completeCards.length > 0 && (
              <ReviewSection
                icon={<CheckCircle2 className="size-4 text-green-600" />}
                label="Good Data"
                count={completeCards.length}
                subtitle="and will be graphed."
                open={completeOpen}
                onToggle={() => setCompleteOpen((v) => !v)}
              >
                {completeCards.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2">
                    <ReviewFigure title={c.title} value={c.value} unit={c.unit} />
                  </li>
                ))}
              </ReviewSection>
            )}
            {untouchedCards.length > 0 && (
              <ReviewSection
                icon={<Ban className="size-4 text-red-500" />}
                label="No Data"
                count={untouchedCards.length}
                subtitle="and will not be logged."
                open={untouchedOpen}
                onToggle={() => setUntouchedOpen((v) => !v)}
              >
                {untouchedCards.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                    <span className="shrink-0 [&>svg]:size-3.5">{DATA_TYPE_INFO[c.kind].icon}</span>
                    <span className="break-words">{c.title}</span>
                  </li>
                ))}
              </ReviewSection>
            )}
          </div>
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
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full"
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


function ActiveDurationIndicator({
  timers,
  activeTab,
  onTabChange,
}: {
  timers: { id: string; label: string; scrollTo: () => void; activate?: () => void }[];
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
}) {
  // Switching the Data tab's display mode (list/card/grid) remounts every
  // card, which briefly unregisters and re-registers each running timer —
  // without this grace window `timers` would bounce to empty and back for
  // that one frame, flashing this indicator away and back instead of
  // staying put the way the rest of the header does through that same
  // transition.
  const [displayedTimers, setDisplayedTimers] = useState(timers);
  const timersRef = useRef(timers);
  timersRef.current = timers;
  useEffect(() => {
    if (timers.length > 0) {
      setDisplayedTimers(timers);
      return;
    }
    const id = window.setTimeout(() => {
      if (timersRef.current.length === 0) setDisplayedTimers([]);
    }, 300);
    return () => window.clearTimeout(id);
  }, [timers]);

  const [index, setIndex] = useState(0);
  const count = displayedTimers.length;
  const visible = count > 0;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const handleClick = () => {
    if (count === 0) return;
    if (activeTab !== "data") onTabChange("data");
    const next = index % count;
    displayedTimers[next]?.scrollTo();
    displayedTimers[next]?.activate?.();
    setIndex((i) => (count > 0 ? (i + 1) % count : 0));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="duration-indicator"
          onClick={handleClick}
          aria-label={count > 1 ? `Jump to next running timer (${count} active)` : `Jump to running timer`}
          title={count > 1 ? `${count} timers running — tap to cycle` : displayedTimers[0]?.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          // A plain tween, not a spring — this sits directly inside the tab
          // nav, and a bouncy/oscillating mount here was what made the nav
          // (and, by extension, the panel it's grouped with) read as
          // animating independently instead of staying visually locked to
          // it during transitions.
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex items-center gap-1.5 justify-center px-2 py-1.5 sm:py-2 cursor-pointer text-blue-500 hover:text-blue-600 transition-colors"
        >
          <span className="relative inline-flex">
            <span className="inline-block animate-pulse-scale">
              <Timer className="size-4" />
            </span>
            {count > 1 && (
              <sup className="text-[9px] font-semibold leading-none -ml-1 -mt-0.5">
                {count}
              </sup>
            )}
          </span>
          {/* Only where there's room to spare — a phone-width tab bar is
              already tight with five icon+label tabs, but tablet/desktop
              have space beside them for this to read as a sentence instead
              of a bare icon. */}
          <span className="hidden md:inline text-xs font-medium whitespace-nowrap">
            {count > 1 ? "Timers Running" : "Timer Running"}
          </span>
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
  const labelColor = isSaving || isDirty ? "text-blue-600" : "text-muted-foreground";

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
          // z-[70]: same reasoning as DataToolbar's own filter popover — the
          // sticky toolbar below sits at z-[60], so this content (default
          // z-50) needs to paint above that or its "Saved by" pill sits
          // underneath the toolbar and its clicks get intercepted there.
          className="relative z-[70] w-72 rounded-xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
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
          <div className="relative px-5 pt-4 pb-2 border-b border-border bg-white rounded-t-xl">
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
              <PersonPill name="Perry Plat" />
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
  startingNew = false,
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
  startingNew?: boolean;
  onPlay: () => void;
  onStartNew: () => void;
  onEnd: () => void;
  onRequestDiscard: () => void;
}) {
  const isPaused = status === "paused";
  const label = isPaused ? "Session Paused:" : "Previous Session:";
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
        {/* Crossfades with the plain label below rather than just fading to
            blank — gives the reset-to-zero spin (see OdometerDigits' `slow`
            prop) something to read as "in progress" instead of a silent
            pause. */}
        <div className="relative">
          <motion.span
            animate={{ opacity: startingNew ? 1 : 0 }}
            initial={false}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-blue-600 whitespace-nowrap"
            aria-hidden={!startingNew}
          >
            Starting New Session
          </motion.span>
          <motion.span
            animate={{ opacity: dimmed ? 0 : 1 }}
            initial={false}
            transition={{ duration: 0.2 }}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </motion.span>
        </div>

        <motion.div
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={false}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1 leading-tight"
        >
          {contextTime && (
            <span className="text-[10px] text-muted-foreground text-center tabular-nums whitespace-nowrap">
              {formatRelativeFromNow(contextTime)}{"\u00a0"}({formatMDY(contextTime)}) by{"\u00a0"}
              <PersonPill name="Perry Plat" size="sm" />
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
              <OdometerDigits text={formatTime(elapsedMs)} slow={startingNew} />
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
 * (colons never do), rather than the whole string just replacing itself.
 * `slow` swaps the snappy per-tick spring for a slower, duration-based roll —
 * used only for the reset-to-zero spin on a fresh session start, so that
 * moment reads as an actual spin instead of the same quick flip a normal
 * per-second tick gets. */
function OdometerDigits({ text, className, slow = false }: { text: string; className?: string; slow?: boolean }) {
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
              transition={
                slow
                  ? { duration: DIGIT_SETTLE_MS / 1000, ease: [0.4, 0, 0.2, 1] }
                  : { type: "spring", stiffness: 420, damping: 32 }
              }
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
