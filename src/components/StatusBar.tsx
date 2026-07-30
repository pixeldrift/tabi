import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
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
  CheckCircle2,
  ChevronDown,
  Ban,
  CircleSlash2,
  User,
  LockKeyholeOpen,
} from "lucide-react";
import { InfoIcon } from "./icons/InfoIcon";
import { PersonPill } from "./StaffDirectory";
import {
  markInitialLayoutSettled,
  useInitialLayoutSettled,
} from "@/hooks/use-initial-layout-settle";
import {
  useSession,
  CURRENT_STAFF_NAME,
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
import { useSettings } from "@/components/SettingsContext";
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
  /** The header's own back arrow — returns to the welcome screen (see
   *  routes/index.tsx's screen-slide wiring). There's no "sessions list" to
   *  go back to in this single-client prototype; this is the app's only
   *  other screen. */
  onBack: () => void;
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
// ExpandedSessionBox's own action-button row (Start New Session <-> End &
// Submit/Discard) animates its height over this long whenever `isPaused`
// flips — see that component's own comment on why it's a measured pixel
// number, not "auto".
const ACTIONS_HEIGHT_MS = 250;

/** One collapsible group in the end-session review (Minimums Not Met /
 *  Good Data / No Data) — a colored icon + label + count and its subtitle
 *  on one header line, same twirldown chevron as AccordionRow (About Me's
 *  notes, the teaching-procedure accordion in card detail drawers), with
 *  its list indented underneath so it reads as the summary's children
 *  rather than a sibling. No scroll of its own — the dialog's single
 *  outer scroll area is what moves, so opening several sections at once
 *  doesn't nest one scrollbar inside another. */
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
  /** Short, faded continuation of the header line — what actually happens
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
          {label} <span className="font-bold text-foreground">({count})</span>{" "}
          <span className="font-normal text-muted-foreground/70">{subtitle}</span>
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr] mt-1.5" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-1.5 pl-[22px]">{children}</ul>
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
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
          {unit}
        </div>
      </div>
    </>
  );
}

export function StatusBar({
  activeTab,
  onTabChange,
  title = "Phineas Flynn's Data Sheet",
  onBack,
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
    requestResume,
    requestDiscard,
    activeTimers,
    saveStatus,
    lastSavedAt,
    forceSync,
    lastUpdated,
    startedByName,
    lastEndedByName,
    presentStaffNames,
    isSessionMine,
    joinSession,
    reviewModeUnlocked,
    setReviewModeUnlocked,
    isAbandoned,
    previousSessionMs,
    previousSessionEndedAt,
  } = useSession();
  // The pill travel overlay's digit/border colors are theme-aware (see
  // actionColors.ts's own comment) — need the current theme to pick the
  // right pair, not just the "mini" ones, which stay stone in every theme.
  const { colorTheme } = useSettings();

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

  // previousSessionMs/previousSessionEndedAt (and which of the 4 session
  // states this load landed on) now come from SessionContext's own
  // useLayoutEffect-timed random-state simulator, which commits before the
  // first paint — so unlike the plain-useEffect randomizer this replaced,
  // there's no longer a visible "Previous Session" row (or running/paused
  // box) growing in a beat after mount to wait out. Marking the shared
  // settle flag (see its own comment) right on mount is enough now; every
  // layout-tracked sibling in the "session-bar" LayoutGroup can turn its
  // own tracking on immediately instead of waiting on a reflow that no
  // longer happens.
  useEffect(() => {
    markInitialLayoutSettled();
  }, []);

  const isRunning = status === "running";
  // Not plain `isRunning` — a running session that isn't yours yet stays
  // on the big pill (see SessionContext's own `collapsed`/`isMineAndRunning`
  // comment) rather than collapsing, so everything below that decides what
  // the box is currently showing needs to agree with that same condition,
  // not just whether the timer happens to be running.
  const isMineAndRunning = isRunning && isSessionMine;

  // Which staff name and timestamp the box attributes its content to,
  // depending on why it's showing at all: idle shows the previous,
  // already-submitted session (lastEndedByName/previousSessionEndedAt);
  // paused or running-but-not-yet-joined shows whoever started THIS one
  // (startedByName), timestamped by lastUpdated (when it was started, or
  // most recently paused/resumed).
  const attributionName = status === "idle" ? lastEndedByName : startedByName;
  const rawContextTime = status === "idle" ? previousSessionEndedAt : lastUpdated;
  // Resuming un-hides this row (it's only absent while paused) the instant
  // `status` flips to "running" — which, for a staged resume, lands well
  // before the box has actually started collapsing (see boxCollapsed's own
  // delay below). Left live, that briefly grows boxNaturalHeight mid-fade,
  // which the nav/tabs below dutifully track — reading as the whole header
  // bouncing down and then sharply back up once the collapse catches up.
  // Since the box is headed for a full collapse to zero anyway the moment
  // it's mine-and-running, there's nothing to gain by growing it first:
  // frozen here, it keeps showing whatever it last showed while genuinely
  // paused/idle/not-yet-joined until the box needs it again. Keyed on
  // `isMineAndRunning` (not plain `isRunning`) so a running-but-not-joined
  // session keeps updating live the whole time it's still visible in the
  // big box, only freezing once joining actually starts the collapse.
  const frozenContextTimeRef = useRef(rawContextTime);
  if (!isMineAndRunning) frozenContextTimeRef.current = rawContextTime;

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
  const hasAnyReviewData =
    incompleteCards.length + completeCards.length + untouchedCards.length > 0;
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
  //
  // ExpandedSessionBox's own action-button row lives inside this same
  // wrapper and animates ITS OWN height over ACTIONS_HEIGHT_MS whenever
  // isPaused flips (see its own comment) — a real CSS/Motion height tween,
  // not an instant snap, so `scrollHeight` keeps reporting a different,
  // still-climbing number on basically every frame of that inner animation,
  // not just once at the start and once at the end. Left alone, the
  // ResizeObserver below fires on every one of those frames too, so this
  // box's OWN height animation kept getting retargeted mid-flight toward a
  // constantly-receding number — which read as a long stall (chasing a
  // target that kept moving) followed by an abrupt catch-up jump once the
  // inner transition finally stopped changing. Guessing a fixed suppression
  // window didn't hold up — real click-to-paint latency (and the inner
  // ResizeObserver's own firing cadence) varies enough that a timer either
  // fired too early (still mid-contamination) or added needless lag.
  // actionsRowSettlingRef instead tracks the REAL thing: suppressed exactly
  // while isPaused's own height tween is in flight, and released the moment
  // Motion itself reports that tween complete (via onActionsHeightSettled,
  // passed down to the actions row's own onAnimationComplete) — no guessing.
  const boxWrapRef = useRef<HTMLDivElement>(null);
  const [boxNaturalHeight, setBoxNaturalHeight] = useState<number | null>(null);
  const actionsRowSettlingRef = useRef(false);
  const wasPausedForActionsRef = useRef(status === "paused");
  useLayoutEffect(() => {
    const isPaused = status === "paused";
    if (isPaused === wasPausedForActionsRef.current) return;
    wasPausedForActionsRef.current = isPaused;
    actionsRowSettlingRef.current = true;
  }, [status]);
  const handleActionsHeightSettled = useCallback(() => {
    actionsRowSettlingRef.current = false;
    const el = boxWrapRef.current;
    if (el) setBoxNaturalHeight(el.scrollHeight);
  }, []);
  useLayoutEffect(() => {
    const el = boxWrapRef.current;
    if (!el) return;
    const measure = () => {
      if (actionsRowSettlingRef.current) return;
      setBoxNaturalHeight(el.scrollHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The big pill's own inline button is 3 different actions depending on
  // why the pill is even showing (see ExpandedSessionBox's own isPaused/
  // isSessionMine-driven icon): resume a genuinely paused session, join
  // someone else's already-running one, or — while idle — nothing at all.
  // There's no "continue the previous session" action anymore: that
  // session already ended & got submitted, so picking it back up isn't
  // resuming anything, it's just starting a new one — Start New Session
  // (below) is idle's one clear action instead. See the README roadmap's
  // own writeup of the 4 session states this reflects.
  const requestPlay = () => {
    if (status === "paused") requestResume();
    else if (isRunning && !isSessionMine) joinSession();
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
  // Only surfaced once you've actually joined (isMineAndRunning) — before
  // that, whoever's running it is already named front-and-center in the
  // big expanded box itself (see ExpandedSessionBox), so a second "who's
  // here" signal in the header would just be redundant.
  const otherPresentStaffNames = isMineAndRunning
    ? presentStaffNames.filter((n) => n !== CURRENT_STAFF_NAME)
    : [];
  const [pillView, setPillView] = useState<"big" | "mini">(isMineAndRunning ? "mini" : "big");
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
    // Reads the OLD `pillView` (this render's, before the setPillView below
    // updates it) rather than deriving "which pill was showing" from
    // isRunning/isMineAndRunning — joining a not-mine running session
    // travels FROM the big pill even though isRunning was already true
    // throughout, so isRunning alone can't tell the two apart.
    const fromEl = pillView === "mini" ? miniPillRef.current : bigPillRef.current;
    if (!fromEl) {
      setPillView(isMineAndRunning ? "mini" : "big");
      return;
    }
    pillTravelFromRef.current = fromEl.getBoundingClientRect();
    setPillTravelRect(null);
    setVisualTravelActive(true);
    setPillView(isMineAndRunning ? "mini" : "big");
  }, [pillTraveling, isMineAndRunning, pillView]);

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
    const willCollapseAfterLanding =
      pillView === "mini" && collapsed && !boxCollapsed && (boxNaturalHeight ?? 0) > 0;
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
  const [tabBlend, setTabBlend] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
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
        <div
          ref={statusBarRef}
          data-status-bar
          className="relative overflow-hidden bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <div className={cn("max-w-5xl mx-auto px-4", isRunning ? "pt-1" : "pt-2")}>
            {/* Title row — static, never scales or layout-animates */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 pt-1">
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back to welcome screen"
                  title="Back to welcome screen"
                  className="grid place-items-center size-8 -ml-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <h1 className="min-w-0 font-display text-base sm:text-lg leading-tight truncate">
                  {title}
                </h1>
              </div>

              {/* -mr-4/pr-1.5/pr-2: same trick the mini session pill's own
                  slot uses (see its comment below) to cancel this row's
                  px-4 edge padding and re-add a smaller one instead — keeps
                  the cloud icon's own right margin matching the mini pill's,
                  rather than sitting noticeably further from the edge. */}
              <div className="pt-1 pr-1.5 sm:pr-2 -mr-4">
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
                animate={{
                  height: boxCollapsed ? 0 : (boxNaturalHeight ?? "auto"),
                  opacity: boxCollapsed ? 0 : 1,
                }}
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
                    attributionName={attributionName}
                    isSessionMine={isSessionMine}
                    isAbandoned={isAbandoned}
                    reviewModeUnlocked={reviewModeUnlocked}
                    onToggleReviewMode={() => setReviewModeUnlocked(!reviewModeUnlocked)}
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
                    onActionsHeightSettled={handleActionsHeightSettled}
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
                className={cn(
                  "flex items-end justify-between gap-2 -mb-px",
                  isRunning ? "mt-1" : "mt-1.5",
                )}
                role="tablist"
                aria-label="Session sections"
              >
                <div className="flex items-end gap-0.5 sm:gap-1 -ml-3">
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
                  <ActiveDurationIndicator
                    timers={runningTimers}
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                  />
                  <PresenceIndicator otherStaffNames={otherPresentStaffNames} />
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
        {visualTravelActive &&
          pillTravelRect &&
          (() => {
            const toMini = pillView === "mini";
            const digitFull = TIMER_MORPH_DIGIT_FULL[colorTheme];
            const borderFull = TIMER_MORPH_BORDER_FULL[colorTheme];
            const digitPx = { from: toMini ? 30 : 14, to: toMini ? 14 : 30 };
            const digitColor = {
              from: toMini ? TIMER_MORPH_DIGIT_MINI : digitFull,
              to: toMini ? digitFull : TIMER_MORPH_DIGIT_MINI,
            };
            const buttonPx = { from: toMini ? 56 : 28, to: toMini ? 28 : 56 };
            const borderColor = {
              from: toMini ? TIMER_MORPH_BORDER_MINI : borderFull,
              to: toMini ? borderFull : TIMER_MORPH_BORDER_MINI,
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
              Are you sure? This will end the current session and discard any data collected during
              the session so far!
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
        {/* Fixed height (not just a max) — a wider vertical margin than the
            width's own 2rem-total (see w-[calc(100%-2rem)]) because mobile
            Safari's collapsing address/tab bar means the visible viewport
            shrinks after load; 100dvh (not 100vh) already tracks that, but
            the extra rem of slack on top keeps the dialog from reading as
            clipped in the brief window before/if that chrome re-expands.
            So the dialog consistently fills most of the viewport instead
            of shrink-wrapping to content and forcing more scrolling than
            it needs to. flex-col + the scroll area's
            own flex-1 min-h-0 keeps the title and buttons pinned in place
            while only the middle content scrolls — one scrollbar for the
            whole list, not one per section (see ReviewSection). Header
            keeps its default gap-4 down to the scroll area (its own
            border-b already reads as a clear boundary there), but the
            gap down to the footer is zeroed (gap-0 below) and remade on
            the header side only via the scroll area's own mt-4 — so the
            scroll area's bottom edge butts straight up against the
            footer's border-t with nothing in between. Otherwise a plain
            gap of matching background sat between wherever the list
            happened to clip and that divider line, reading as an
            unexplained dead zone rather than a real boundary. */}
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm h-[calc(100dvh-4rem)] flex flex-col gap-0 overflow-hidden border-2 border-green-400/80 ring-2 ring-inset ring-green-400/80 rounded-xl">
          <DialogHeader className="text-left sm:text-left shrink-0 border-b border-border pb-4">
            <DialogTitle className="text-green-600">End Session & Graph Data</DialogTitle>
            <DialogDescription className="text-left">
              {hasAnyReviewData
                ? "Review what's been recorded before submitting."
                : "Are you sure? This will end the current session and submit collected data for graphing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 mt-4">
            {incompleteCards.length > 0 && (
              <ReviewSection
                icon={<Ban className="size-4 text-red-500" />}
                label="Minimums Not Met"
                count={incompleteCards.length}
                subtitle="will not graph"
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
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2"
                  >
                    <ReviewFigure title={c.title} value={c.value} unit={c.unit} />
                  </li>
                ))}
              </ReviewSection>
            )}
            {untouchedCards.length > 0 && (
              <ReviewSection
                icon={<CircleSlash2 className="size-4 text-amber-500" />}
                label="No Data"
                count={untouchedCards.length}
                subtitle="and will not be logged."
                open={untouchedOpen}
                onToggle={() => setUntouchedOpen((v) => !v)}
              >
                {untouchedCards.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
                  >
                    <span className="shrink-0 [&>svg]:size-3.5">{DATA_TYPE_INFO[c.kind].icon}</span>
                    <span className="break-words">{c.title}</span>
                  </li>
                ))}
              </ReviewSection>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4 flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
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
          aria-label={
            count > 1 ? `Jump to next running timer (${count} active)` : `Jump to running timer`
          }
          title={count > 1 ? `${count} timers running — tap to cycle` : displayedTimers[0]?.label}
          layout="position"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          // A plain tween, not a spring — this sits directly inside the tab
          // nav, and a bouncy/oscillating mount here was what made the nav
          // (and, by extension, the panel it's grouped with) read as
          // animating independently instead of staying visually locked to
          // it during transitions. Also covers the `layout` prop's own
          // position tween above — this and PresenceIndicator slide smoothly
          // over into each other's spot as either one mounts/unmounts,
          // instead of the survivor jumping straight to its new position.
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex items-center gap-1.5 justify-center px-1 py-1.5 sm:py-2 cursor-pointer text-blue-500 hover:text-blue-600 transition-colors"
        >
          <span className="relative inline-flex">
            <span className="inline-block animate-pulse-scale">
              <Timer className="size-4" />
            </span>
            {/* `absolute`, not a normal inline sibling — appearing/
                disappearing (1 timer vs. 2+) must never change this span's
                own width and shove neighboring header icons/the mini
                session pill sideways, independent of the `layout` slide
                above (which is only for THIS indicator's own mount/unmount,
                not for a badge count changing while already mounted). */}
            {count > 1 && (
              <sup className="pointer-events-none absolute -top-1 -right-1.5 text-[9px] font-semibold leading-none">
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

/** The header's own "someone else is also in this session" signal — same
 *  spot/shape as ActiveDurationIndicator right beside it, shown once
 *  you've joined (or started) a running session AND at least one other
 *  staff member is also present. Always opens the same roster popover
 *  (rather than a direct single-profile shortcut for exactly one other
 *  person) since the roster itself always includes you too now — never
 *  truly a "just one entry" list once you're counted in it. */
function PresenceIndicator({ otherStaffNames }: { otherStaffNames: string[] }) {
  const visible = otherStaffNames.length > 0;
  // You're always in "this session" too, once this is showing at all —
  // listed last since the others are the actually-new information a
  // technician taps this to see; you already know you're here.
  const rosterNames = [...otherStaffNames, CURRENT_STAFF_NAME];

  const trigger = (
    // The count badge is `absolute`, not a normal inline sibling — its own
    // appearing/disappearing (1 other vs. 2+) must never change this span's
    // width and shove neighboring header icons sideways, the same
    // "spacing shouldn't depend on the badge" fix applied to
    // ActiveDurationIndicator's identical badge below.
    <span className="relative inline-flex">
      <User className="size-4" fill="currentColor" strokeWidth={0} />
      {otherStaffNames.length > 1 && (
        // Tucked in closer than the timer icon's identical badge needs to
        // be — the User glyph has more empty space in its own top-right
        // corner than the Timer icon's circle does, so the same offset
        // that sits flush against the timer reads as a gap floating away
        // from this one.
        <sup className="pointer-events-none absolute -top-0.5 -right-1 text-[9px] font-semibold leading-none">
          {otherStaffNames.length}
        </sup>
      )}
    </span>
  );
  const label = otherStaffNames.length > 1 ? "Others Here" : "Also Here";
  const ariaLabel =
    otherStaffNames.length > 1
      ? `${otherStaffNames.length} other staff also in this session`
      : `${otherStaffNames[0]} is also in this session`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="presence-indicator"
          layout="position"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          // Same plain tween as ActiveDurationIndicator right beside it —
          // see its own comment on why a spring reads as this indicator
          // animating independently of the nav it's grouped with. Also
          // covers the `layout` prop's own position tween above — sliding
          // smoothly over whenever ActiveDurationIndicator appears/
          // disappears beside it, instead of jumping straight to its new
          // spot.
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                title={otherStaffNames.join(", ")}
                className="relative flex items-center gap-1.5 justify-center px-1 py-1.5 sm:py-2 text-blue-500 hover:text-blue-600 transition-colors"
              >
                {trigger}
                <span className="hidden md:inline text-xs font-medium whitespace-nowrap">
                  {label}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={10}
              collisionPadding={16}
              className="relative z-[70] w-56 rounded-xl border-2 border-blue-400 bg-white p-3 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
            >
              {/* Radix's own Arrow — see SaveIndicator's matching one for
                  why (tracks the trigger's real position instead of a
                  static offset that drifts whenever the header's layout
                  changes width upstream of it). Radix's own default
                  triangle — see SaveIndicator's matching one for why not
                  an asChild-swapped shape. */}
              <PopoverPrimitive.Arrow
                width={14}
                height={7}
                strokeWidth={2}
                className="fill-white stroke-blue-400"
              />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                In this session
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rosterNames.map((n) => (
                  <PersonPill key={n} name={n} size="sm" />
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
          {/* Radix's own Arrow, not a hand-placed span — it tracks the
              trigger's actual center (and any collision-driven shift)
              itself, via the Popper positioning this Content already uses,
              rather than a static offset that reads right only for
              whatever the header's layout happened to measure the day it
              was tuned and silently drifts out of alignment the next time
              anything upstream of it changes width. Left as Radix's own
              default triangle (not asChild-swapped for a rotated-square
              diamond, as the other popups here used to try) — a custom
              asChild shape doesn't pick up Radix's own per-side rotation
              correctly (it composes with, rather than replaces, whatever
              rotation the shape already carries), so it only ever looked
              right for the one side it happened to be tuned against. The
              plain triangle rotates correctly for every side automatically,
              including a collision-driven flip to a side other than the
              one requested. */}
          <PopoverPrimitive.Arrow
            width={14}
            height={7}
            strokeWidth={2}
            className="fill-white stroke-blue-400"
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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
              </div>
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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Last Saved
              </div>
              <div className="tabular-nums leading-tight">
                <div>{formatFullDate(lastSavedAt)}</div>
                <div>{formatFullTime(lastSavedAt)}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Saved by
              </div>
              <PersonPill name={CURRENT_STAFF_NAME} />
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
          "relative grid place-items-center size-7 transition-colors",
          isDirty ? "cursor-pointer" : "cursor-default",
        )}
      >
        <CloudShape
          className={cn(
            "absolute inset-0 size-7",
            cloudColorClass,
            isDirty && "hover:text-blue-600",
          )}
        />
        <SymbolIcon
          className={cn("relative text-white", isSaving ? "size-2" : "size-2.5")}
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

function formatFullDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  if (diff < 86400000) {
    const wholeHours = Math.floor(diff / 3600000);
    const remMinutes = Math.floor((diff % 3600000) / 60000);
    return remMinutes > 0 ? `${wholeHours}hr ${remMinutes}min ago` : `${wholeHours}hr ago`;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today.getTime() - that.getTime()) / 86400000);
  const timeStr = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
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
  attributionName,
  isSessionMine,
  isAbandoned,
  reviewModeUnlocked,
  onToggleReviewMode,
  renderPill = true,
  pillVisible = true,
  pillRef,
  dimmed = false,
  startingNew = false,
  onPlay,
  onStartNew,
  onEnd,
  onRequestDiscard,
  onActionsHeightSettled,
}: {
  status: SessionStatus;
  elapsedMs: number;
  contextTime: Date | null;
  /** Who to credit in the "by X" line — last person to submit (idle) or
   *  whoever started the session (paused / running-not-mine). Never the
   *  current user's own join, since joining doesn't change who "owns" it. */
  attributionName: string | null;
  /** True whenever the current user could collapse this box back into the
   *  running mini pill (i.e. they started it, or already joined it) — false
   *  means someone else is running it and the only action here is to join. */
  isSessionMine: boolean;
  /** A running-not-mine session nobody has touched in a while — swaps the
   *  label to flag it instead of just reading as ordinarily busy. */
  isAbandoned: boolean;
  reviewModeUnlocked: boolean;
  onToggleReviewMode: () => void;
  renderPill?: boolean;
  pillVisible?: boolean;
  pillRef?: React.RefObject<HTMLDivElement | null>;
  dimmed?: boolean;
  startingNew?: boolean;
  onPlay: () => void;
  onStartNew: () => void;
  onEnd: () => void;
  onRequestDiscard: () => void;
  /** Fires once the action-button row's own height tween below actually
   *  finishes (Motion's real onAnimationComplete, not a guessed timer) — see
   *  StatusBar's own boxNaturalHeight comment for why the outer box needs
   *  this signal instead of just watching scrollHeight live. */
  onActionsHeightSettled?: () => void;
}) {
  const isIdle = status === "idle";
  const isPaused = status === "paused";
  // The only other possibility once this box is even rendered (it's hidden
  // whenever the session is running AND ours — see StatusBar's `collapsed`):
  // running, but started/joined by someone else.
  const isRunningNotMine = status === "running" && !isSessionMine;
  const label = isIdle
    ? "Previous Session:"
    : isPaused
      ? "Session Paused:"
      : isAbandoned
        ? "Session Unattended:"
        : "Currently Running:";
  // The attribution sentence's verb — unified across every state instead of
  // each one having its own bespoke phrasing: idle credits whoever last
  // submitted (the session was "Saved"), paused credits whoever parked it,
  // and both running variants credit whoever originally started it (the
  // bold label above already carries the mine-vs-not/abandoned distinction,
  // so this doesn't need to re-encode it).
  const attributionVerb = isIdle ? "Saved" : isPaused ? "Paused" : "Started";
  const ease = SESSION_MORPH_EASE;
  // Gray only while genuinely idle and showing a leftover previous-session
  // value — once paused (this session's own time) or once a start/resume has
  // been pressed (about to become live), it reads as black.
  const digitsGray = status === "idle" && !dimmed;

  // Motion's "auto" height resolution wasn't reliable here (the collapse
  // kept resolving in under 40ms instead of easing over 250) — measuring
  // the real pixel height ourselves and animating between two concrete
  // numbers (never "auto") sidesteps that entirely. actionsRef sits on a
  // plain, never-height-animated wrapper INSIDE the motion.div below, not
  // on the motion.div itself — see that div's own comment for why: an
  // element's scrollHeight can't reveal a SMALLER new content size while
  // its own explicit height is still the old, larger one (nothing
  // overflows it, so the browser just echoes that height back), which
  // silently broke this measurement specifically for the "shrinking"
  // direction (e.g. resume's paused 2-button set collapsing to 1 button).
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsHeight, setActionsHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (actionsRef.current) {
      setActionsHeight(actionsRef.current.scrollHeight);
    }
  }, [isPaused, isRunningNotMine]);

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
            className="absolute top-0 left-1/2 -translate-x-1/2 text-sm font-bold uppercase tracking-wider text-blue-600 whitespace-nowrap"
            aria-hidden={!startingNew}
          >
            Starting New Session
          </motion.span>
          <motion.span
            animate={{ opacity: dimmed ? 0 : 1 }}
            initial={false}
            transition={{ duration: 0.2 }}
            className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
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
            <span className="inline-flex items-baseline gap-1 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              <span>{attributionVerb}</span>
              {attributionName && (
                <>
                  <span>by</span>
                  <PersonPill name={attributionName} size="sm" />
                </>
              )}
              <span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
                    >
                      {formatRelativeFromNow(contextTime)}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="center"
                    sideOffset={10}
                    collisionPadding={12}
                    className="relative z-[70] w-auto rounded-lg border-2 border-blue-400 bg-white px-3 py-1.5 text-xs tabular-nums leading-snug whitespace-nowrap shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
                  >
                    {/* Radix's own default triangle — see SaveIndicator's
                      matching one for why not an asChild-swapped shape; it
                      rotates itself correctly for this popup's
                      side="right" placement automatically. */}
                    <PopoverPrimitive.Arrow
                      width={14}
                      height={7}
                      strokeWidth={2}
                      className="fill-white stroke-blue-400"
                    />
                    {/* Two lines — date, then time underneath — rather than
                      one long mm/dd/yyyy hh:mm:ss string. */}
                    <div>{formatExactDate(contextTime)}</div>
                    <div>{formatExactTime(contextTime)}</div>
                  </PopoverContent>
                </Popover>
                .
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
              <OdometerDigits text={formatTime(elapsedMs)} slow={startingNew} />
            </span>
            {/* No button at all once truly idle — there's nothing to
                resume/join, only "Start New Session" below, per the
                "no restarting a finished session" mental model. */}
            {!isIdle && (
              <button
                onClick={onPlay}
                aria-label={isPaused ? "Resume session" : "Join session"}
                className="btn-bevel grid place-items-center w-14 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0 active:scale-95 active:brightness-90"
              >
                <span className="grid place-items-center">
                  {isPaused ? (
                    <Play className="size-5" fill="currentColor" strokeWidth={0} />
                  ) : (
                    // Tried a custom "two lanes merging into an arrow" glyph
                    // first (see JoinSessionIcon) — at this button's actual
                    // 20px size the merge curves and the arrowhead both just
                    // read as a plain ">>", so a single clean arrow reads
                    // more clearly here.
                    <ArrowRight className="size-5" strokeWidth={2.5} />
                  )}
                </span>
              </button>
            )}
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
        animate={{ opacity: dimmed ? 0 : 1, height: actionsHeight ?? "auto" }}
        transition={{ duration: ACTIONS_HEIGHT_MS / 1000, ease }}
        onAnimationComplete={onActionsHeightSettled}
        className="overflow-hidden"
      >
        {/* Measured (not the motion.div above) — scrollHeight on an element
            that ITSELF carries the animated explicit height can't detect a
            SMALLER new content size: a browser reports scrollHeight as at
            least the element's own current height whenever content doesn't
            overflow it, so mid-shrink (e.g. resume's 2-button paused set
            collapsing back to 1 button) it just echoed back the still-large
            OLD height instead of the new, smaller natural one — silently
            stalling this row's own animation at its previous peak size
            until something unrelated (dimmed finally clearing) forced a
            correction far later. This plain, unconstrained wrapper is never
            itself height-animated, so its scrollHeight always reflects the
            CURRENT content's true natural size regardless of what height
            the motion.div above happens to be mid-transition to — the same
            "measure via an unconstrained child" pattern boxWrapRef already
            uses for the outer box, for the exact same reason. */}
        <div ref={actionsRef} className="flex flex-col gap-1">
          {isPaused && (
            <>
              <button
                onClick={onEnd}
                className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
              >
                End & Submit Data
                <Upload className="size-3.5" strokeWidth={2.5} />
              </button>
              {/* Parked sessions default to locked so nothing on a session
                  someone else may resume gets edited by accident — this is
                  the one, intentional action that unlocks editing without
                  restarting the (stopped) session timer. */}
              <button
                onClick={onToggleReviewMode}
                aria-pressed={reviewModeUnlocked}
                className={cn(
                  "shrink-0 flex items-center justify-center gap-1.5 rounded-full h-8 text-xs font-medium px-3 w-full border transition-colors active:scale-95",
                  reviewModeUnlocked
                    ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                    : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50",
                )}
              >
                {reviewModeUnlocked ? "Review Mode Unlocked" : "Unlock Review Mode"}
                <LockKeyholeOpen className="size-3.5" />
              </button>
              <button
                onClick={onRequestDiscard}
                className="shrink-0 flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors active:scale-95"
              >
                End & Discard Session!
                <Trash2 className="size-3" />
              </button>
            </>
          )}
          {isIdle && (
            <button
              onClick={onStartNew}
              className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
            >
              Start New Session
              <RefreshCw className="size-3.5" strokeWidth={2.5} />
            </button>
          )}
          {/* isRunningNotMine: no action here at all — join via the pill
              button above first, then pause/end become available once it's
              yours (isSessionMine flips and this box stops rendering in
              favor of the running mini pill/box). */}
        </div>
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

// The exact stamp behind a session box's relative-time link (see its own
// Popover) — standard mm/dd/yyyy hh:mm:ss, always zero-padded/12-hour so it
// reads as a fixed-width, unambiguous instant rather than the loosely
// human-scaled text next to it.
function formatExactDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatExactTime(d: Date) {
  const h24 = d.getHours();
  const hh = String(((h24 + 11) % 12) + 1).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${hh}:${min}:${ss} ${ampm}`;
}

// Hour is a single, unpadded digit — a session can't run longer than a
// clinic's office hours, so it never reaches double digits.
function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Renders a fixed-format time string as an odometer: each character sits in
 * its own slot and rolls vertically only when that position's value changes
 * (colons never do), rather than the whole string just replacing itself.
 * `slow` swaps the snappy per-tick spring for a slower, duration-based roll —
 * used only for the reset-to-zero spin on a fresh session start, so that
 * moment reads as an actual spin instead of the same quick flip a normal
 * per-second tick gets. */
function OdometerDigits({
  text,
  className,
  slow = false,
}: {
  text: string;
  className?: string;
  slow?: boolean;
}) {
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
