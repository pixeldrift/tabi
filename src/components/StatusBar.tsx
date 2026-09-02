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
import { DailyIcon } from "./icons/DailyIcon";
import { MergeArrowIcon } from "./icons/MergeArrowIcon";
import { ExitIcon } from "./icons/ExitIcon";
import { PersonPill, staffName } from "./StaffDirectory";
import { TailSwish } from "./TailSwish";
import {
  markInitialLayoutSettled,
  useInitialLayoutSettled,
} from "@/hooks/use-initial-layout-settle";
import {
  useSession,
  CURRENT_STAFF_ID,
  HEADER_MORPH_MS,
  BOX_COLLAPSE_MS,
  DIGIT_SETTLE_MS,
  PILL_TRAVEL_MS,
  SESSION_TRANSITION_SPEED,
  type SaveStatus,
  type SessionStatus,
  type TransitionKind,
} from "./SessionContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
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
import { formatTimeOfDayForDisplay } from "@/components/TimeOfDayKeypad";

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
  /** True once this screen is no longer `display: none` — i.e. the instant
   *  the welcome->main slide starts, well before it's fully landed. See
   *  routes/index.tsx's own comment: this component mounts (and takes its
   *  one-time "measure my natural size" reads) immediately, while still
   *  hidden behind the welcome screen — those reads only get a real number
   *  once this flips true, and without treating that first real number as
   *  a plain snap, it read as the header visibly growing into place during
   *  the slide instead of already being static when it appears. */
  mainVisible: boolean;
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

// Exported so SettingsPane's own "Default tab" picker can render the exact
// same icon+label pairing rather than a second, driftable copy of it.
export const TABS: { id: StatusTab; label: string; icon: ComponentType<{ className?: string }> }[] =
  [
    { id: "info", label: "Client Info", icon: InfoIcon },
    { id: "data", label: "Data", icon: ClipboardList },
    { id: "schedule", label: "Schedule", icon: DailyIcon },
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
// The mini pill's fixed shape — everything about it EXCEPT its digits' own
// natural (variable) width. `MINI_DIGIT_PADDING_PX` is the digit span's
// `px-2` (8px each side); `MINI_BUTTON_PX`/`MINI_PILL_HEIGHT_PX` match its
// button's `w-7`/the pill's own `h-7`.
const MINI_DIGIT_PADDING_PX = 16;
const MINI_BUTTON_PX = 28;
const MINI_PILL_HEIGHT_PX = 28;
// The big pill's fixed button width (`w-14`) and height (`h-12`) — its
// digit span has no fixed width of its own (`flex-1`, fills whatever the
// button doesn't take), so unlike the mini pill above this needs no
// separate "digit padding" constant.
const BIG_BUTTON_PX = 56;
// ExpandedSessionBox's own action-button row (Start New Session <-> End &
// Submit/Discard) animates its height over this long whenever `isPaused`
// flips — see that component's own comment on why it's a measured pixel
// number, not "auto".
const ACTIONS_HEIGHT_MS = 250 * SESSION_TRANSITION_SPEED;
// The box's content fading OUT (starting/joining/resuming — on its way to
// collapsing into the mini pill) reads as a graceful retreat, not an
// abrupt cut, at a slower pace than ACTIONS_HEIGHT_MS above (which still
// needs to stay snappy — it also drives the isPaused button-SET's own
// real content swap, unrelated to dimming) — paired with a subtle
// scale-down so the buttons visibly recede rather than just vanish in
// place. `ENTER_SCALE` is the reverse direction's counterpart: pausing
// (the box expanding back out) gets its own entrance instead of just
// being static content the growing box happens to reveal, scaling up
// from slightly smaller.
const ACTIONS_DIM_MS = 450 * SESSION_TRANSITION_SPEED;
const ACTIONS_DIM_SCALE = 0.94;
// The label/context line and the actions row both replay a fresh
// ENTER_SCALE/opacity-0 -> 1/1 entrance (keyed on `expandGen`) every time the
// box re-opens (pause), starting the instant it does — same simultaneous
// timing as the box's own expand and the pill's own travel (see
// SessionContext's `pillTraveling` effect), rather than waiting for the pill
// to actually land first. The big pill is a descendant of the box, not a
// sibling like the mini pill, so nothing here needs to hold back for it.
// Longer than it looks like it needs to be: on a fresh pause-open, this
// whole row is clipped inside the outer box's own SESSION_MORPH_MS-long
// height reveal (see the box height motion.div's comment), so the lower
// buttons aren't scrolled into view until late in that reveal. A fade any
// shorter finishes before then, so by the time those buttons are finally
// uncovered they're already fully opaque — reading as a pop-in, not a
// fade. Held past SESSION_MORPH_MS so there's still visible fade left once
// the last button is revealed.
const ACTIONS_REVEAL_MS = SESSION_MORPH_MS + 250;
const ENTER_SCALE = 0.94;
// How long to keep treating this screen as "just became visible" (see
// `hasBeenVisible`/`suppressEntranceAnimation` below) after the
// welcome->main slide starts — a plain technical settling buffer for
// ResizeObserver measurements to land, not a pacing choice, so unlike the
// constants above it isn't scaled by SESSION_TRANSITION_SPEED.
const VISIBILITY_SETTLE_MS = 500;

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
  mainVisible,
  dataToolbar,
  onNavigateToCard,
}: StatusBarProps) {
  const {
    status,
    elapsedMs,
    pause,
    leaveSession,
    endAndSubmit,
    transitionStage,
    transitionKind,
    collapsed,
    boxCollapsed,
    pillTraveling,
    requestStartNew,
    requestResume,
    requestDiscard,
    activeTimers,
    saveStatus,
    lastSavedAt,
    forceSync,
    lastUpdated,
    startedById,
    lastEndedById,
    presentStaffIds,
    isSessionMine,
    requestJoin,
    reviewModeUnlocked,
    setReviewModeUnlocked,
    isAbandoned,
    previousSessionMs,
    previousSessionEndedAt,
  } = useSession();
  const { catEarsEnabled, tailSwishEnabled } = useSettings();

  // See use-initial-layout-settle's own comment — this box's demo-only
  // "Previous Session" row growing the box shortly after mount is real,
  // one-time growth that the tabs/nav below (and the content pane and
  // Data toolbar, in the shared LayoutGroup) shouldn't animate away from.
  const initialLayoutSettled = useInitialLayoutSettled();

  // True once `mainVisible` has been true for at least VISIBILITY_SETTLE_MS
  // — see that prop's own comment. A flat delay, not "the very next
  // render": becoming visible after sitting hidden doesn't produce one
  // clean measurement, it produces SEVERAL, as different pieces of content
  // (the box's own natural height, the actions row inside it, digit
  // layout, etc.) each get their first real ResizeObserver reading a frame
  // or two apart from each other — suppressing for only the first of those
  // still let the rest animate in as a visible, if smaller, series of
  // jumps. The window just needs to comfortably outlast that settling
  // burst, not match it exactly.
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  useEffect(() => {
    if (!mainVisible) return;
    const id = window.setTimeout(() => setHasBeenVisible(true), VISIBILITY_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [mainVisible]);
  const suppressEntranceAnimation = !initialLayoutSettled || !hasBeenVisible;

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
  const isIdle = status === "idle";
  const isPaused = status === "paused";

  // Which staff member and timestamp the box attributes its content to,
  // depending on why it's showing at all: idle shows the previous,
  // already-submitted session (lastEndedById/previousSessionEndedAt);
  // paused or running-but-not-yet-joined shows whoever started THIS one
  // (startedById), timestamped by lastUpdated (when it was started, or
  // most recently paused/resumed).
  const attributionStaffId = status === "idle" ? lastEndedById : startedById;
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
  // Only ever opened from the mini pill's own pause button, and only when
  // otherPresentStaffIds is non-empty (see that click handler) — pausing a
  // session nobody else is in has nothing to ask about.
  const [pauseOrLeaveOpen, setPauseOrLeaveOpen] = useState(false);
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
  // Gray only while genuinely idle and showing a leftover previous-session
  // value — once paused (this session's own time) or once a start/resume has
  // been pressed (about to become live), it reads as black.
  const digitsGray = isIdle && !dimmed;
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
  const prevBoxCollapsedForActionsRef = useRef(boxCollapsed);
  useLayoutEffect(() => {
    const isPaused = status === "paused";
    const isPausedChanged = isPaused !== wasPausedForActionsRef.current;
    wasPausedForActionsRef.current = isPaused;
    // `boxCollapsed` itself only catches up to `status`/`collapsed` a commit
    // later (it's mirrored via a plain `useEffect` in SessionContext, not
    // computed directly during render), so "isPaused just flipped" and "the
    // box just opened" are two SEPARATE commits for a pause, not one — this
    // can't be a single combined check the way `openedFresh` used to assume
    // (that version updated `wasPausedForActionsRef` on the isPaused-change
    // commit, before `boxCollapsed` had caught up, then early-returned on
    // the later, box-actually-opened commit before ever reading it — always
    // missing the fast path below and silently falling back to suppression
    // for the whole transition).
    const boxJustOpened = !boxCollapsed && prevBoxCollapsedForActionsRef.current;
    prevBoxCollapsedForActionsRef.current = boxCollapsed;
    if (boxJustOpened) {
      // The box opening fresh from collapsed — whether into paused (whose
      // actions row skips its own tween for exactly this case, see its own
      // `key={expandGen}`/`initial={false}`, and `pausedActionsHeight`'s
      // comment for why the target is already known) or into running-not-
      // mine (leaveSession — no actions row at all to tween) — never has an
      // inner animation to chase in this same commit; the content is
      // already at its final height the instant it appears. Suppressing
      // and waiting on `onActionsHeightSettled` instead would be waiting on
      // a completion event for an animation that never actually ran —
      // Motion doesn't reliably fire `onAnimationComplete` for a value that
      // started (via `initial={false}`) already at its target, which left
      // this suppressed forever (confirmed: exactly what leaveSession hit
      // before this was broadened past isPaused alone — boxNaturalHeight
      // stayed stuck at whatever it was before collapsing, leaving a big
      // dead gap between the box's real content and the tabs below).
      actionsRowSettlingRef.current = false;
      const el = boxWrapRef.current;
      if (el) setBoxNaturalHeight(el.scrollHeight);
      return;
    }
    // Every OTHER isPaused flip (the box staying open while its content
    // swaps, e.g. paused -> idle without collapsing in between) still gets
    // a real, gradual inner tween, so still needs the suppress-then-settle
    // dance.
    if (isPausedChanged) actionsRowSettlingRef.current = true;
  }, [status, boxCollapsed]);
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

  // Bumped once every time the box transitions from collapsed back to
  // expanded (pausing — the only route back into the big box that skips
  // `dimmed` entirely, since it's a plain, unstaged action) — keys the
  // label/context and actions-row's own entrance animation below (see
  // ENTER_SCALE's own comment), forcing a fresh initial->animate replay
  // each time rather than the static "instantly revealed by the growing
  // box" look those pieces had before.
  //
  // A `useLayoutEffect`, not the same-render "adjust during render" pattern
  // `wasPausedForActionsRef` above uses — this one used to mutate
  // `prevBoxCollapsedForEntranceRef` directly in the render body too, but
  // this component ALSO has `prevBoxCollapsedForSettleRef` right above
  // doing the identical dance off the same `boxCollapsed` transition. Two
  // separate render-phase `setState` calls firing off the same prop change
  // in the same render, each restarting the render themselves, measurably
  // corrupted this one in practice: `expandGen` was confirmed (via direct
  // instrumentation) to sometimes commit back at its PRE-bump value instead
  // of the bumped one, later in the same transition, with no explanation
  // under React's documented single-restart model for this pattern — not
  // provably root-caused beyond that, but reliably reproducible. A
  // dependency-scoped effect sidesteps the whole class of restart
  // interactions: it can't run mid-render, so nothing about a sibling
  // render-phase update can touch it. The cost is a one-commit lag before
  // this fires relative to `boxCollapsed` itself flipping — imperceptible
  // next to the box's own SESSION_MORPH_MS reveal, which hasn't even
  // started painting a visible height yet at that point.
  const prevBoxCollapsedForEntranceRef = useRef(boxCollapsed);
  const [expandGen, setExpandGen] = useState(0);
  useLayoutEffect(() => {
    if (boxCollapsed === prevBoxCollapsedForEntranceRef.current) return;
    prevBoxCollapsedForEntranceRef.current = boxCollapsed;
    if (!boxCollapsed) setExpandGen((g) => g + 1);
  }, [boxCollapsed]);

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
    else if (isRunning && !isSessionMine) requestJoin();
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

  // The pill is now a SINGLE, permanently-mounted element (see
  // SessionPill's own comment below) instead of three (a resting big pill,
  // a resting mini pill, and a manually-animated travel clone crossfading
  // between whichever two of those were relevant) — there's no "from" to
  // snapshot and no handoff to time, since the one real element simply
  // keeps existing and Motion animates its own current rendered state
  // toward whatever the new target is. All that's left to compute here is
  // WHERE the two resting targets currently are.
  //
  // `bigPillAnchorRef` is an invisible, permanently-mounted spacer inside
  // ExpandedSessionBox, sized exactly like the big pill (`h-12 w-full`) —
  // it's a DESCENDANT of the box, so the box's own `overflow-hidden` clip
  // during its height tween only affects paint, never layout: its
  // `getBoundingClientRect()` already reflects its real, fully-expanded
  // final position from the very first frame, regardless of how far the
  // box's own height tween has actually gotten.
  //
  // `pillAnchorContainerRef` is the pill's OWN positioned ancestor (the
  // outer `relative shrink-0` wrapper around the whole header block, see
  // its own JSX below) — bigPillRect/miniPillRect below store top/left
  // relative to THIS container, not raw viewport pixels, and the pill
  // itself is `position: absolute` (not `fixed`) against it. Earlier
  // attempts used real viewport-fixed positioning (a `position:fixed` pill,
  // briefly even portaled to document.body) specifically to escape
  // data-status-bar's own `overflow-hidden` clip — but `position:fixed`
  // computes relative to the nearest ANCESTOR with a `transform` (the
  // welcome->main slide wrapper counts, even mid-transition) and is immune
  // to genuine page/body scroll, neither of which is true for this
  // container: it moves exactly however the header moves — during the
  // slide, on real scroll, however — since it's an ordinary descendant of
  // whatever's moving it, with nothing "fixed" about it. A container-
  // relative offset (targetRect.top - containerRect.top) stays correct
  // through all of that automatically, without needing to know why the
  // container moved. It still needs to be OUTSIDE data-status-bar's own
  // `overflow-hidden` (a sibling of it, not a descendant — see the pill's
  // own render site below) to escape that clip, which is what makes this
  // a separate, dedicated ancestor rather than data-status-bar itself.
  const pillAnchorContainerRef = useRef<HTMLDivElement>(null);
  const bigPillAnchorRef = useRef<HTMLDivElement>(null);
  const [bigPillRect, setBigPillRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const el = bigPillAnchorRef.current;
    const containerEl = pillAnchorContainerRef.current;
    if (!el || !containerEl) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      // Relative to pillAnchorContainerRef, not raw viewport pixels — see
      // that ref's own comment for why.
      setBigPillRect({
        top: r.top - containerRect.top,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
      });
    };
    measure();
    // ResizeObserver catches any later change to the anchor's own box (its
    // width tracks the container's, since it's `w-full`) for the life of
    // the mount — no polling loop needed once the pill is positioned
    // relative to its own container instead of the viewport (see that
    // ref's comment): there's no slide-timing race left to poll through,
    // just the ordinary case of a real layout change, which is exactly
    // what ResizeObserver already reports natively. The one gap a resize
    // observer can't cover — the very first layout pass landing wrong
    // because a web font hadn't swapped in yet, changing text metrics
    // without changing this anchor's own box size — is handled by
    // `document.fonts.ready` instead of a blind poll: a one-time, real
    // signal for exactly the condition being waited on, not a guess at how
    // many frames it might take.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // `isRunning` re-triggers this for the same reason miniPillRect's own
    // effect below now does: this anchor sits inside the header's
    // `isRunning ? "pt-1" : "pt-2"` padded wrapper (see that div's own
    // comment), which shifts the anchor's POSITION the instant a session
    // starts/stops running anywhere (not just "mine") without changing the
    // anchor's own SIZE — invisible to a plain ResizeObserver.
  }, [isRunning]);

  // Mini pill's resting target isn't anchored to a real mini-pill element
  // at all — it's derived from two OTHER, always-present layout facts (the
  // title row's own bottom edge, the save indicator's own right edge) plus
  // one small measured anchor purely for the digits' own natural width
  // (`miniDigitAnchorRef`, an invisible copy of just the digit text — the
  // rest of the mini pill's shape, height and button width, are fixed
  // constants). Neither of the two position facts depends on the session
  // box's current (possibly mid-collapse) height, so the target is
  // correct immediately, not something that needs to be predicted and
  // re-predicted as some OTHER element's own natural height settles on
  // its own separate schedule.
  const titleRowRef = useRef<HTMLDivElement>(null);
  const saveIndicatorWrapRef = useRef<HTMLDivElement>(null);
  const miniDigitAnchorRef = useRef<HTMLSpanElement>(null);
  // NotificationBar renders between the title row and the tabs/mini-slot
  // nav below — an alert (e.g. a phase-change banner) popping in while a
  // session's already running-mine adds real height there, in normal
  // document flow, independent of anything about the session box's own
  // collapse timing (which is why it isn't folded into the box-height
  // caveat above). Without accounting for it, the mini pill's own `top`
  // stayed pinned just below the title row regardless of whether a banner
  // was showing, so it sat on top of the banner instead of below it.
  const notificationBarWrapRef = useRef<HTMLDivElement>(null);
  const [miniPillRect, setMiniPillRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const titleRowEl = titleRowRef.current;
    const saveIndicatorWrapEl = saveIndicatorWrapRef.current;
    const digitEl = miniDigitAnchorRef.current;
    const notificationBarWrapEl = notificationBarWrapRef.current;
    const containerEl = pillAnchorContainerRef.current;
    if (!titleRowEl || !saveIndicatorWrapEl || !digitEl || !notificationBarWrapEl || !containerEl) {
      return;
    }
    const measure = () => {
      const titleRowRect = titleRowEl.getBoundingClientRect();
      const saveIndicatorWrapRect = saveIndicatorWrapEl.getBoundingClientRect();
      const digitWidth = digitEl.getBoundingClientRect().width;
      const containerRect = containerEl.getBoundingClientRect();
      // Lands flush with the nav row's own bottom edge (rather than the
      // nav row's own `mt-1` further down) so the pill's own bottom edge
      // clears the content pane below with a visible gap instead of
      // sitting flush against it — the reserved mini slot (see
      // miniSlotRef) is a few px taller than the pill itself specifically
      // to leave room for this.
      //
      // Uses the notification wrapper's own HEIGHT, not its live BOTTOM
      // position — the wrapper renders AFTER the session box in document
      // flow, so its bottom edge is only where it "should" be once the box
      // has actually settled at its target height. Mini is only ever the
      // active pillView while that target is 0 (collapsed) — start-new/
      // join/resume all land there — but the box's own collapse takes real
      // time to visually finish, and mid-flight its current height can
      // still be most of the way to its expanded size. Reading the
      // notification wrapper's live bottom during that window measured
      // "title row + box's still-mostly-expanded height + banner", sending
      // the pill target diving toward the content pane before correcting
      // back up as the box actually finished collapsing — a real dip that
      // showed up as an unwanted bounce on resume in particular. Adding
      // the wrapper's own height to the title row's bottom instead assumes
      // the box is already at its target (0) unconditionally, which is
      // exactly the assumption that's always true whenever mini matters.
      // The trailing `- 2` is a manual visual nudge (per feedback the pill
      // still read as sitting slightly too low relative to the nav row
      // beside it), not derived from any of the measured boxes above.
      const top =
        titleRowRect.bottom +
        notificationBarWrapEl.getBoundingClientRect().height -
        containerRect.top -
        2;
      // The wrapper's OWN border-box right edge sits at the viewport edge
      // (its `-mr-4` cancels this row's own right padding entirely) — its
      // `pr-1.5`/`sm:pr-2` is what actually pulls its CHILD in from there,
      // so the anchor needs to subtract that same padding back out to
      // land where the mini pill actually sits, not where the wrapper's
      // own box ends. Read via getComputedStyle (not a hardcoded 6px) so
      // it stays correct across the sm: breakpoint too.
      const saveIndicatorPaddingRight =
        parseFloat(getComputedStyle(saveIndicatorWrapEl).paddingRight) || 0;
      const right = saveIndicatorWrapRect.right - saveIndicatorPaddingRight - containerRect.left;
      // MINI_DIGIT_PX/MINI_BUTTON_PX below — the digit span's own px-2
      // horizontal padding (matching MINI_DIGIT_PADDING_PX) plus the fixed
      // button width is the mini pill's total width; MINI_PILL_HEIGHT_PX
      // is its fixed h-7.
      const width = digitWidth + MINI_DIGIT_PADDING_PX + MINI_BUTTON_PX;
      setMiniPillRect({ top, left: right - width, width, height: MINI_PILL_HEIGHT_PX });
    };
    measure();
    // ResizeObserver on every element this measurement actually reads —
    // native, event-driven, and permanent for the life of the mount — plus
    // one native `document.fonts.ready` correction for the one thing a
    // resize observer can't see (text metrics shifting when a web font
    // swaps in without any of these boxes changing size). See bigPillRect's
    // own comment for why this replaced a manual per-frame poll.
    const ro = new ResizeObserver(measure);
    ro.observe(titleRowEl);
    ro.observe(saveIndicatorWrapEl);
    ro.observe(digitEl);
    ro.observe(notificationBarWrapEl);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // `isRunning` is a real dependency, not just an exhaustive-deps
    // formality: the header's own top padding (`isRunning ? "pt-1" :
    // "pt-2"`, see its own JSX below) shifts titleRowEl's POSITION the
    // instant a session starts/stops running, without changing titleRowEl's
    // own SIZE — a plain ResizeObserver never fires for a position-only
    // shift on an ancestor's padding, so without this the very first
    // measurement after that flip (and every one after, until some
    // unrelated resize/font-ready event happens to force a re-measure)
    // stayed pinned to whatever `top` was computed before the flip, landing
    // the mini pill a few px off from the nav row it's supposed to sit
    // flush against. Re-running this whole effect on that flip forces a
    // fresh, correct read the moment it matters instead of waiting on an
    // event that was never guaranteed to fire again.
  }, [isRunning]);

  // Same "never animate to the literal string auto" fix as boxNaturalHeight/
  // actionsHeight above — Motion's own "auto" resolution re-measures
  // whenever this slot's content shifts, and can settle at a value below
  // its final height before correcting back up, which read as the nav
  // bouncing. A ResizeObserver-measured pixel number never does that.
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

  // Only surfaced once you've actually joined (isMineAndRunning) — before
  // that, whoever's running it is already named front-and-center in the
  // big expanded box itself (see ExpandedSessionBox), so a second "who's
  // here" signal in the header would just be redundant.
  const otherPresentStaffIds = isMineAndRunning
    ? presentStaffIds.filter((id) => id !== CURRENT_STAFF_ID)
    : [];
  // Which resting target the pill is currently headed for — flips the
  // instant `pillTraveling` (SessionContext's shared, purely-timed window)
  // opens, same as before. `pillTraveling`'s own timing already encodes
  // the one real ordering constraint (pause waits for the box to grow
  // before its landing spot exists) — StatusBar doesn't need its own copy
  // of that delay logic, just to react to the shared clock.
  const [pillView, setPillView] = useState<"big" | "mini">(isMineAndRunning ? "mini" : "big");
  const prevPillTravelingRef = useRef(pillTraveling);
  useLayoutEffect(() => {
    if (pillTraveling === prevPillTravelingRef.current) return;
    prevPillTravelingRef.current = pillTraveling;
    if (!pillTraveling) return;
    setPillView(isMineAndRunning ? "mini" : "big");
  }, [pillTraveling, isMineAndRunning]);

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
      // Inset 1px from each edge — the ear SVG's side walls render with
      // their own ~1px of ink starting exactly at the tab's own left/right
      // edge (not straddling it), so a patch sized to the full tabRect
      // erased the border under the walls themselves, leaving a gap
      // instead of a joint. Insetting leaves the border showing through
      // right where each wall is, so it reads as one continuous outline
      // turning the corner rather than a wall floating above a gap.
      setTabBlend({ top: barRect.bottom, left: tabRect.left + 1, width: tabRect.width - 2 });
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
      {/* Single shared container for the header proper (title, box,
          notifications, tabs) AND the Data tab's own toolbar below it —
          `dataToolbar` renders here as a plain, normal-flow sibling rather
          than an independently `position: sticky` element computing its own
          `top` off this box's height. That earlier approach needed a
          ResizeObserver/rAF bridge just to keep two SEPARATE sticky
          elements in sync with each other; putting them in the one
          container means there's nothing left to keep in sync — the
          browser lays both out together on every reflow for free, the same
          way it already does for the title row and the tabs below it.
          `shrink-0`, not `sticky` — this now sits above a fixed-height,
          internally-scrolling content pane (the app-shell layout in
          IndexInner), so it never needs to pin itself against page scroll;
          it just needs to not get squashed by the flex column it lives in. */}
      <div ref={pillAnchorContainerRef} className="relative shrink-0">
        <div
          ref={statusBarRef}
          data-status-bar
          className="relative overflow-hidden bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <div className={cn("max-w-5xl mx-auto px-4", isRunning ? "pt-1" : "pt-2")}>
            {/* Title row — static, never scales or layout-animates. Also
                doubles as a stable anchor for the pill-travel overlay's
                "landing in mini" target (see pillTravelAnchorTopRef/
                pillTravelAnchorRightRef below) — its own height doesn't
                depend on the session box's current (possibly mid-collapse)
                height the way measuring the mini pill's own current rect
                did, so it's not subject to the same staleness the box's
                own natural-height prediction was. */}
            <div ref={titleRowRef} className="flex items-start justify-between gap-3">
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
                  rather than sitting noticeably further from the edge. Also
                  doubles as the pill-travel anchor's own right reference —
                  since this wrapper and the mini slot's own share the exact
                  same right-side classes by design, ITS OWN CHILD's right
                  edge (not this div's own border-box, which the `-mr-4`
                  already extends all the way to the viewport edge) already
                  IS the mini pill's own eventual right edge, without
                  needing to duplicate the sm: breakpoint math in JS — the
                  prediction effect reads this wrapper's own computed
                  padding-right to get from its border-box back to that
                  child edge. */}
              <div ref={saveIndicatorWrapRef} className="pt-1 pr-1.5 sm:pr-2 -mr-4">
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onSync={forceSync} />
              </div>
            </div>

            {/* Invisible, permanently-mounted (unlike the real mini-session
                slot below, which only mounts once `pillView` is "mini") —
                exists purely so the mini target's own rect (see
                miniPillRect's own comment) is measurable from the very
                first render, before the pill has ever traveled anywhere.
                Zero footprint: `h-0 overflow-hidden` clips its own layout
                contribution to nothing, `pointer-events-none` keeps it out
                of the way. */}
            <div className="h-0 overflow-hidden pointer-events-none" aria-hidden>
              <span
                ref={miniDigitAnchorRef}
                className="inline-block text-sm leading-none font-medium"
              >
                <OdometerDigits text={formatTime(pillElapsed)} />
              </span>
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
                        // Quick, decisive snap once it finally starts. For a
                        // fresh start (still staged — see requestStartNew),
                        // this doesn't begin until DIGIT_SETTLE_MS +
                        // HEADER_MORPH_MS after commit, by which point the
                        // pill has already landed and the box's own content
                        // has long since faded (stage 1's `dimmed`) — so
                        // there's nothing left to see except the space
                        // closing up. For resume/join (no longer staged —
                        // see requestResume's own comment), this starts on
                        // the SAME instant as everything else instead: the
                        // pill is still mid-travel toward its own fixed
                        // anchor (unaffected by this box's own height, see
                        // that travel's own comment) while this collapses
                        // and its content fades right along with it via the
                        // opacity transition below — one motion, not a
                        // beat that waits for the pill to land first.
                        height: { duration: BOX_COLLAPSE_MS / 1000, ease: SESSION_MORPH_EASE },
                        opacity: { duration: (BOX_COLLAPSE_MS / 1000) * 0.6 },
                      }
                    : {
                        // Opacity starts together with height rather than
                        // after a delay, same as the collapsed branch.
                        // Zeroed instead while `suppressEntranceAnimation` is
                        // still true (see its own and `hasBeenVisible`'s
                        // comments): `boxNaturalHeight`'s very first real
                        // measurement lands a beat after mount, once the
                        // demo-only "Previous Session" row appears, AND can't
                        // land at all until this screen is genuinely visible
                        // (not `display: none`) — without zeroing for both,
                        // this box played its own real SESSION_MORPH_MS grow
                        // on every page load, or during the welcome->main
                        // slide, and every layout-tracked sibling below it
                        // (correctly) tracked that real, continuous reflow
                        // live, reading as the whole header/toolbar visibly
                        // settling in a beat after everything else — or, for
                        // the slide, animating into place during what should
                        // have been a static, already-formed slide-in. Any
                        // LATER, genuine height change (an actual session
                        // collapsing/expanding) still gets the real transition.
                        //
                        // Ease is PILL_TRAVEL_EASE here, not SESSION_MORPH_EASE
                        // (unlike the collapsed branch above) — this expand
                        // runs concurrently with the pill's own big<->mini
                        // travel on pause (same duration, since SESSION_MORPH_MS
                        // === PILL_TRAVEL_MS), and the two curves need to match
                        // stride for stride, not just finish together. Pausing's
                        // landing spot sits below wherever the tab bar ends up
                        // once this box has grown to fit it: SESSION_MORPH_EASE's
                        // more even curve had this box still mostly closed while
                        // PILL_TRAVEL_EASE's front-loaded curve had the pill
                        // already most of the way to a target the tab bar hadn't
                        // vacated yet, so the pill visibly crossed over it
                        // mid-flight despite both finishing at the same instant.
                        height: suppressEntranceAnimation
                          ? { duration: 0 }
                          : { duration: SESSION_MORPH_MS / 1000, ease: PILL_TRAVEL_EASE },
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
                    attributionStaffId={attributionStaffId}
                    isSessionMine={isSessionMine}
                    isAbandoned={isAbandoned}
                    reviewModeUnlocked={reviewModeUnlocked}
                    onToggleReviewMode={() => setReviewModeUnlocked(!reviewModeUnlocked)}
                    bigPillAnchorRef={bigPillAnchorRef}
                    dimmed={dimmed}
                    expandGen={expandGen}
                    suppressEntranceAnimation={suppressEntranceAnimation}
                    transitionKind={dimmed ? transitionKind : null}
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

              <div ref={notificationBarWrapRef}>
                <NotificationBar />
              </div>

              {/* Tabs row + mini session (when running) */}
              <nav
                className={cn(
                  "flex items-end justify-between gap-2 -mb-px",
                  isRunning ? "mt-1" : "mt-1.5",
                )}
                role="tablist"
                aria-label="Session sections"
              >
                <div className="flex items-end gap-0.5 sm:gap-1 -ml-3" data-tour="tab-bar">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    const isActive = t.id === activeTab;
                    // Actual mobile-vs-desktop switch happens in CSS (sm:hidden on the
                    // svg itself, so it survives a resize without a JS breakpoint check)
                    // — this just gates whether the ear markup renders at all.
                    const isMobileCatEars = isActive && catEarsEnabled;
                    return (
                      <button
                        key={t.id}
                        ref={(el) => {
                          if (el) tabButtonRefs.current.set(t.id, el);
                          else tabButtonRefs.current.delete(t.id);
                        }}
                        role="tab"
                        aria-selected={isActive}
                        data-tour={`tab-${t.id}`}
                        onClick={() => onTabChange(t.id)}
                        className={cn(
                          // rounded-t-sm (down from -md, originally -lg) so the
                          // ear-less corner rounding reads consistently with the
                          // SVG ear shape's own much smaller corner-join radius
                          // below, rather than clashing between tabs.
                          "relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-t-sm border border-b-0 transition-[color,background-color,opacity] duration-300",
                          isActive
                            ? cn(
                                "text-foreground font-medium",
                                // The ear-bearing SVG below paints its own fill+stroke
                                // for the whole tab+ears silhouette (a plain CSS border
                                // can't trace the ear points, only the button's own
                                // rectangle — see the ears' own comment) — so at mobile
                                // widths this box's own background/border step aside
                                // and let the SVG be the only thing visible. sm: and up,
                                // where ears never show, the ordinary box paints as before.
                                isMobileCatEars
                                  ? "bg-transparent border-transparent sm:bg-background sm:border-border"
                                  : "bg-background border-border",
                              )
                            : "bg-stone-200/70 text-muted-foreground border-transparent hover:text-foreground hover:bg-stone-200",
                        )}
                      >
                        {isMobileCatEars && (
                          // One continuous stroked path for the tab body AND the ears —
                          // a CSS border can only ever trace this button's own rectangle,
                          // so it can't follow the ear points or the valley between them;
                          // an SVG path is the only way to get a single outline around the
                          // whole silhouette. Percentage viewBox + non-scaling-stroke keeps
                          // the border a constant width regardless of this tab's own size.
                          // Geometry pixel-traced from the reference mockup JPG (each
                          // ear's outline sampled column-by-column, decimated to ~13
                          // points per side) rather than hand-authored — the earlier
                          // hand-built versions (a symmetric valley-notch, then a
                          // corner-to-corner bump) both missed the reference's actual
                          // silhouette: no valley — the top stays flat between the ears —
                          // and each ear itself is asymmetric (a short rise from the wall
                          // straight into the peak, then a longer, shallower curve back
                          // down to the flat top), which reads as a proper curl rather
                          // than a symmetric bump. Plain straight-line segments rather
                          // than bezier curves — with ~13 points per side the polyline
                          // already reads as smooth once stroke-linejoin="round" (below)
                          // softens each vertex, without the sub-pixel-control-point
                          // problem a single bezier hit at this icon's tiny real size.
                          // Coordinates are scaled so the reference's own wall-to-wall
                          // width maps to this path's full 0-100, and its flat-top level
                          // maps to y=25 (see the wrapper's own -top-2.5 comment for why
                          // 25 is "normal, unraised" here) — note the curve's wall end
                          // sits above y=25 already (the reference has no flat vertical
                          // run before the ear starts), so the peaks rise almost the full
                          // curve height directly from each corner. Open path (no segment
                          // back across the bottom) mirrors this tab's own border-b-0.
                          <div
                            // -top-2.5 (10px): unlike the old corner-flush triangles (which
                            // needed no headroom beyond a hairline nick — a sharp corner
                            // reads as a corner at any height), these curved, centered peaks
                            // need real vertical room for the curve itself to read as
                            // rounded rather than squashed flat. y=25 in the viewBox below
                            // is calibrated to this exact offset (10px extension over a
                            // ~30px-tall mobile tab ≈ 25% of the extended box) as "the real
                            // button edge, unraised" — the shoulders sit there so they meet
                            // the tab's own corners with no visible seam.
                            //
                            // The absolute positioning lives on this plain div, not the
                            // svg directly — an <svg> is a replaced element, and a replaced
                            // element's auto height/width under top+bottom / left+right
                            // insets is resolved from its own intrinsic aspect ratio (here
                            // a square 100x100 viewBox), not by stretching to fill the
                            // gap the way a normal block does. That silently produced a
                            // fixed square box unrelated to this tab's real size. A plain
                            // div stretches correctly, and the svg then just fills it.
                            className="pointer-events-none absolute inset-x-0 -top-2.5 bottom-0 sm:hidden"
                            aria-hidden="true"
                          >
                            <svg
                              // overflow-visible: the side walls sit exactly on the
                              // viewBox edges (x=0 and x=100), so half their stroke
                              // width falls outside it — the default SVG behavior is
                              // to clip there, which thinned out just the sides
                              // (the top curve's points all sit safely inside the
                              // viewBox, so its stroke was never clipped).
                              className="block w-full h-full overflow-visible"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >
                              <path
                                d="M0,100 L0,19.58 L0.49,18.1 L2.46,16.13 L4.43,14.66 L6.4,14.16 L8.37,14.16 L10.34,14.66 L12.32,16.13 L14.29,18.1 L16.26,20.07 L18.23,22.04 L20.2,24.01 L22.17,25 L77.34,25 L79.31,24.51 L81.28,23.03 L83.25,21.06 L85.22,19.09 L87.19,17.12 L89.16,15.64 L91.13,14.66 L93.1,14.16 L95.07,14.66 L97.04,15.64 L99.01,17.12 L100,18.6 L100,100"
                                style={{ fill: "var(--background)", stroke: "var(--border)" }}
                                strokeWidth={1}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            </svg>
                          </div>
                        )}
                        <Icon className={cn("size-4 relative", !isActive && "opacity-60")} />
                        {/* relative (not just static) so this joins the "positioned"
                          paint layer after the ears' own absolutely-positioned svg — a
                          plain static sibling would otherwise paint underneath any
                          absolutely-positioned element regardless of DOM order. */}
                        <span className="relative hidden sm:inline">{t.label}</span>
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
                  <PresenceIndicator otherStaffIds={otherPresentStaffIds} />
                  <TabBarTailSwish
                    // isMineAndRunning (not plain isRunning) — this needs to
                    // agree with the same "am I actually in and driving this
                    // session" condition the mini pill itself collapses to
                    // (see its own comment), not just whether a session
                    // happens to be running for someone else. tailSwishEnabled
                    // folds in here too rather than as a separate condition —
                    // switching the setting off should hide it immediately,
                    // same as leaving the session, not wait on the
                    // icon-reappear delay below either.
                    inSession={isMineAndRunning && tailSwishEnabled}
                    iconOccupied={runningTimers.length > 0 || otherPresentStaffIds.length > 0}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {pillView === "mini" && (
                    // -mr-4 cancels the header's own px-4 edge padding, then
                    // pr-1.5/pr-2 re-adds it to match pb-1.5/pb-2 exactly — same
                    // clearance on the right as there is below the pill. Reserves
                    // its slot in the tabs row whenever the pill's resting
                    // target is mini (which flips the instant travel toward
                    // it begins — see `pillView`'s own comment — so the
                    // space opens up in step with the real persistent pill
                    // heading here, not a beat later). Animating this slot's
                    // OWN height (it used to just pop in) means the nav's
                    // real height grows in smoothly instead of jumping in
                    // one frame — that instant jump was what made the tabs/
                    // panel below visibly detach from it, since only a
                    // discrete size change like that (not a `layout="position"`
                    // reposition) needs its own transition to not be felt
                    // downstream. Targets miniSlotHeight (a measured pixel
                    // number), never the string "auto" — see its comment
                    // above. `initial`/`transition` skip the entrance
                    // entirely while `suppressEntranceAnimation` is true —
                    // this slot can mount for the first time while still
                    // hidden behind the welcome screen (a random initial
                    // state that's already "running, mine"), and since
                    // `initial` is only ever read once, at mount, letting it
                    // request the real grow-from-0 entrance there would
                    // either not progress at all until this screen later
                    // became visible, or (worse) still be captured as
                    // "mid-flight" once it did — either way reading as this
                    // slot animating into place during what should be a
                    // static slide-in.
                    <motion.div
                      key="mini-session-slot"
                      initial={suppressEntranceAnimation ? false : { height: 0, opacity: 0 }}
                      animate={{ height: miniSlotHeight ?? "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: suppressEntranceAnimation ? 0 : PILL_TRAVEL_MS / 1000,
                        ease: SESSION_MORPH_EASE,
                      }}
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
                      {/* Invisible — StatusBar's own single persistent pill
                          (see its own comment) renders the real content;
                          this exists purely to reserve this slot's own
                          height (via miniSlotRef/miniSlotHeight above), a
                          fixed MINI_PILL_HEIGHT_PX regardless of the
                          digits' own natural width (that's measured
                          separately, see miniPillRect's own always-mounted
                          anchor). */}
                      <div
                        ref={miniSlotRef}
                        className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2 -mr-4"
                        style={{ height: MINI_PILL_HEIGHT_PX }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </nav>
            </>
          </div>
        </div>
        {dataToolbar}
        {/* THE session pill — a single element, permanently mounted, that is
            the big pill AND the mini pill AND the thing that travels between
            them, rather than three separate elements (a resting big pill, a
            resting mini pill, and a manually-animated travel clone that
            crossfades into whichever of those two it lands on). That third
            piece existed only because Motion's `layoutId` shared-element
            morph turned out to ignore the configured duration entirely for a
            size delta this large (verified by setting it to 2s and seeing no
            change in pace) — replacing it with a shape animated by real
            numeric top/left/width/height/font-size targets (not layoutId)
            kept timing under actual control. Making that shape the ONLY
            pill, always mounted, keeps that same numeric-target technique
            but removes the swap: there's no "from" to snapshot and no
            handoff to time, since the one real element simply keeps
            existing and Motion animates its own current rendered state
            toward whatever the new target is — which is also what makes the
            old double-visible-pill bug structurally impossible now rather
            than something to avoid hitting.
            `pillTraveling` (SessionContext) already carries every delay this
            needs (pause's own wait for the box to grow first, a fresh
            start's wait for the odometer to settle) — `pillView` only flips
            once that shared clock actually opens, so this never needs its
            own copy of that timing, just a duration for the resulting
            numeric tween. Colors are deliberately plain CSS classes with a
            `transition-colors`, not part of the `animate` target: the
            classes stay theme-aware for free (Tailwind's own `--color-*`
            custom properties respond to the active theme; Motion's color
            interpolation can't resolve a custom property mid-tween the way
            CSS itself can — see actionColors.ts's own comment), and a plain
            CSS transition on a class change animates just as smoothly.
            Rendered as a sibling of data-status-bar (not a descendant) so
            it escapes that container's own overflow-hidden clip, while still
            sharing pillAnchorContainerRef as its positioned ancestor — see
            that ref's own comment for why position:absolute against that
            shared ancestor, not position:fixed, is what actually keeps this
            glued to the header through scrolling and the welcome->main
            slide alike. */}
        {bigPillRect &&
          miniPillRect &&
          (() => {
            const toMini = pillView === "mini";
            const target = toMini ? miniPillRect : bigPillRect;
            const buttonWidth = isIdle ? 0 : toMini ? MINI_BUTTON_PX : BIG_BUTTON_PX;
            const icon = toMini ? (
              // -translate-x-px: nudges toward the pill's own rounded end cap
              // — dead-center in the button's plain rectangle reads slightly
              // right-of-center once the pill's curved edge is taken into
              // account, since the eye weights the icon against that curve,
              // not the rectangle's raw bounds.
              <Pause className="size-3.5 -translate-x-px" fill="currentColor" strokeWidth={0} />
            ) : isPaused ? (
              // Larger than the mini pill's own icon above — this button is
              // BIG_BUTTON_PX (56px), more than double the mini pill's, so a
              // matching size-3.5 read as lost in the middle of it. Sized up
              // without touching BIG_BUTTON_PX itself, which only governs the
              // button's own hit target/pill cutout.
              <Play className="size-6" fill="currentColor" strokeWidth={0} />
            ) : (
              // Two branches merging into one arrow, not a plain forward
              // arrow — this state means someone else already has the
              // session running and tapping it joins you into that same
              // session (see aria-label below), which a bare rightward
              // arrow read as "resume" rather than "merge in."
              <MergeArrowIcon className="size-6" />
            );
            // Pausing with someone else still in the session would stop
            // the timer for them too, which the button's own single tap
            // was never clear about — asking first only when there's
            // actually someone else here to affect (otherPresentStaffIds
            // is only ever non-empty while toMini, so this never fires for
            // the big pill's Resume/Join button, which reuses this same
            // handler).
            const handlePauseClick = () => {
              if (otherPresentStaffIds.length > 0) {
                setPauseOrLeaveOpen(true);
              } else {
                pause();
              }
            };
            // While the pill's own settle-poll (bigPillRect/miniPillRect
            // above) is still finding its footing after mount — the same
            // window StatusBar's other entrance-sensitive layout already
            // treats as a plain snap, not a genuine animated change, see
            // suppressEntranceAnimation's own comment — every intermediate
            // reading it commits should land instantly instead of animating.
            // Without this, the pill visibly chases each poll frame's
            // still-settling value through a real, easing `PILL_TRAVEL_MS`
            // transition — which outlasts the ~450ms welcome->main slide by
            // enough that it keeps sliding for a beat after that slide has
            // already finished, instead of simply being in its resting spot
            // from the first visible frame.
            const pillTransition = suppressEntranceAnimation
              ? { duration: 0 }
              : { duration: PILL_TRAVEL_MS / 1000, ease: PILL_TRAVEL_EASE };
            // `top` gets its OWN transition, separate from left/width/height
            // above, for exactly one case: already resting in mini (not
            // `pillTraveling` — that coordinated big<->mini move still uses
            // the uniform pillTransition for all four, unchanged) and a
            // notification popping in or clearing changes notifWrap's
            // height, which miniPillRect's own top formula reads directly.
            // NotificationBar's `layout` animation on that wrapper is a
            // Motion FLIP: the box's real DOM height (what getBoundingClientRect
            // — and so this formula — actually reads) snaps to its new value
            // in the very first frame, and only the VISUAL smoothing is a
            // transform layered on top; the plain, un-animated `<nav>` right
            // below it reflows off that same real box size, so it snaps
            // instantly too. Chasing that already-final value through our
            // OWN separate eased tween is what reads as lagging behind the
            // tab row — matching NOTIFICATION_AREA_TRANSITION's duration
            // doesn't fix that, since nav isn't actually animating on that
            // duration either; it needs to snap right along with it, not
            // just ease faster. Verified empirically: sampling pillTop
            // against navTop through a live notification's appear/hold/
            // clear cycle, the two move in exact lockstep at every sample
            // once this snaps, with zero drift during the hold. Snapping
            // keeps this pill locked to the exact same real,
            // instantly-updated geometry nav already reflows against.
            const topTransition = toMini && !pillTraveling ? { duration: 0 } : pillTransition;
            const pillCssDurationMs = suppressEntranceAnimation ? 0 : SESSION_MORPH_MS;
            return (
              <motion.div
                className={cn(
                  "absolute z-50 flex items-stretch rounded-full border-2 bg-white overflow-hidden transition-colors",
                  toMini ? "border-blue-500" : "border-stone-300",
                )}
                style={{ transitionDuration: `${pillCssDurationMs}ms` }}
                initial={false}
                animate={{
                  top: target.top,
                  left: target.left,
                  width: target.width,
                  height: target.height,
                }}
                transition={{ top: topTransition, default: pillTransition }}
              >
                <motion.span
                  className={cn(
                    "flex-1 flex items-center justify-center leading-none font-medium transition-colors",
                    toMini ? "px-2 text-blue-700" : "px-3",
                    !toMini && (digitsGray ? "text-stone-400" : "text-stone-800"),
                    // Same pulse as the "Session Paused" label above it —
                    // one shared visual cue for "this is paused", not two
                    // different ones.
                    isPaused && "animate-pulse-gentle",
                  )}
                  style={{ transitionDuration: `${pillCssDurationMs}ms` }}
                  initial={false}
                  animate={{ fontSize: toMini ? 14 : 30 }}
                  transition={pillTransition}
                >
                  <OdometerDigits
                    text={formatTime(pillElapsed)}
                    slow={transitionKind === "start-new"}
                  />
                </motion.span>
                {/* Always mounted — even once truly idle, where there's
                    nothing to resume/join and buttonWidth animates to 0 —
                    rather than conditionally unmounting, so going idle
                    shrinks and fades the button out (and lets the digit
                    span's own `flex-1` reflow smoothly into the freed
                    space) instead of it just vanishing and the digits
                    instantly snapping over to fill the gap. */}
                <motion.span
                  initial={false}
                  animate={{ width: buttonWidth, opacity: isIdle ? 0 : 1 }}
                  transition={pillTransition}
                  aria-hidden={isIdle}
                  // `h-full` alongside the parent's own `items-stretch`, not
                  // instead of it — belt and suspenders. The parent pill's
                  // own height is a Motion-animated inline style, not an
                  // ordinary CSS value the browser lays out once and leaves
                  // alone, and this span's WIDTH is *also* separately
                  // animated (buttonWidth, above) — that combination has
                  // occasionally left this span short of the pill's full
                  // height (a visible white gap under the button, reported
                  // as "the button sits too high"), self-correcting the
                  // next time anything forces a reflow (e.g. resizing the
                  // window). `h-full` pins this span's height directly to
                  // its positioned parent's already-resolved height instead
                  // of leaving it to a live stretch recalculation that
                  // apparently doesn't always rerun on every frame both
                  // dimensions are changing.
                  className="shrink-0 h-full overflow-hidden bg-blue-500 grid place-items-center text-white"
                >
                  <button
                    tabIndex={isIdle ? -1 : 0}
                    onClick={toMini ? handlePauseClick : requestPlay}
                    aria-label={
                      toMini ? "Pause session" : isPaused ? "Resume session" : "Join session"
                    }
                    data-tour={toMini ? "mini-pause-button" : undefined}
                    className="grid place-items-center size-full bg-blue-500 hover:bg-blue-600 text-white transition-colors active:brightness-90"
                  >
                    {/* Scale lives on this inner span, not the button —
                        see the (now-removed) resting big pill's own
                        original comment: the button is a plain rectangle
                        whose edges only look like a rounded pill-cap
                        because the PARENT clips it with
                        `overflow-hidden rounded-full` — scaling the
                        button itself shrinks that rectangle away from
                        the clip boundary on press, revealing the pill's
                        white background around it. */}
                    <span className="grid place-items-center active:scale-95 transition-transform">
                      {icon}
                    </span>
                  </button>
                </motion.span>
              </motion.div>
            );
          })()}
      </div>
      {/* Blends the content pane's own border-t (routes/index.tsx) under
          whichever tab is active — see the tabBlend effect above for why
          this has to live outside data-status-bar's overflow-hidden rather
          than as a child of the active tab itself. h-0.5 (2px) rather than
          the default h-px when cat ears are on — the border there is only
          1px (matching the ears' own stroke, see tabSeamBorderClass in
          routes/index.tsx), but the active tab's own box already sits a
          px or so past data-status-bar's own overflow-hidden edge (a
          pre-existing rounding quirk — extending the ear SVG itself
          further down to compensate does nothing, since anything past
          that edge is clipped before it can render). Doubling the patch
          rather than just matching the 1px covers that slop without
          needing to chase its exact size. sm: drops back to h-px
          alongside the border's own sm:border-t reverting to 1px on
          desktop, where ears never show. */}
      {tabBlend && (
        <div
          aria-hidden
          className={cn(
            "fixed z-40 bg-background pointer-events-none",
            catEarsEnabled ? "h-0.5 sm:h-px" : "h-px",
          )}
          style={{ top: tabBlend.top, left: tabBlend.left, width: tabBlend.width }}
        />
      )}
      <Dialog open={pauseOrLeaveOpen} onOpenChange={setPauseOrLeaveOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xs border-2 border-blue-400/80 ring-2 ring-inset ring-blue-400/80 rounded-xl">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle>Other users are in this session.</DialogTitle>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
            <button
              onClick={() => {
                pause();
                setPauseOrLeaveOpen(false);
              }}
              className="btn-bevel inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-600 text-white text-sm font-medium px-4 transition-colors w-full whitespace-nowrap"
            >
              Pause session for everyone
              <Pause className="size-4 shrink-0" fill="currentColor" strokeWidth={0} />
            </button>
            <span className="text-xs text-muted-foreground text-center">Or</span>
            <button
              onClick={() => {
                leaveSession();
                setPauseOrLeaveOpen(false);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium px-4 transition-colors w-full whitespace-nowrap"
            >
              Exit and leave running
              <ExitIcon className="size-4 shrink-0" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          data-tour="active-duration-indicator"
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

/** The teal-bordered triangle every header popup here points back to its
 *  trigger with. `asChild`-swapped rather than Radix's own default `Arrow`
 *  shape: that default renders a single closed `<polygon>`, and a stroke on
 *  a closed shape paints all 3 edges — including the flat base sitting
 *  against the popup's own border, which showed up as a stray line cutting
 *  across the inside of the triangle. Splitting fill (the plain closed
 *  polygon, unstroked) from stroke (an open path over just the two visible
 *  slanted edges) keeps the same look with no seam. */
function PopupArrow() {
  return (
    <PopoverPrimitive.Arrow asChild>
      <svg width={14} height={7} viewBox="0 0 30 10" preserveAspectRatio="none">
        <polygon points="0,0 30,0 15,10" className="fill-white" />
        <path
          d="M0,0 L15,10 L30,0"
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          className="stroke-blue-400"
        />
      </svg>
    </PopoverPrimitive.Arrow>
  );
}

/** The header's own "who's in this session" signal — same spot/shape as
 *  ActiveDurationIndicator right beside it. Only worth a header icon once
 *  there's actually multiple people to report (you plus at least one other)
 *  — a solo session has no roster worth summarizing. Once it does show, you
 *  count as one of the people in it just like everyone else: the badge is
 *  the total headcount (not "others besides you"), and the roster popover
 *  lists you first rather than tacking you on as an afterthought — no
 *  "also," since it's a given you're one of the people listed. */
function PresenceIndicator({ otherStaffIds }: { otherStaffIds: string[] }) {
  const visible = otherStaffIds.length >= 1;
  const rosterIds = [CURRENT_STAFF_ID, ...otherStaffIds];
  const [open, setOpen] = useState(false);
  // Anchored to the icon itself, not the trigger button — the button also
  // contains the "In Session" label (shown from `md:` up), which would pull
  // the button's own horizontal center right of the icon whenever that
  // label is present, pointing the arrow at empty space between icon and
  // text instead of at the icon it's actually attached to.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // margin=34: see SaveIndicator's own identical comment — same
  // rounded-2xl box (24px radius) and the same rotated h-3 w-3 arrow
  // square, so it needs the same clearance from the corner curve.
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef, 34);

  const trigger = (
    // The count badge is `absolute`, not a normal inline sibling — its own
    // appearing/disappearing (2 people vs. 3+) must never change this span's
    // width and shove neighboring header icons sideways, the same
    // "spacing shouldn't depend on the badge" fix applied to
    // ActiveDurationIndicator's identical badge below.
    <span ref={anchorRef} className="relative inline-flex">
      {/* Outline, not filled — matches the Timer icon right beside it,
          which is lucide's default stroke rendering at the same size/
          strokeWidth. A filled silhouette read as heavier than its
          neighbor even at the same size. */}
      <User className="size-4" />
      {/* `visible` already guarantees at least 2 (you + 1 other) — always
          worth a count. Total headcount, including you, not just others. */}
      <sup className="pointer-events-none absolute -top-0.5 -right-1 text-[9px] font-semibold leading-none">
        {rosterIds.length}
      </sup>
    </span>
  );
  const label = "In Session";
  const ariaLabel = `${rosterIds.length} people in this session`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="presence-indicator"
          data-tour="presence-indicator"
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
          // Pulls in just this gap, not every tab's — the parent nav's
          // `gap` is shared by all its children (tabs included), so tightening
          // it there would crowd the tabs too.
          className="-ml-1"
        >
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                title={rosterIds
                  .map((id) => (id === CURRENT_STAFF_ID ? "You" : staffName(id)))
                  .join(", ")}
                className="relative flex items-center gap-1.5 justify-center px-1 py-1.5 sm:py-2 text-blue-500 hover:text-blue-600 transition-colors"
              >
                {trigger}
                <span className="hidden md:inline text-xs font-medium whitespace-nowrap">
                  {label}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              ref={contentRef}
              side="bottom"
              align="center"
              sideOffset={6}
              collisionPadding={16}
              className="group relative z-[70] w-max rounded-2xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
            >
              {/* Rotated-square idiom (NumberKeypad/DataToolbar's filter
                  popover) instead of Radix's own Arrow primitive — a plain
                  triangle SVG stroked separately from the box's own border
                  never quite lines up with it, leaving a visible seam where
                  the two meet. This is the same border color/width as the
                  box, positioned to slide under its rounded corner, so it
                  reads as part of one continuous shape. Its left offset
                  tracks the trigger's real position (useSlidingArrowOffset)
                  since Radix's collision avoidance can shift this box
                  sideways to stay on screen, which a fixed center wouldn't
                  follow. */}
              <div
                className={cn(
                  "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-400 bg-white",
                  "-top-[7px] border-l-2 border-t-2",
                  "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[7px]",
                  "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
                  "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
                )}
                style={{ left: arrowLeft ?? "50%" }}
              />
              {/* Same title-row-with-close-button idiom as the "Session Data
                  Status" popover (SaveIndicator, above) — see its own
                  comment for why flex + `items-center` beats an absolutely-
                  positioned close button over separately-padded title text.
                  pr-2 (not px-4 on both sides) shifts the close button
                  slightly right, closer to the box's own edge, instead of
                  matching the title's left inset exactly. */}
              <div className="flex items-center justify-between gap-2 py-1 pl-4 pr-2 border-b border-border bg-white rounded-t-2xl">
                <h3 className="font-display text-base leading-tight whitespace-nowrap">
                  In This Session
                </h3>
                <PopoverPrimitive.Close
                  aria-label="Close"
                  className="grid place-items-center size-7 shrink-0 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                >
                  <X className="size-4" />
                </PopoverPrimitive.Close>
              </div>
              <div className="flex flex-col items-start gap-1.5 px-4 py-3">
                {rosterIds.map((id) => (
                  <PersonPill key={id} staffId={id} size="sm" />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Sits in the same tab-bar slot ActiveDurationIndicator/PresenceIndicator
 *  occupy, showing only when neither of them has anything to show — a
 *  running timer or another present staff member both take priority over
 *  pure decoration. The row is `items-end` (see the tab-bar div's own
 *  className), so a child taller than its tab/icon siblings naturally
 *  pokes up above their shared baseline with no absolute positioning
 *  needed — the same mechanism the cat-ear tab shape itself relies on. */
function TabBarTailSwish({
  inSession,
  iconOccupied,
}: {
  /** Whether to show the tail AT ALL — leaving/entering the session shows
   *  or hides it immediately, same as the mini pill it sits beside. */
  inSession: boolean;
  /** Whether ActiveDurationIndicator/PresenceIndicator currently has
   *  something to show in this same slot. Deliberately a separate prop
   *  from `inSession`, not folded into one combined "hidden" flag — only
   *  THIS clearing needs the reappear delay below (there's an outgoing
   *  icon to wait out); a plain session resume has nothing to wait for
   *  and should show the tail immediately, not on the same delay.
   */
  iconOccupied: boolean;
}) {
  // Hiding for this reason is immediate (the tail loses the slot the
  // instant something else needs it), but un-hiding waits for the outgoing
  // Timer/Presence icon to actually finish leaving first — without this,
  // `iconOccupied` flips to false the same render `runningTimers`/
  // `otherPresentStaffIds` empties out, which is well before its sibling is
  // actually gone: PresenceIndicator starts its own 250ms exit right then,
  // but ActiveDurationIndicator sits on `timers` for a further 300ms grace
  // window (see its own comment) before it even STARTS its 250ms exit.
  // 550ms covers the slower of the two (the timer case) so the tail never
  // starts sliding in until whichever icon was showing has actually,
  // visibly cleared the slot.
  const [delayedIconOccupied, setDelayedIconOccupied] = useState(iconOccupied);
  useEffect(() => {
    if (iconOccupied) {
      setDelayedIconOccupied(true);
      return;
    }
    const id = window.setTimeout(() => setDelayedIconOccupied(false), 550);
    return () => window.clearTimeout(id);
  }, [iconOccupied]);

  const hidden = !inSession || delayedIconOccupied;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="tab-bar-tail"
          // Slides down out of the slot (not just fades) when a timer/
          // presence icon needs the space — reads as the tail retreating
          // out of the way rather than just vanishing in place.
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          // No vertical padding, unlike the tab/icon siblings' own py-1.5
          // sm:py-2 — those pad a small icon away from the shared bottom
          // edge on purpose, but the tail is supposed to read as attached
          // to the bar it's poking up from, so its own base needs to sit
          // flush against that edge instead of floating above it.
          className="flex items-end px-1 text-foreground/35"
        >
          <TailSwish
            className="w-12 h-8"
            strokeWidth={18}
            // Anchors the tail's own base to the bottom of its box (see
            // TailSwish's own comment) instead of vertically centering it
            // with dead space above — the base is what should read as
            // flush with the tab row's shared baseline.
            preserveAspectRatio="xMidYMax meet"
          />
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
  const { use24HourTime } = useSettings();
  const isDirty = status === "dirty";
  const isSaving = status === "saving";

  const cloudColorClass = isDirty || isSaving ? "text-blue-500" : "text-stone-400";
  const SymbolIcon = isDirty ? ArrowUp : isSaving ? RefreshCw : Check;

  const label = isSaving ? "Syncing" : isDirty ? "On Device" : "Synced";
  const labelColor = isSaving || isDirty ? "text-blue-600" : "text-muted-foreground";
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // margin=34, not the default 16: this popover's `align="end"` trigger
  // sits right at the box's own top-right corner, which used to clamp the
  // slider to its minimum on every open — and 16 isn't enough clearance
  // for this rounded-2xl box's real 24px radius plus the rotated h-3 w-3
  // arrow square's own ~8.5px half-width (24 + 8.5 ≈ 32.5), so the
  // corner's curve was showing through the arrow's white fill. Kept as a
  // safety net now that `alignOffset` below does the real work of keeping
  // the trigger off the corner in the first place.
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef, 34);
  const lastSyncedDayHint = lastSavedAt ? formatDayHint(lastSavedAt) : null;

  return (
    // data-tour on the whole pair, not just the "Synced" text button below —
    // the save-status-indicator tip is about the status AND the cloud
    // together ("Tap the cloud to force an instant sync... or tap the
    // status for precise details"), so its own spotlight needs to cover
    // both rather than just the text half of what it's describing.
    <div className="flex items-center gap-1.5" data-tour="save-status">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={anchorRef}
            type="button"
            className="flex items-center text-right hover:opacity-80 transition-opacity h-8"
          >
            <span className={cn("text-[11px] font-medium leading-none", labelColor)}>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          side="bottom"
          align="end"
          // alignOffset=-20: without this, the box's right edge sits flush
          // with the trigger's own right edge, putting the trigger's true
          // horizontal center only ~17px from that edge — inside the ~32.5px
          // the rounded corner + arrow need (see arrowLeft's margin=34
          // comment above), so useSlidingArrowOffset had to clamp the arrow
          // well short of the trigger's actual center every time. Nudging
          // the whole box 20px further left (past flush) gives the true
          // center enough room without the clamp ever kicking in, while
          // still leaving a comfortable margin from the viewport's edge.
          alignOffset={-20}
          sideOffset={6}
          collisionPadding={16}
          // z-[70]: same reasoning as DataToolbar's own filter popover — the
          // sticky toolbar below sits at z-[60], so this content (default
          // z-50) needs to paint above that or its "Saved by" pill sits
          // underneath the toolbar and its clicks get intercepted there.
          // w-72 (not w-max): the reassurance sentence in the Status row
          // below is a full clause, not a short label — left unbounded it
          // stretches the box past a narrow phone's viewport edge instead
          // of wrapping.
          className="group relative z-[70] w-72 rounded-2xl border-2 border-blue-400 bg-white p-0 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          {/* Rotated-square idiom (NumberKeypad/DataToolbar's filter
              popover) — see PresenceIndicator's popover below for the full
              reasoning. `align="end"` here (this trigger sits at the
              header's own right edge) is exactly the case a fixed-center
              arrow can't handle: useSlidingArrowOffset keeps this pointing
              at the real trigger regardless of where collision avoidance
              (or `align` itself) lands the box. */}
          <div
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-400 bg-white",
              "-top-[7px] border-l-2 border-t-2",
              "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[7px]",
              "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
              "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
            )}
            style={{ left: arrowLeft ?? "50%" }}
          />
          {/* Title and close button as flex siblings (not an absolutely-
              positioned close button floating over independently-padded
              title text) — `items-center` centers both on the row's own
              height instead of each keeping its own separate padding that
              could drift out of alignment, and the row's height is just
              whatever the taller of the two needs, not a fixed pt-4/pb-2
              guess. pr-2 (not px-4 on both sides) shifts the close button
              slightly right, closer to the box's own edge. */}
          <div className="flex items-center justify-between gap-2 py-1 pl-4 pr-2 border-b border-border bg-white rounded-t-2xl">
            <h3 className="font-display text-base leading-tight whitespace-nowrap">
              Session Data Status
            </h3>
            <PopoverPrimitive.Close
              aria-label="Close"
              className="grid place-items-center size-7 shrink-0 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              <X className="size-4" />
            </PopoverPrimitive.Close>
          </div>

          <div className="px-4 py-3 space-y-3 text-sm">
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
                  {isSaving ? "Syncing…" : isDirty ? "On Device" : "Synced"}
                </span>
              </div>
              {/* The reassuring part: everything through the last sync is
                  already safe in the cloud, so the only thing "On Device"
                  is ever flagging is the handful of seconds of changes made
                  since then — not the whole session. */}
              <p className="mt-1 text-muted-foreground leading-snug">
                {isSaving
                  ? "Syncing your latest changes to the cloud…"
                  : isDirty
                    ? lastSavedAt
                      ? `Synced to the cloud ${lowerFirst(formatRelativeFromNow(lastSavedAt, use24HourTime))}. Newest changes are safely on this device.`
                      : "Not yet synced — this session's data is safely on this device."
                    : "Current. All session data is synced to the cloud."}
              </p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Last Synced
              </div>
              <div className="tabular-nums leading-tight">
                <div>
                  {formatFullTime(lastSavedAt, use24HourTime)}
                  {lastSavedAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({formatRelativeDuration(lastSavedAt)})
                    </span>
                  )}
                </div>
                <div>
                  {formatShortDate(lastSavedAt)}
                  {lastSyncedDayHint && (
                    <span className="text-muted-foreground"> ({lastSyncedDayHint})</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Synced by
              </div>
              <PersonPill staffId={CURRENT_STAFF_ID} />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={isDirty ? onSync : undefined}
        aria-label={isDirty ? "Sync now" : isSaving ? "Syncing" : "All changes synced"}
        title={isDirty ? "Sync now" : isSaving ? "Syncing…" : "All changes synced"}
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

// Abbreviated form for the "Last Synced" popup row (e.g. "Wed, Sep 2") —
// that row leads with the time, so the date here only needs to disambiguate
// which day, not restate it in full the way formatRelativeFromNow's
// long-form fallback does elsewhere.
function formatShortDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// The "(today)" / "(yesterday)" hint next to that abbreviated date — null
// past a week out, where a day-count stops being more useful than the date
// itself already sitting right there.
function formatDayHint(d: Date) {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return null;
}

// The "(1 minute ago)" hint next to the exact synced time — pure elapsed
// duration, unlike formatRelativeFromNow's day-plus fallback which folds in
// a weekday/time of its own (redundant here since the exact time is right
// beside it, and the date row right below already carries the day).
function formatRelativeDuration(d: Date) {
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatFullTime(d: Date | null, use24Hour: boolean) {
  if (!d) return "—";
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (use24Hour) return `${hh}:${mm}:${seconds}`;
  const hhmm = formatTimeOfDayForDisplay(`${hh}:${mm}`, false);
  const period = hhmm.slice(-1);
  return `${hhmm.slice(0, -1)}:${seconds}${period}`;
}

// For splicing formatRelativeFromNow's output ("Just now", "One minute
// ago") into the middle of a sentence, where a mid-sentence capital reads
// as a typo.
function lowerFirst(s: string) {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

function formatRelativeFromNow(d: Date, use24Hour: boolean) {
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
  const timeStr = formatTimeOfDayForDisplay(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    use24Hour,
  );
  if (days === 1) return `Yesterday at ${timeStr}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${timeStr}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${timeStr}`;
}

// The in-progress helper message shown in place of the box's normal label
// (see ExpandedSessionBox's own render) while each staged transition is
// dimming it — same idea as "Starting New Session" originally had all to
// itself, now covering its two siblings too.
const TRANSITION_MESSAGES: Record<Exclude<TransitionKind, null>, string> = {
  // Shorter than "Starting New Session" on purpose: the pill's own
  // clock-to-mini-slot travel flies up through this same header area a
  // beat later (see PILL_TRAVEL_MS), and the longer text was wide enough
  // to still be under it mid-flight, reading as an overlap.
  "start-new": "Starting Session",
  join: "Joining Session",
  resume: "Resuming Session",
  discard: "Discarding Session",
};

// The paused action-button set — factored out so ExpandedSessionBox can
// render it twice: once as the real, visible/interactive row, and once as
// an always-mounted, invisible copy purely for measurement (see
// `pausedActionsHeight`'s own comment). Its rendered height never actually
// varies (fixed classes, no wrapping at this box's width), so a second copy
// measured ahead of time tells the box its own eventual pause-open target
// before pause is ever clicked, rather than only finding out afterward.
function PausedActionsButtons({
  onEnd,
  onToggleReviewMode,
  reviewModeUnlocked,
  onRequestDiscard,
}: {
  onEnd: () => void;
  onToggleReviewMode: () => void;
  reviewModeUnlocked: boolean;
  onRequestDiscard: () => void;
}) {
  return (
    <>
      <button
        onClick={onEnd}
        data-tour="end-submit-button"
        className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
      >
        End & Submit Data
        <Upload className="size-3.5" strokeWidth={2.5} />
      </button>
      {/* Parked sessions default to locked so nothing on a session someone
        else may resume gets edited by accident — this is the one,
        intentional action that unlocks editing without restarting the
        (stopped) session timer. */}
      <button
        onClick={onToggleReviewMode}
        aria-pressed={reviewModeUnlocked}
        data-tour="review-mode-toggle"
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
        data-tour="end-discard-button"
        className="shrink-0 flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] px-1.5 py-1 rounded-md transition-colors active:scale-95"
      >
        End & Discard Session!
        <Trash2 className="size-3" />
      </button>
    </>
  );
}

function ExpandedSessionBox({
  status,
  elapsedMs,
  contextTime,
  attributionStaffId,
  isSessionMine,
  isAbandoned,
  reviewModeUnlocked,
  onToggleReviewMode,
  bigPillAnchorRef,
  dimmed = false,
  expandGen = 0,
  suppressEntranceAnimation = false,
  transitionKind = null,
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
  attributionStaffId: string | null;
  /** True whenever the current user could collapse this box back into the
   *  running mini pill (i.e. they started it, or already joined it) — false
   *  means someone else is running it and the only action here is to join. */
  isSessionMine: boolean;
  /** A running-not-mine session nobody has touched in a while — swaps the
   *  label to flag it instead of just reading as ordinarily busy. */
  isAbandoned: boolean;
  reviewModeUnlocked: boolean;
  onToggleReviewMode: () => void;
  /** The invisible, permanently-mounted spacer StatusBar's own single
   *  persistent pill measures to know where "resting big" is — see its own
   *  comment in StatusBar. Sized exactly like the real pill (`h-12 w-full`)
   *  but renders no content of its own; the actual pill lives elsewhere. */
  bigPillAnchorRef: React.RefObject<HTMLDivElement | null>;
  dimmed?: boolean;
  /** Bumped once every time the box expands back out from collapsed (see
   *  StatusBar's own comment) — keys the label/context/actions-row's
   *  entrance animation so it replays a fresh scale/fade-in each time,
   *  rather than that content just sitting statically in place as the
   *  growing box happens to reveal it. */
  expandGen?: number;
  /** True while StatusBar's own `suppressEntranceAnimation` is — see that
   *  flag's own comment. Forces the actions row's height tween to a plain
   *  snap for its first real measurement, the same reasoning as StatusBar's
   *  own box height, just threaded down since `actionsHeight` is measured
   *  here rather than there. */
  suppressEntranceAnimation?: boolean;
  /** Which staged transition is actively dimming the box right now (null
   *  once it's settled or if `dimmed` is false) — drives the in-progress
   *  helper message that crossfades in over the label below, see its own
   *  comment. */
  transitionKind?: TransitionKind;
  onStartNew: () => void;
  onEnd: () => void;
  onRequestDiscard: () => void;
  /** Fires once the action-button row's own height tween below actually
   *  finishes (Motion's real onAnimationComplete, not a guessed timer) — see
   *  StatusBar's own boxNaturalHeight comment for why the outer box needs
   *  this signal instead of just watching scrollHeight live. */
  onActionsHeightSettled?: () => void;
}) {
  const { use24HourTime } = useSettings();
  const isIdle = status === "idle";
  const isPaused = status === "paused";
  // The only other possibility once this box is even rendered (it's hidden
  // whenever the session is running AND ours — see StatusBar's `collapsed`):
  // running, but started/joined by someone else.
  const isRunningNotMine = status === "running" && !isSessionMine;
  const label = isIdle
    ? "Last Session:"
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
  // ResizeObserver, not a `[isPaused, isRunningNotMine]`-gated effect (the
  // previous approach) — that only re-measured when one of those two flags
  // itself changed, which misses any OTHER reason this row's real height
  // could differ from what got measured the first time: a hydration
  // mismatch between the server-rendered idle state and the client's own
  // (randomized) landing scenario, a webfont swapping in after that first
  // layout pass, anything. When that first measurement undershoots, it
  // never gets a chance to correct itself — deps that never change again
  // means the effect never reruns — permanently clipping the actions row's
  // real content (its own button rendering below its wrapper's capped
  // height) via the wrapper's `overflow-hidden`. This is what was leaving
  // "Start New Session" invisible AND unclickable (covered by the tabs row
  // rendering right where the clipped button geometrically still sat) on a
  // genuinely fresh idle mount — same bug StatusBar's own boxWrapRef
  // ResizeObserver already avoids for the outer box, for the same reason.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsHeight, setActionsHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const measure = () => setActionsHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A second, permanently-mounted (but invisible) copy of the paused button
  // set, measured continuously regardless of whether `isPaused` is even
  // true right now — so its real height is already known well before pause
  // ever happens, not just discovered afterward. Every OTHER route into
  // this box (idle, running-not-mine) keeps the box already open the whole
  // time (see `expandGen`'s own comment: pausing is the only transition
  // that opens the box FRESH, from fully collapsed), so this is the one
  // case where `actionsHeight`'s real measurement landing a beat late
  // actually matters — StatusBar's own `boxNaturalHeight` needs the box's
  // FINAL, buttons-included height as its target from the very first frame
  // of that expand, not a smaller interim one corrected a moment later.
  const pausedActionsShadowRef = useRef<HTMLDivElement>(null);
  const [pausedActionsHeight, setPausedActionsHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = pausedActionsShadowRef.current;
    if (!el) return;
    const measure = () => setPausedActionsHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The instant the box opens fresh (expandGen bumps — a pause, but also
  // leaveSession's own "step away, session keeps running" exit: that flips
  // isSessionMine false, which drops `collapsed` the exact same way pausing
  // does, so it opens the box fresh from collapsed too — see `collapsed`'s
  // own comment in SessionContext), seed `actionsHeight` straight from an
  // already-known target rather than waiting for the real, now-visible
  // button row's own ResizeObserver to fire — same "adjust during render"
  // pattern as `expandGen` itself. Only the PAUSED case has a real button
  // row to seed a height from (the shadow measurement below); running-not-
  // mine (leaveSession) and idle both render no actions row at all (see
  // that row's own JSX), so their already-known target is simply 0 — no
  // shadow measurement needed for a height that can never be anything else.
  // Seeding straight to `pausedActionsHeight` unconditionally here used to
  // ignore which of these this actually was: opening fresh into
  // running-not-mine still got stamped with the PAUSED row's height (99px
  // of stale "End & Submit / Review Mode / Discard" button space) because
  // that's what happened to be sitting in `pausedActionsHeight` at the
  // time, leaving this row's own real content empty but its wrapper still
  // holding the paused set's worth of space open — exactly the dead gap
  // between the box's visible content and the tabs below that leaveSession
  // was reported to leave. Since the paused button set's height never
  // actually varies, and non-paused's target is always exactly 0, this
  // consistently lands on the exact right number the real row would have
  // measured anyway, just without the lag.
  //
  // Only marks this generation "consumed" (advances the ref) once the seed
  // actually happens — for the paused branch, `pausedActionsHeight` is
  // itself only known once ITS OWN ResizeObserver has fired at least once,
  // which (being scheduled rather than synchronous) isn't guaranteed to
  // have happened yet on the very first render where `expandGen` bumps.
  // Consuming the ref unconditionally there left `actionsHeight` stuck at
  // whatever it was before (0, from the real row's own last real-content
  // measurement while running/empty) forever after — this render's
  // mismatch never got a second look once the ref moved on. Leaving the
  // ref alone instead means this same check just re-runs on every
  // subsequent render (including the one `setPausedActionsHeight` itself
  // triggers) until it can actually succeed. The non-paused branch's
  // target (0) is always already known, so it never has this problem.
  // `freshlyOpened` itself (read below, in the height motion.div's own
  // transition) doesn't need its own reset: once the ref DOES advance,
  // this recomputes to `false` on every later render until the next open.
  const prevExpandGenForActionsRef = useRef(expandGen);
  const freshlyOpened = expandGen !== prevExpandGenForActionsRef.current;
  const freshOpenTarget = isPaused ? pausedActionsHeight : 0;
  const freshOpenTargetKnown = !isPaused || pausedActionsHeight !== null;
  // The `actionsHeight !== freshOpenTarget` guard isn't just a micro-
  // optimization — it's load-bearing. The ref below only advances once a
  // COMMIT actually happens (a `useLayoutEffect`, not a render-body
  // mutation — see its own comment), which means `freshlyOpened` stays
  // `true` across every render that occurs before that commit, e.g. once
  // per every other unrelated re-render (elapsedMs ticking, etc.)
  // happening to land in the same window. Without this guard, EVERY one of
  // those renders re-issues `setActionsHeight(freshOpenTarget)` — and
  // confirmed empirically (direct instrumentation, not just reasoning from
  // React's docs): React does NOT reliably treat a same-value render-phase
  // dispatch as a no-op here, and repeated calls across enough renders hit
  // the render-phase-update cap for real, throwing "Too many re-renders"
  // and tearing down this whole component via its error boundary. Skipping
  // the call once the value already matches avoids re-dispatching at all.
  if (freshlyOpened && freshOpenTargetKnown && actionsHeight !== freshOpenTarget) {
    setActionsHeight(freshOpenTarget);
  }
  // Consuming the ref here, not in the render body above — mutating it
  // synchronously during render (the way this used to work) landed on the
  // COMMITTED render itself, not just the one that triggered it: React
  // "adjust state during render" reruns this component's function
  // synchronously (same pass, no extra paint) after `setActionsHeight`
  // above, and since the ref had ALREADY been bumped inside that same
  // render call, the re-run recomputed `freshlyOpened` as false before
  // React ever committed anything — the height motion.div's own
  // `transition` (which reads `freshlyOpened` fresh every render) always
  // saw `false` on the render that actually painted, so it played its
  // real, gradual ACTIONS_HEIGHT_MS tween from empty every time instead of
  // the zero-duration snap this whole mechanism exists to provide. A
  // `useLayoutEffect` only fires once per actual commit (not once per
  // synchronous re-render-during-render call), so the ref advances a beat
  // later than before — after the correctly-`true` render has already
  // painted — instead of racing ahead of it.
  useLayoutEffect(() => {
    if (freshlyOpened && freshOpenTargetKnown) {
      prevExpandGenForActionsRef.current = expandGen;
    }
  }, [freshlyOpened, freshOpenTargetKnown, expandGen]);

  // Re-render to refresh "x ago" string.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!contextTime) return;
    const i = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, [contextTime]);

  const transitionMessage = transitionKind ? TRANSITION_MESSAGES[transitionKind] : null;

  return (
    <div
      data-tour="session-box"
      className="shrink-0 px-3 py-1.5 w-[280px] flex flex-col items-stretch gap-2"
    >
      <div className="flex flex-col items-center gap-1">
        {/* Crossfades with the plain label below rather than just fading to
            blank — gives every staged transition (not just start-new's own
            reset-to-zero digit spin, see OdometerDigits' `slow` prop)
            something to read as "in progress" instead of a silent pause. */}
        <div className="relative">
          <motion.span
            animate={{ opacity: transitionMessage ? 1 : 0 }}
            initial={false}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 text-sm font-bold uppercase tracking-wider text-blue-600 whitespace-nowrap"
            aria-hidden={!transitionMessage}
          >
            {transitionMessage}
          </motion.span>
          <motion.span
            key={expandGen}
            animate={{ opacity: dimmed ? 0 : 1 }}
            initial={expandGen === 0 ? false : { opacity: 0 }}
            transition={{
              duration: dimmed ? 0.2 : ACTIONS_REVEAL_MS / 1000,
            }}
            className="text-sm font-bold uppercase tracking-wider text-muted-foreground"
          >
            {/* A plain CSS animation on its own nested span, not on this
                motion.span itself — Motion already drives THIS element's own
                opacity (the dimmed/entrance fade above), and layering a
                second, independent opacity animation on the very same
                element would have the two fight over the same property.
                Nesting keeps them on separate elements, where their opacity
                values simply multiply together instead of conflicting. Only
                while paused: reads as "on hold, waiting for you," not
                something to show for every label here (an actively running
                or idle session isn't "waiting" on anything). */}
            {isPaused ? <span className="animate-pulse-gentle">{label}</span> : label}
          </motion.span>
        </div>

        <motion.div
          key={expandGen}
          animate={{ opacity: dimmed ? 0 : 1 }}
          initial={expandGen === 0 ? false : { opacity: 0 }}
          transition={{ duration: dimmed ? 0.2 : ACTIONS_REVEAL_MS / 1000 }}
          className="flex items-center gap-1 leading-tight"
        >
          {contextTime && (
            <span className="inline-flex items-baseline gap-1 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              <span>{attributionVerb}</span>
              {attributionStaffId && (
                <>
                  <span>by</span>
                  <span data-tour="session-attribution-pill">
                    <PersonPill staffId={attributionStaffId} size="sm" />
                  </span>
                </>
              )}
              <span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
                    >
                      {formatRelativeFromNow(contextTime, use24HourTime)}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="center"
                    sideOffset={-2}
                    collisionPadding={12}
                    // Stays rounded-lg, not rounded-2xl like the other two
                    // header popups (PresenceIndicator/SaveIndicator) — this
                    // one's a compact 2-line tooltip (~49px tall), too short
                    // for a 24px corner radius to leave the arrow anywhere
                    // to sit: boxHeight - 2*radius needs to clear the
                    // arrow's own ~14px span, and 49 - 2*24 is negative.
                    // 16px is the largest radius this box's real height
                    // actually supports without swallowing the arrow.
                    className="relative z-[70] w-auto rounded-lg border-2 border-blue-400 bg-white px-3 py-1.5 text-xs tabular-nums leading-snug whitespace-nowrap shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
                  >
                    <PopupArrow />
                    {/* Two lines — date, then time underneath — rather than
                      one long mm/dd/yyyy hh:mm:ss string. */}
                    <div>{formatExactDate(contextTime)}</div>
                    <div>{formatExactTime(contextTime, use24HourTime)}</div>
                  </PopoverContent>
                </Popover>
                .
              </span>
            </span>
          )}
        </motion.div>

        {/* Invisible, permanently-mounted — StatusBar's own single
            persistent pill (see its own comment) renders the real digits/
            button and just measures this div to know where "resting big"
            is. Same size as the real pill (`h-12 w-full`) so this box's
            own natural height still accounts for the space it needs. */}
        <div ref={bigPillAnchorRef} className="h-12 w-full" aria-hidden />
      </div>

      {/* Stays mounted (no AnimatePresence) and only ever fades for the
          `dimmed` stage — it does NOT also collapse its height there, so the
          box's overall size stays put while things fade in place, and the
          whole (now-blank) box collapses as a single later beat instead of
          reshuffling mid-fade. Height only changes for genuine content
          swaps (isPaused's button set), via the measured actionsHeight
          number — never "auto", see the comment above. Zeroed instead while
          `suppressEntranceAnimation` is true, same reasoning as StatusBar's
          own box height — `actionsHeight`'s very first real measurement
          can't land until this screen is genuinely visible, which otherwise
          animated this row into place during the welcome->main slide.
          `freshlyOpened` zeroes the duration too, for the same reason: on a
          fresh open (pausing), `actionsHeight` is already seeded to its
          correct, final value in that same commit (see
          `pausedActionsHeight`'s own comment), so there's nothing to grow
          INTO — it just appears at full height, with StatusBar's own outer
          box height animating around it as the one visible motion, and the
          opacity/scale wrapper below fading the buttons in. Deliberately a
          transition-duration toggle rather than a `key`-forced remount of
          this element: `actionsRef` sits on a child of this same div, and
          its own ResizeObserver-setup effect only runs once (mount-only
          deps, same reasoning as that ref's own comment below) — remounting
          this ancestor on every open would leave it watching a detached
          node after the first one, same "stale observer" bug that comment
          already warns about for a different element. A later content swap
          that keeps the box open (e.g. paused -> idle without collapsing)
          doesn't bump `expandGen`, so `freshlyOpened` is false there and it
          still gets the real, gradual tween. */}
      <motion.div
        animate={{ height: actionsHeight ?? "auto" }}
        transition={{
          duration: freshlyOpened || suppressEntranceAnimation ? 0 : ACTIONS_HEIGHT_MS / 1000,
          ease,
        }}
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
            uses for the outer box, for the exact same reason. Deliberately
            NOT the same element as the keyed opacity/scale div just below —
            its own ResizeObserver-setup effect only runs once (an empty dep
            array, matching boxWrapRef's own), so if this ref sat on an
            element `key`-remounted on every entrance, the observer would be
            left watching a detached node after the first remount and never
            fire again, silently freezing actionsHeight (and this row,
            clipped to that stale height by the overflow-hidden div above)
            at whatever it happened to be — see git history for that exact
            bug before this comment existed. */}
        <div ref={actionsRef}>
          {/* Opacity/scale live here instead of on the height-driving
              motion.div above — Motion's onAnimationComplete fires once ALL
              of an element's own animated properties finish, and this pair
              deliberately runs on a slower, direction-dependent clock
              (ACTIONS_DIM_MS fading out, ACTIONS_REVEAL_MS entering — see
              that constant's own comment for why it's held past
              SESSION_MORPH_MS) than the snappier ACTIONS_HEIGHT_MS the outer
              div's height — and by extension onActionsHeightSettled, and by
              extension boxNaturalHeight's own correction — needs to keep
              running on.
              `key={expandGen}` forces a fresh initial->animate replay on
              every entrance (mount doesn't otherwise change, since this row
              never unmounts) — `initial={false}` on the very first render
              only, matching every other dimmed-driven fade in this file
              that intentionally skips an entrance flash on first paint. */}
          <motion.div
            key={expandGen}
            animate={{
              opacity: dimmed ? 0 : 1,
              scale: dimmed ? ACTIONS_DIM_SCALE : 1,
            }}
            initial={expandGen === 0 ? false : { opacity: 0, scale: ENTER_SCALE }}
            transition={{
              duration: dimmed ? ACTIONS_DIM_MS / 1000 : ACTIONS_REVEAL_MS / 1000,
              ease,
            }}
            className="flex flex-col gap-1"
          >
            {isPaused && (
              <PausedActionsButtons
                onEnd={onEnd}
                onToggleReviewMode={onToggleReviewMode}
                reviewModeUnlocked={reviewModeUnlocked}
                onRequestDiscard={onRequestDiscard}
              />
            )}
            {isIdle && (
              <button
                onClick={onStartNew}
                className="btn-bevel shrink-0 flex items-center justify-center gap-1.5 rounded-full h-9 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 w-full transition-colors active:scale-95"
              >
                Start New Session
                <RefreshCw className="size-3.5" strokeWidth={2.5} />
              </button>
            )}
            {/* isRunningNotMine: no action here at all — join via the pill
                button above first, then pause/end become available once
                it's yours (isSessionMine flips and this box stops
                rendering in favor of the running mini pill/box). */}
          </motion.div>
        </div>
      </motion.div>
      {/* Always mounted regardless of `isPaused`, and always clipped to 0
          height here (never painted, never taking up real layout space) —
          see `pausedActionsHeight`'s own comment. `pausedActionsShadowRef`
          sits on the plain, UNCLIPPED inner div, same "measure via an
          unconstrained child, not the clipping wrapper" split as
          actionsRef/its own motion.div above — this outer div's own
          `h-0 overflow-hidden` is what keeps it from ever contributing to
          ITS OWN ancestors' scrollHeight (an absolutely-positioned child
          would still inflate an ancestor's scrollHeight by overflowing it,
          even invisibly — a real box-height feedback loop this avoids by
          just never occupying more than 0px of real layout in the first
          place). */}
      <div aria-hidden="true" className="h-0 overflow-hidden invisible pointer-events-none">
        <div ref={pausedActionsShadowRef} className="flex flex-col gap-1">
          <PausedActionsButtons
            onEnd={onEnd}
            onToggleReviewMode={onToggleReviewMode}
            reviewModeUnlocked={reviewModeUnlocked}
            onRequestDiscard={onRequestDiscard}
          />
        </div>
      </div>
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

function formatExactTime(d: Date, use24Hour: boolean) {
  const h24 = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  if (use24Hour) return `${String(h24).padStart(2, "0")}:${min}:${ss}`;
  const hh = String(((h24 + 11) % 12) + 1).padStart(2, "0");
  const period = h24 < 12 ? "a" : "p";
  return `${hh}:${min}:${ss}${period}`;
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
