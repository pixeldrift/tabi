import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, X, Link2 } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { ListActionBadge, ListActionButton } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { IntervalIcon } from "./icons/IntervalIcon";
import { IntervalWholeIcon } from "./icons/IntervalWholeIcon";
import { IntervalPartialIcon } from "./icons/IntervalPartialIcon";
import { IntervalMomentaryIcon } from "./icons/IntervalMomentaryIcon";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { Switch } from "@/components/ui/switch";
import { useCardSession, useSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { useNotifications } from "./NotificationContext";
import { TimeKeypad } from "./TimeKeypad";
import {
  formatTimeOfDayForDisplay,
  formatTimeOfDaySecondsForDisplay,
  parseTimeOfDayLabel,
} from "./TimeOfDayKeypad";
import { useSettings } from "./SettingsContext";
import { useScheduleData } from "./ScheduleContext";
import { cn } from "@/lib/utils";

export type IntervalStatus = "correct" | "incorrect" | null;

export type SamplingType = "whole" | "partial" | "momentary";

/** Short, corner-label-sized names — the full ABA terms (Whole/Partial
 *  Interval Recording, Momentary Time Sampling) live in the sampling-type
 *  picker's own helpText and this kind's info-modal description instead,
 *  so the on-card label stays a single line at its small corner size. */
const SAMPLING_TYPE_LABEL: Record<SamplingType, string> = {
  whole: "Whole Interval",
  partial: "Partial Interval",
  momentary: "Momentary",
};

const SAMPLING_TYPE_ICON: Record<SamplingType, typeof IntervalIcon> = {
  whole: IntervalWholeIcon,
  partial: IntervalPartialIcon,
  momentary: IntervalMomentaryIcon,
};

export interface IntervalCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  /** Which of the three standard ABA interval-recording methods this card
   *  follows — purely presentational (corner label, icon, and timeline
   *  indicator). Defaults to "whole", matching every pre-existing card's
   *  actual behavior before this field existed. */
  samplingType?: SamplingType;
  /** Length of each scored interval, in minutes (e.g. 30 or 60). */
  intervalMin: number;
  /** Total number of intervals across the whole observation window — omit
   *  for an open-ended card (e.g. a toileting check that runs the whole
   *  session): it then defaults to showing `defaultWindowHours` worth of
   *  intervals, growing to always show one more than the current elapsed
   *  time if the session runs past that. */
  intervalCount?: number;
  /** Only relevant when `intervalCount` is omitted — how many hours of
   *  intervals to show by default. */
  defaultWindowHours?: number;
  /** Button + measurement-row label for the positive outcome. */
  positiveLabel?: string;
  /** Button + measurement-row label for the negative outcome. */
  negativeLabel?: string;
  /** Whether the elapsed-time pill is locked to the session clock (the
   *  normal case) or editable via a tap-to-enter keypad — TEMPORARILY
   *  exposed so elapsed time can be typed in directly for testing;
   *  defaults to locked. */
  locked?: boolean;
  /** "timeOfDay" switches the card entirely into checkpoint mode below —
   *  `intervalMin`/`intervalCount`/`defaultWindowHours` above are ignored
   *  in that case. Omitted or "interval" runs the normal elapsed-interval
   *  card as always. */
  checkpointMode?: "interval" | "timeOfDay";
  /** Only consumed when `checkpointMode` is "timeOfDay" — each checkpoint
   *  fires its own real wall-clock alert (with a scoreable popup, same as
   *  the interval mode's own "time to check" alert) once its `time` has
   *  arrived, and is scored independently of the others. */
  checkpoints?: { time: string; label: string; alertText?: string }[];
  isActive?: boolean;
  onActivate?: () => void;
}

// ---- Human-readable interval-label formatting ----
// "1: 0-30m", "2: 30m-60m", "3: 1h-1hr30m" — an interval whose END still
// falls within the first hour is written entirely in plain minutes
// (including a bare "0" for the very first, zero-valued boundary); once an
// interval's end passes the 60-minute mark, BOTH of its boundaries switch to
// hour notation instead — a round hour reads as "1h", an hour-plus-minutes
// boundary as "1hr30m". Deciding hour-vs-minute per INTERVAL (not per
// boundary in isolation) is what keeps interval 2's own end (60 min) reading
// as "60m" while interval 3's matching start (the same 60-minute instant)
// reads as "1h" — each boundary takes its format from the interval it's
// closing out or opening into.
function formatBoundary(min: number, hourMode: boolean): string {
  if (!hourMode) return min === 0 ? "0" : `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}hr${rem}m`;
}

/** Just the time range, e.g. "0-30m" — no leading number/colon. */
function intervalRange(index: number, intervalMin: number): string {
  const start = index * intervalMin;
  const end = (index + 1) * intervalMin;
  const hourMode = end > 60;
  return `${formatBoundary(start, hourMode)}-${formatBoundary(end, hourMode)}`;
}

/** A single time boundary in the "30m" / "1hr" / "1hr 30m" / "2hrs" style —
 *  shared by `intervalEndLabel` (just the higher boundary) and the "time to
 *  check" alert's own start-end range (see `intervalCheckRangeLabel`). */
function formatIntervalBoundary(totalMin: number): string {
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const rem = totalMin % 60;
  const hrPart = `${hours}hr${hours > 1 ? "s" : ""}`;
  return rem === 0 ? hrPart : `${hrPart} ${rem}m`;
}

/** Just the interval's higher (end) boundary — "30m", "1hr", "1hr 30m",
 *  "2hrs" — what the standard view's own header shows for the viewed
 *  interval instead of a full start-end range. */
function intervalEndLabel(index: number, intervalMin: number): string {
  return formatIntervalBoundary((index + 1) * intervalMin);
}

/** "1hr-1hr 30m" — the full start-end range in that same boundary style,
 *  used as the "time to check" alert's own sub-text instead of the card's
 *  title. */
function intervalCheckRangeLabel(index: number, intervalMin: number): string {
  return `${formatIntervalBoundary(index * intervalMin)}-${formatIntervalBoundary((index + 1) * intervalMin)}`;
}

function formatCompactTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  return h > 0
    ? `${h}:${mm}:${s.toString().padStart(2, "0")}`
    : `${mm}:${s.toString().padStart(2, "0")}`;
}

/** Where an interval sits relative to `viewIdx` — the position the nav
 *  arrows move, same "current/browsable" idiom as Task Analysis's own
 *  `current` step. */
type Recency = "current" | "past" | "future";

function recencyOf(index: number, viewIdx: number): Recency {
  if (index === viewIdx) return "current";
  return index < viewIdx ? "past" : "future";
}

// Bubble/badge coloring shared by the timeline's own numbers and the
// expanded view's per-row badges — gray until an interval has actually been
// scored, then the same green/red as its button, REGARDLESS of whether its
// own time has actually been reached yet (a pre-scored future interval —
// e.g. scored ahead of time in the expanded view — has to show that score
// immediately, not silently hold it until the clock catches up). The
// current (viewed) interval reads solid/full-opacity; anything already
// passed fades out; only a still-unscored future interval stays flat gray.
function statusColors(status: IntervalStatus, recency: Recency) {
  const fade = recency === "past" ? "opacity-60" : "";
  if (status === "correct")
    return { bg: "bg-green-50 border-green-300", text: "text-green-700", fade };
  if (status === "incorrect") return { bg: "bg-red-50 border-red-300", text: "text-red-700", fade };
  if (recency === "future") {
    return { bg: "bg-foreground/5 border-foreground/10", text: "text-foreground/30", fade: "" };
  }
  return recency === "current"
    ? { bg: "bg-card border-foreground/30", text: "text-foreground", fade: "" }
    : { bg: "bg-foreground/5 border-foreground/10", text: "text-foreground/30", fade };
}

// Coloring for the sampling-type row's bracket/dot — deliberately simpler
// than statusColors' bordered-badge palette above (no recency/fade
// dimension here, just "not yet scored" vs. which button scored it), and a
// gray REST state instead of statusColors' "nothing at all until scored" —
// the sampling-type indicator is a permanent "this is what counts" legend,
// not a scored-only celebration mark. Two variants of the same three
// colors: `bg-*` for the momentary dot (a plain filled div) and `text-*`
// for the whole/partial bracket (an SVG path stroked with currentColor).
function samplingIndicatorFillColor(status: IntervalStatus) {
  if (status === "correct") return "bg-green-500";
  if (status === "incorrect") return "bg-red-500";
  return "bg-stone-300";
}

function samplingIndicatorStrokeColor(status: IntervalStatus) {
  if (status === "correct") return "text-green-500";
  if (status === "incorrect") return "text-red-500";
  return "text-stone-300";
}

/** Everything the bookmark bar's Interval chip needs. `elapsed` (like
 *  Rate's own denominator) ticks automatically whenever the session is
 *  running via the real IntervalCard's own `subscribeTick` effect — this
 *  hook only reads it (live via the store's useSyncExternalStore
 *  subscription), never re-subscribes to the tick itself. `currentIndex` is
 *  a pure function of `elapsed`, same formula the real card uses, so both
 *  agree on which interval is "current" without any shared mutable index.
 *  Scoring writes `statuses` directly — a single tap, safe even while the
 *  real card is also mounted — and clears any matching "time to check"
 *  alert, mirroring the real card's own `scoreFromCard` (not the alert's own
 *  `score`, which deliberately leaves that alert to clear itself). */
export function useIntervalChip(cardKey: string, intervalMin: number, intervalCount?: number) {
  const [elapsed] = useCardState(cardKey, "elapsed", 0);
  const { markDirty, canRecordData } = useCardSession();
  const { clearByDedupeKey } = useNotifications();

  const intervalMs = intervalMin * 60 * 1000;
  const gracedIndex = Math.max(0, Math.floor((elapsed - intervalMs / 2) / intervalMs));
  const currentIndex =
    intervalCount !== undefined ? Math.min(intervalCount - 1, gracedIndex) : gracedIndex;

  const [statuses, setStatuses] = useCardState<IntervalStatus[]>(cardKey, "statuses", () =>
    Array(currentIndex + 1).fill(null),
  );

  const score = (value: Exclude<IntervalStatus, null>) => {
    markDirty();
    setStatuses((prev) => {
      const next =
        currentIndex < prev.length
          ? [...prev]
          : [...prev, ...Array(currentIndex + 1 - prev.length).fill(null)];
      next[currentIndex] = next[currentIndex] === value ? null : value;
      return next;
    });
    clearByDedupeKey(`interval-check:${cardKey}:${currentIndex}`);
  };

  return { currentIndex, currentStatus: statuses[currentIndex] ?? null, score, canRecordData };
}

export function IntervalCard({
  id,
  title,
  phase = "Intervention",
  description,
  samplingType = "whole",
  intervalMin,
  intervalCount,
  defaultWindowHours = 4,
  positiveLabel = "Correct",
  negativeLabel = "Incorrect",
  locked = true,
  checkpointMode,
  checkpoints,
  isActive = true,
  onActivate,
  reorderEditing,
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
  detailsOpen,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop,
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: IntervalCardProps) {
  const cardKey = id ?? title;
  const { use24HourTime } = useSettings();
  // Checkpoints persist their time as the fixed "10:00a" string (see
  // parseTimeOfDayLabel's own comment on why that encoding itself never
  // changes) — this re-parses it back to 24h minutes purely for DISPLAY
  // when the setting is on, same as every other on-screen time in the app.
  const displayCpTime = (raw: string): string => {
    if (!use24HourTime) return raw;
    const parsed = parseTimeOfDayLabel(raw);
    if (!parsed) return raw;
    return `${String(parsed.hour24).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
  };
  const samplingLabel = SAMPLING_TYPE_LABEL[samplingType];
  const SamplingIcon = SAMPLING_TYPE_ICON[samplingType];
  // Splits the whole card into two mutually-exclusive modes further down —
  // checkpoint mode replaces the elapsed-interval timeline/alert entirely
  // with a fixed list of named, wall-clock-anchored checks (see the
  // checkpoint-mode block below, after `scoreFromCard`). Both branches'
  // hooks still run unconditionally either way (Rules of Hooks) — this
  // flag just decides which branch's alert fires and which branch's UI
  // actually renders.
  const isCheckpointMode = checkpointMode === "timeOfDay" && !!checkpoints?.length;
  // Session-linked elapsed time — always ticking with the session (no local
  // play/pause of its own, unlike Rate/Duration's unlocked mode) so "which
  // interval is current" is a pure function of session time, not something
  // a user can navigate ahead of or pause independently.
  const [elapsed, setElapsed] = useCardState(cardKey, "elapsed", 0); // ms
  const [expanded, setExpanded] = useState(false);
  const { sessionRunning, isSessionMine, subscribeTick, getElapsedMsNow } = useSession();
  const { markDirty, resetSignal, canRecordData } = useCardSession();

  const intervalMs = intervalMin * 60 * 1000;
  // With no fixed intervalCount, the card is open-ended: show at least
  // `defaultWindowHours` worth of intervals, growing to always keep one
  // extra (unscored, upcoming) interval past whichever one is current —
  // rather than a hard total that either runs out or gets cramped thinner
  // and thinner the longer the session runs.
  const defaultWindowIntervalCount = Math.max(
    1,
    Math.ceil((defaultWindowHours * 60) / intervalMin),
  );
  // The interval boundary that has actually, really just passed — used to
  // grow the display window and to detect exactly when the "time to check"
  // alert should fire (see below). Kept distinct from `currentIndex`
  // (below), which intentionally lags behind this by up to half an interval.
  const rawIndex = Math.floor(elapsed / intervalMs);
  const displayIntervalCount =
    intervalCount !== undefined
      ? intervalCount
      : Math.max(defaultWindowIntervalCount, rawIndex + 2);
  // The interval that's actually "current" — for scoring, highlighting, and
  // the view/nav auto-follow below — stays on the one that just finished
  // (and triggered the alert) until half of the FOLLOWING interval has also
  // elapsed, rather than snapping to the next interval the instant its
  // boundary (and the alert) fires. That gives whoever's responding to the
  // alert a grace window to actually mark it before the card moves on.
  const gracedIndex = Math.max(0, Math.floor((elapsed - intervalMs / 2) / intervalMs));
  const currentIndex =
    intervalCount !== undefined ? Math.min(intervalCount - 1, gracedIndex) : gracedIndex;

  // Which interval is being browsed/scored — like Task Analysis's own
  // `current` step, navigable with the triangle arrows below, independent
  // of `currentIndex` (the real, session-time-driven "now"). Used to auto-
  // follow `currentIndex` when it moves to a new interval (see the effect
  // below) — but only while `followLiveRef` is armed (see its own comment):
  // browsing away on its own no longer gets undone by the next interval
  // boundary ticking over mid-review.
  const [viewIdx, setViewIdx] = useCardState(cardKey, "viewIdx", currentIndex);
  const prevCurrentIndexRef = useRef(currentIndex);
  // Separate from prevCurrentIndexRef above — that one drives auto-follow
  // and must update synchronously in the same effect tick; this one just
  // guards the "time to check" alert (see below) against re-firing for a
  // boundary it's already alerted for, on its own independent effect, keyed
  // to `rawIndex` (real time) rather than `currentIndex` (which lags).
  const prevAlertRawIndexRef = useRef(rawIndex);
  // Gates the auto-follow effect below — starts armed (a fresh card opens
  // on its own live interval and should keep tracking it), but a deliberate
  // `goTo` away from the live interval disarms it, and it stays disarmed
  // through however many interval boundaries tick by while browsing a past
  // one: reviewing (or correcting) an old interval shouldn't have the view
  // yanked back to live out from under you just because real time moved on.
  // Scoring — an explicit "yes, I'm done here" — is what re-arms it, so the
  // NEXT boundary crossing resumes following live again. A ref, not state:
  // nothing ever needs to re-render off this by itself, only the one
  // `currentIndex` effect that already re-renders on its own.
  const followLiveRef = useRef(true);
  useEffect(() => {
    if (currentIndex !== prevCurrentIndexRef.current) {
      prevCurrentIndexRef.current = currentIndex;
      if (followLiveRef.current) setViewIdx(currentIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const [statuses, setStatuses] = useCardState<IntervalStatus[]>(cardKey, "statuses", () =>
    Array(displayIntervalCount).fill(null),
  );
  // A per-card preference, not session data — deliberately left out of the
  // shouldReset block below, so toggling it off doesn't get undone by the
  // next "reset session" (unlike statuses/elapsed/viewIdx, which describe
  // this session's progress rather than how the card itself should behave).
  const [alertsEnabled, setAlertsEnabled] = useCardState(cardKey, "alertsEnabled", true);
  // Grows the persisted statuses array as the open-ended window grows —
  // only ever extends (never truncates), so nothing already scored is lost.
  useEffect(() => {
    setStatuses((prev) => {
      if (prev.length >= displayIntervalCount) return prev;
      return [...prev, ...Array(displayIntervalCount - prev.length).fill(null)];
    });
  }, [displayIntervalCount]);

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setStatuses(Array(intervalCount ?? defaultWindowIntervalCount).fill(null));
    setElapsed(0);
    setViewIdx(0);
    prevCurrentIndexRef.current = 0;
    prevAlertRawIndexRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // Synced to the session's own ground-truth elapsed (getElapsedMsNow), not
  // accumulated from tick deltas — subscribeTick only delivers ticks that
  // happen AFTER a subscription starts, so a card that was unmounted for a
  // while (hidden via Edit mode, a display-mode switch, scrolled out of a
  // virtualized list, etc.) would otherwise silently stall at whatever
  // elapsed was when it last unmounted instead of catching up. Synced
  // immediately on (re)mount/resume, then again on every subsequent tick —
  // self-correcting each time rather than compounding any gap.
  useEffect(() => {
    if (!sessionRunning) return;
    setElapsed(getElapsedMsNow());
    return subscribeTick(() => setElapsed(getElapsedMsNow()));
    // getElapsedMsNow is intentionally omitted — while sessionRunning is
    // true it always computes live off refs (performance.now()), so even a
    // closure captured before its own last identity change stays accurate;
    // re-subscribing on every one of its (~4x/sec) identity changes would
    // just churn the tick-listener set for no behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRunning, subscribeTick]);

  const viewStatus = statuses[viewIdx];
  const scoredCount = statuses.filter((s) => s !== null).length;
  const isComplete = scoredCount === displayIntervalCount;

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, displayIntervalCount - 1));
    // Landing back on the live interval by navigating there yourself counts
    // as being caught up, same as scoring does — re-arms auto-follow rather
    // than leaving it disarmed until a score happens to come along.
    followLiveRef.current = clamped === currentIndex;
    setViewIdx(clamped);
  };

  // Generalized to an arbitrary index (not just `viewIdx`) — the expanded
  // view lets any interval be scored or corrected directly, mirroring Task
  // Analysis's own expanded per-step editing.
  const score = (index: number, value: Exclude<IntervalStatus, null>) => {
    followLiveRef.current = true;
    markDirty();
    setStatuses((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  };

  // Own root element ref — same "wrap the CardShell return in a plain div"
  // convention Duration/Rate cards use for their own scroll-to-card jump
  // (see useRegisterActiveTimer's elementRef) — used below so the "time to
  // check" alert's own Now button can scroll straight back to this card.
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const { push: pushNotification, clearByDedupeKey } = useNotifications();
  // Every score button that lives on the card itself (not the alert's own —
  // see below) goes through this instead of `score` directly, so recording
  // an interval retires that interval's "time to check" alert right away if
  // one's still sitting live or unread in the Notifications tab — instead
  // of leaving dead, already-answered history there. The alert's own score
  // buttons deliberately keep calling `score` directly instead: they already
  // clear themselves on their own short delay (see NotificationBar's own
  // handleIntervalScore), so clearing here too would just cut that pause
  // short.
  const scoreFromCard = (index: number, value: Exclude<IntervalStatus, null>) => {
    score(index, value);
    clearByDedupeKey(`interval-check:${cardKey}:${index}`);
  };
  // Pops a "time to check" alert the instant a new interval boundary is
  // actually crossed in real time (not while the session is paused — elapsed,
  // and so rawIndex, only ever advances while it's running; not gated by the
  // grace period above, either — the alert IS the thing announcing the
  // boundary, so it can't wait for it). It's about the interval that just
  // finished and triggered it — `rawIndex - 1` — not the one that's only
  // just starting. Scoring from the alert calls this same `score` closure
  // the card itself uses, so the bubble/button color and the alert's own
  // highlighting both come from the identical source of truth. Uses a fixed
  // "chime" sound rather than the user's own Default Alarm Sound — this is a
  // routine, repeating check, not the kind of alert that warrants the
  // louder "alarm" style some users may have chosen as their default.
  useEffect(() => {
    if (isCheckpointMode) return;
    if (rawIndex === 0) return;
    if (rawIndex === prevAlertRawIndexRef.current) return;
    // A jump of more than one step means this render is catching up from a
    // stale baseline, not observing a single boundary actually cross in
    // real time — `elapsed` starts at 0 on mount (see its own useCardState
    // default) and only gets corrected to the session's real elapsed time
    // by a separate, later effect (see its own comment on why that one
    // isn't a layout effect), so `prevAlertRawIndexRef`'s OWN initial value
    // (captured from that same pre-sync `rawIndex`) is 0 too — the first
    // render after the real value lands can jump straight from 0 to
    // whatever interval the session is actually several hours into,
    // without ever passing through 1, 2, 3... Firing for `rawIndex - 1`
    // here would announce a "just crossed" boundary that in reality
    // finished hours before this card even mounted. Same philosophy as the
    // checkpoint-mode alert below (a checkpoint that already passed before
    // mount is simply missed, never backfilled) — silently re-baseline
    // instead of alerting for every interval skipped while catching up.
    const skippedAhead = rawIndex > prevAlertRawIndexRef.current + 1;
    prevAlertRawIndexRef.current = rawIndex;
    if (skippedAhead) return;
    // Bookkeeping above still runs with alerts off, so re-enabling doesn't
    // dump a backlog of alerts for every boundary that passed while muted.
    if (!alertsEnabled) return;
    const alertedIndex = rawIndex - 1;
    // A fixed intervalCount card has nothing left to check once its last
    // interval has already passed — rawIndex keeps climbing for as long as
    // the session keeps running, but there's no real interval left to alert
    // (or score) for.
    if (intervalCount !== undefined && alertedIndex > intervalCount - 1) return;
    // Already marked (scored ahead of time on the card itself, e.g. via the
    // expanded view's per-row buttons) — nothing left for the alert to ask.
    if (statuses[alertedIndex] != null) return;
    pushNotification({
      dedupeKey: `interval-check:${cardKey}:${alertedIndex}`,
      kind: "alert-now",
      title: `Check if ${positiveLabel}`,
      body: intervalCheckRangeLabel(alertedIndex, intervalMin),
      icon: "bell-chime",
      allowSnooze: true,
      soundOverride: "chime",
      // Ticks (and so can cross an interval boundary) for ANY running
      // session, not just your own — `sessionRunning` alone doesn't
      // distinguish browsing someone else's live session from actually
      // running yours. Only pop the live banner for the latter; otherwise
      // it still lands in the Notifications tab, same as ScheduleView's own
      // alerts (see that file's matching `live:` gate).
      live: sessionRunning && isSessionMine,
      intervalCheck: {
        positiveLabel,
        negativeLabel,
        initialStatus: statuses[alertedIndex] ?? null,
        onScore: (value) => score(alertedIndex, value),
        onScrollToCard: () =>
          cardElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawIndex]);

  // ---- Checkpoint mode (checkpointMode === "timeOfDay") ----
  // A wholly separate scoring track from the elapsed-interval one above —
  // one status per named checkpoint, driven by the real wall clock instead
  // of session elapsed time, so it keeps ticking (and can still alert)
  // whether or not a session is even running. Hooks below still run
  // unconditionally for a non-checkpoint card (Rules of Hooks); they're
  // just inert in that case (checkpoints is empty, so nothing here ever
  // fires or renders).
  const [checkpointStatuses, setCheckpointStatuses] = useCardState<IntervalStatus[]>(
    cardKey,
    "checkpointStatuses",
    () => Array(checkpoints?.length ?? 0).fill(null),
  );
  // Grows/shrinks the persisted array to match the authored checkpoint
  // list, same idea as the interval track's own "grow the window" effect —
  // but this one can also shrink (a checkpoint removed in the admin dialog
  // shouldn't leave a dangling status behind).
  useEffect(() => {
    const n = checkpoints?.length ?? 0;
    setCheckpointStatuses((prev) => {
      if (prev.length === n) return prev;
      if (prev.length > n) return prev.slice(0, n);
      return [...prev, ...Array(n - prev.length).fill(null)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints?.length]);
  useEffect(() => {
    if (!shouldReset || !isCheckpointMode) return;
    setCheckpointStatuses(Array(checkpoints?.length ?? 0).fill(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // The shared demo clock (ScheduleContext), not an independent real wall
  // clock — a checkpoint's alert firing at "10am" needs to agree with
  // whatever the Schedule tab itself considers 10am right now, which for
  // this demo is a simulated time that only moves via that tab's own "tap
  // to advance" control, not real ticking. Previously ticked its own
  // `new Date()` every 30s, which (correctly, on its own terms) tracked
  // the real clock — but that meant this card's "now" and the Schedule
  // tab's own "now" could show two different times for the same moment.
  const { now } = useScheduleData();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  // Parsed once per render rather than baked into the authored data itself —
  // `checkpoints[].time` stays the same already-formatted "10:00a" string
  // the admin dialog shows back, and this is the one place that actually
  // needs it as a comparable number of minutes since midnight.
  const checkpointMinutes = (checkpoints ?? []).map((cp) => {
    const parsed = parseTimeOfDayLabel(cp.time);
    return parsed ? parsed.hour24 * 60 + parsed.minute : null;
  });
  // The latest checkpoint whose time has already arrived today, so there's
  // always a sensible "current" one to land on — same convention as the
  // interval track's own gracedIndex — falling back to the first checkpoint
  // before any of today's have arrived yet.
  const currentCheckpointIndex = checkpointMinutes.reduce<number>(
    (best, min, i) => (min !== null && min <= nowMin ? i : best),
    0,
  );
  const [checkpointViewIdx, setCheckpointViewIdx] = useCardState(
    cardKey,
    "checkpointViewIdx",
    currentCheckpointIndex,
  );
  const prevCurrentCheckpointIndexRef = useRef(currentCheckpointIndex);
  // Same auto-follow gate as the interval track's own followLiveRef above —
  // browsing back to an earlier checkpoint shouldn't get undone the instant
  // the day's next checkpoint comes due; only actually scoring one re-arms it.
  const followLiveCheckpointRef = useRef(true);
  useEffect(() => {
    if (!isCheckpointMode) return;
    if (currentCheckpointIndex !== prevCurrentCheckpointIndexRef.current) {
      prevCurrentCheckpointIndexRef.current = currentCheckpointIndex;
      if (followLiveCheckpointRef.current) setCheckpointViewIdx(currentCheckpointIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCheckpointIndex, isCheckpointMode]);

  const scoreCheckpoint = (index: number, value: Exclude<IntervalStatus, null>) => {
    followLiveCheckpointRef.current = true;
    markDirty();
    setCheckpointStatuses((prev) => {
      const next = [...prev];
      next[index] = next[index] === value ? null : value;
      return next;
    });
  };
  const scoreCheckpointFromCard = (index: number, value: Exclude<IntervalStatus, null>) => {
    scoreCheckpoint(index, value);
    clearByDedupeKey(`interval-checkpoint:${cardKey}:${index}:${now.toDateString()}`);
  };
  // Fires each checkpoint's own alert the instant its time is actually
  // crossed while this card is mounted and watching — edge-triggered, same
  // idea as the interval alert above (and ScheduleView's own alert-firing
  // effect): only a checkpoint whose time falls between the last observed
  // "now" and this one counts as crossed. `prevNowMinRef` starts at null and
  // gets seeded to the CURRENT nowMin on this effect's first run rather than
  // some earlier default, so a checkpoint that already passed before this
  // card ever mounted (or before it got remounted after being hidden) is
  // simply missed, never backfilled — starting a session at 4pm does not
  // retroactively alert for 10am/noon/2pm.
  const prevNowMinRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isCheckpointMode) return;
    const prevMin = prevNowMinRef.current;
    prevNowMinRef.current = nowMin;
    if (prevMin === null) return;
    if (nowMin <= prevMin) return; // guards against the real clock going backward (DST, etc.)
    if (!alertsEnabled) return;
    const dayKey = now.toDateString();
    (checkpoints ?? []).forEach((cp, i) => {
      const min = checkpointMinutes[i];
      if (min === null || !(prevMin < min && nowMin >= min)) return;
      if (checkpointStatuses[i] != null) return;
      pushNotification({
        dedupeKey: `interval-checkpoint:${cardKey}:${i}:${dayKey}`,
        kind: "alert-now",
        title: cp.alertText?.trim() || `Check ${cp.label}`,
        body: `${cp.label} — ${displayCpTime(cp.time)}`,
        icon: "bell-chime",
        allowSnooze: true,
        soundOverride: "chime",
        live: sessionRunning && isSessionMine,
        intervalCheck: {
          positiveLabel,
          negativeLabel,
          initialStatus: checkpointStatuses[i] ?? null,
          onScore: (value) => scoreCheckpoint(i, value),
          onScrollToCard: () =>
            cardElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMin, isCheckpointMode]);

  const checkpointScoredCount = checkpointStatuses.filter((s) => s !== null).length;
  const checkpointCount = checkpoints?.length ?? 0;
  const checkpointIsComplete = checkpointCount > 0 && checkpointScoredCount === checkpointCount;
  const goToCheckpoint = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, checkpointCount - 1));
    followLiveCheckpointRef.current = clamped === currentCheckpointIndex;
    setCheckpointViewIdx(clamped);
  };

  // One status report per card regardless of mode — whichever track is
  // actually active (see isCheckpointMode) is the one whose progress
  // actually matters to the Data toolbar's "needs attention" list; the
  // other track's numbers are meaningless while inactive (interval mode's
  // own scoredCount/isComplete still exist, computed above, but checkpoint
  // mode's replace them entirely rather than the two being merged/summed).
  useReportCardStatus(
    cardKey,
    isCheckpointMode ? checkpointScoredCount > 0 : scoredCount > 0,
    isCheckpointMode ? checkpointIsComplete : isComplete,
    {
      title,
      kind: "interval",
      value: isCheckpointMode
        ? `${checkpointScoredCount}/${checkpointCount}`
        : `${scoredCount}/${displayIntervalCount}`,
      unit: isCheckpointMode ? "Checkpoints Marked" : "Intervals Marked",
    },
  );

  const measurementLabelOverride = {
    positive: `Mark ${positiveLabel} if`,
    negative: `Mark ${negativeLabel} if`,
  };

  // Rendered inside the timeline itself, following the "now" chevron rather
  // than sitting in the header — see IntervalTimeline's own `timerPill` prop.
  const timerPill = locked ? (
    <span
      aria-label="Locked to session time"
      title="Locked to session time"
      className="inline-flex items-center shrink-0 rounded-full border border-border bg-stone-100 pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-muted-foreground"
    >
      {formatCompactTime(elapsed)}
      <Link2 className="ml-1 size-3 rotate-45" strokeWidth={2.5} />
    </span>
  ) : (
    <TimeKeypad
      valueMs={elapsed}
      onReplace={(ms) => {
        setElapsed(Math.max(0, ms));
        markDirty();
      }}
      onAdd={(ms) => {
        setElapsed(Math.max(0, elapsed + ms));
        markDirty();
      }}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          disabled={!canRecordData}
          aria-label="Edit elapsed time (testing)"
          className="inline-flex items-center shrink-0 rounded-full border border-blue-500 bg-white pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-foreground cursor-text hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {formatCompactTime(elapsed)}
        </button>
      )}
    </TimeKeypad>
  );
  // Checkpoint mode's own equivalent of the pill above — the real wall
  // clock instead of session elapsed, since that's what its own chevron is
  // actually tracking (see checkpointFillFrac). Always "locked": there's no
  // session-time-editing test hook equivalent for a checkpoint schedule.
  const checkpointTimerPill = (
    <span
      aria-label="Current time"
      title="Current time"
      className="inline-flex items-center shrink-0 rounded-full border border-border bg-stone-100 pl-2 pr-1 py-0.5 h-5 text-[11px] font-bold tabular-nums text-muted-foreground"
    >
      {formatTimeOfDaySecondsForDisplay(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
        use24HourTime,
      )}
    </span>
  );

  const details = (
    <>
      <DrawerQuickFacts
        icon={<SamplingIcon />}
        kind="interval"
        dataTypeLabel={samplingLabel}
        phase={phase}
        stats={
          isCheckpointMode
            ? [
                { label: "Checkpoints", value: `${checkpointCount}` },
                { label: "Scored", value: `${checkpointScoredCount} / ${checkpointCount}` },
              ]
            : [
                { label: "Interval", value: `${intervalMin}m` },
                { label: "Scored", value: `${scoredCount} / ${displayIntervalCount}` },
              ]
        }
      />
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <label htmlFor={`${cardKey}-alerts-enabled`} className="text-sm font-medium">
            {isCheckpointMode ? "Alert at each checkpoint" : "Alert at intervals"}
          </label>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {isCheckpointMode
              ? "Notify when each checkpoint's time arrives, prompting a check."
              : "Notify when each interval ends, prompting a check."}
          </p>
        </div>
        <Switch
          id={`${cardKey}-alerts-enabled`}
          checked={alertsEnabled}
          onCheckedChange={setAlertsEnabled}
          className="shrink-0"
        />
      </div>
      {(teachingProcedure || description) && (
        <div className="mt-4">
          <TeachingProcedureAccordion
            description={description}
            data={teachingProcedure}
            kind="interval"
            measurementLabelOverride={measurementLabelOverride}
          />
        </div>
      )}
    </>
  );

  // Shared between the tile/list/standard renders below so each one only
  // has to branch once (here) instead of repeating the isCheckpointMode
  // ternary at every single usage site.
  const activeViewIdx = isCheckpointMode ? checkpointViewIdx : viewIdx;
  const activeCount = isCheckpointMode ? checkpointCount : displayIntervalCount;
  const activeStatuses = isCheckpointMode ? checkpointStatuses : statuses;
  const activeViewStatus = activeStatuses[activeViewIdx] ?? null;
  const activeScoreFromCard = isCheckpointMode ? scoreCheckpointFromCard : scoreFromCard;
  const activeGoTo = isCheckpointMode ? goToCheckpoint : goTo;
  const activeScoredCount = isCheckpointMode ? checkpointScoredCount : scoredCount;
  const activeIsComplete = isCheckpointMode ? checkpointIsComplete : isComplete;
  // The tile's own compact sub-label — just the interval range ("0-30m"),
  // not intervalLabel's own leading "1: " (redundant here: the tile already
  // shows that same step number as its own big centered digit right above
  // this) — or, for a checkpoint, its clock time and name together, since
  // the time alone wouldn't say what it's actually checking.
  const activeSubLabel = isCheckpointMode
    ? checkpoints && checkpoints[activeViewIdx]
      ? `${displayCpTime(checkpoints[activeViewIdx].time)} · ${checkpoints[activeViewIdx].label}`
      : ""
    : intervalRange(activeViewIdx, intervalMin);

  // The shared timeline's own "now" fill position, in the same SEG_W (and
  // ROW_SLOT, for the expanded view's vertical bar) per-segment units its
  // bubbles/dividers already use — computed here rather than inside the
  // timeline components themselves, so both modes can hand it a plain pixel
  // number without either needing to know how the OTHER mode derives it
  // (equal-length elapsed intervals vs. wherever "now" falls between two
  // arbitrarily-spaced wall-clock checkpoints).
  const intervalSegFillFrac = Math.min(
    1,
    Math.max(0, (elapsed - rawIndex * intervalMs) / intervalMs),
  );
  const intervalFillFrac = rawIndex + intervalSegFillFrac;
  // Before the first checkpoint, nothing's filled yet; past the last one,
  // it's pinned fully filled (there's no next checkpoint to fill toward) —
  // otherwise it's the fraction of the way from checkpoint i to i+1 that
  // "now" currently sits at, same idea as interval mode's own segFillFrac
  // but between two arbitrary times rather than a fixed-length interval.
  const checkpointFillFrac = (() => {
    const mins = checkpointMinutes;
    const n = mins.length;
    if (n === 0 || mins[0] === null || nowMin < mins[0]) return 0;
    for (let i = 0; i < n - 1; i++) {
      const a = mins[i];
      const b = mins[i + 1];
      if (a === null || b === null) continue;
      if (nowMin < b) return i + 1 + Math.min(1, Math.max(0, (nowMin - a) / (b - a)));
    }
    return n;
  })();
  const activeFillFrac = isCheckpointMode ? checkpointFillFrac : intervalFillFrac;

  if (tileDensity) {
    const large = tileDensity === "large";
    return (
      <MiniTileShell
        title={title}
        density={tileDensity}
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        progress={(activeScoredCount / activeCount) * 100}
        isComplete={activeIsComplete}
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2.5" : "gap-1.5")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                activeScoreFromCard(activeViewIdx, "incorrect");
              }}
              disabled={!canRecordData}
              aria-label={negativeLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                activeViewStatus === "incorrect"
                  ? "bg-red-500 border-red-600 text-white"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              <X className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                activeScoreFromCard(activeViewIdx, "correct");
              }}
              disabled={!canRecordData}
              aria-label={positiveLabel}
              className={cn(
                "btn-bevel shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                large ? "size-[42px]" : "size-7",
                activeViewStatus === "correct"
                  ? "bg-green-500 border-green-600 text-white"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
              )}
            >
              <Check className={large ? "size-[19px]" : "size-3.5"} strokeWidth={3} />
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-0">
          {/* relative inline-flex wraps just the current-index number — same
              technique as RateCard's/FrequencyCard's own tile number: the
              "/count" suffix hangs off it via absolute positioning instead
              of sitting in normal flex flow, so its width doesn't shift the
              number off the tile's true center. */}
          <div className="relative inline-flex items-center">
            <span
              className={cn(
                "font-display leading-none tabular-nums",
                large ? "text-[32px]" : "text-[24px]",
              )}
            >
              {activeViewIdx + 1}
            </span>
            <span
              className={cn(
                "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-foreground/30",
                large ? "-right-7" : "-right-6",
              )}
              aria-hidden
            >
              <span className={cn("font-display", large ? "text-lg" : "text-sm")}>/</span>
              <span
                className={cn(
                  "font-display leading-none tabular-nums text-foreground/50",
                  large ? "text-lg" : "text-sm",
                )}
              >
                {activeCount}
              </span>
            </span>
          </div>
          <span
            className={cn(
              // -mt-1.5: the gap between this and the number above reads as
              // much bigger than the layout itself accounts for (measured:
              // 0px — this and the number's own wrapper already sit flush)
              // — it's leading-none's own residual line-height padding
              // inside the number's line box (a display font's ascent/
              // descent metrics leave real empty space above/below the
              // glyph even at line-height:1), not a margin/gap either
              // element controls directly. Pulling this up is the only way
              // to actually close it.
              "-mt-1.5 text-muted-foreground tabular-nums truncate max-w-full",
              large ? "text-[11px]" : "text-[9px]",
            )}
          >
            {activeSubLabel}
          </span>
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<SamplingIcon />}
        kind="interval"
        dataTypeLabel={samplingLabel}
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        progress={(activeScoredCount / activeCount) * 100}
        isComplete={activeIsComplete}
        actions={
          <div className="flex items-center gap-1">
            <ListActionBadge value={activeViewIdx + 1} weight="regular" />
            <ListActionButton
              icon={X}
              variant="red"
              selected={activeViewStatus === "incorrect"}
              disabled={!canRecordData}
              ariaLabel={negativeLabel}
              onClick={() => activeScoreFromCard(activeViewIdx, "incorrect")}
            />
            <ListActionButton
              icon={Check}
              variant="green"
              selected={activeViewStatus === "correct"}
              disabled={!canRecordData}
              ariaLabel={positiveLabel}
              onClick={() => activeScoreFromCard(activeViewIdx, "correct")}
            />
          </div>
        }
      />
    );
  }

  return (
    <div ref={cardElRef} className="w-full max-w-md scroll-mt-32">
      <CardShell
        title={title}
        phase={phase}
        dataType={samplingLabel}
        dataTypeIcon={<SamplingIcon />}
        kind="interval"
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        expanded={expanded}
        onToggleExpanded={() => {
          if (expanded) {
            // Same idea as TrialCard/TaskAnalysisCard's own twirl-down:
            // collapsing should land back on whichever interval/checkpoint
            // hasn't been marked yet, not wherever the stepper happened to
            // be pointed before expanding. Temporary for interval mode — the
            // next real interval boundary snaps viewIdx back to live
            // regardless (see viewIdx's own comment above); checkpoint mode
            // has no such auto-follow once a checkpoint's had its own alert.
            const firstUnscored = activeStatuses.indexOf(null);
            if (firstUnscored !== -1) activeGoTo(firstUnscored);
          }
          setExpanded((v) => !v);
        }}
        expandedView={
          <IntervalExpandedView
            intervalCount={activeCount}
            samplingType={samplingType}
            rowLabel={
              isCheckpointMode
                ? (i) => {
                    const cp = checkpoints?.[i];
                    // Just the checkpoint's own time — its dose/checkpoint
                    // name used to follow after a middot, but a name long
                    // enough to matter (anything past a couple words) got
                    // cut off by this row's own `truncate` well before
                    // reaching the score buttons, always landing as a bare
                    // "10:00a ·…" with nothing legible after it. The
                    // standard view's own header still spells the name out
                    // in full for whichever checkpoint is current.
                    return cp ? displayCpTime(cp.time) : "";
                  }
                : (i) => intervalRange(i, intervalMin)
            }
            statuses={activeStatuses}
            viewIdx={activeViewIdx}
            fillFrac={activeFillFrac}
            canRecordData={canRecordData}
            positiveLabel={positiveLabel}
            negativeLabel={negativeLabel}
            onScore={activeScoreFromCard}
            timerPill={isCheckpointMode ? checkpointTimerPill : timerPill}
          />
        }
      >
        <div className="px-5 pt-2 pb-4 flex flex-col gap-0">
          <div
            className={cn("text-center text-sm font-semibold", !isCheckpointMode && "tabular-nums")}
          >
            {isCheckpointMode
              ? `${checkpoints?.[activeViewIdx]?.time ? displayCpTime(checkpoints[activeViewIdx].time) : ""}${
                  checkpoints?.[activeViewIdx]?.label
                    ? ` — ${checkpoints[activeViewIdx].label}`
                    : ""
                }`
              : intervalEndLabel(viewIdx, intervalMin)}
          </div>

          <div className="relative px-10">
            <TriangleNav
              direction="left"
              onClick={() => activeGoTo(activeViewIdx - 1)}
              onDoubleClick={() => activeGoTo(0)}
              disabled={activeViewIdx <= 0}
            />
            <TriangleNav
              direction="right"
              onClick={() => activeGoTo(activeViewIdx + 1)}
              onDoubleClick={() => activeGoTo(activeCount - 1)}
              disabled={activeViewIdx >= activeCount - 1}
            />
            <IntervalTimeline
              intervalCount={activeCount}
              fillFrac={activeFillFrac}
              viewIdx={activeViewIdx}
              statuses={activeStatuses}
              samplingType={samplingType}
              timerPill={isCheckpointMode ? checkpointTimerPill : timerPill}
            />
          </div>

          <div className="mt-2 flex items-center gap-3">
            <ScoreButton
              variant="negative"
              label={negativeLabel}
              selected={activeViewStatus === "incorrect"}
              disabled={!canRecordData}
              onClick={() => activeScoreFromCard(activeViewIdx, "incorrect")}
            />
            <ScoreButton
              variant="positive"
              label={positiveLabel}
              selected={activeViewStatus === "correct"}
              disabled={!canRecordData}
              onClick={() => activeScoreFromCard(activeViewIdx, "correct")}
            />
          </div>
        </div>
      </CardShell>
    </div>
  );
}

// The "now" chevron is the Schedule tab's own arrow (see ScheduleView.tsx),
// same path and 16x20 aspect ratio — an established style reused as-is
// rather than reshaped, and rotated -90° for the horizontal timeline
// (below) so it instead points UP, crossing that bar from underneath;
// used un-rotated for the expanded view's own vertical bar, where it
// already points the right way as-is.
const NOW_CHEVRON_PATH = "M3 2 Q1 2 1 4 V16 Q1 18 3 18 L13 11.5 Q15 10 13 8.5 Z";

// Fixed px per interval segment (both timelines) — keeps each interval a
// comfortable, constant size no matter how many total intervals exist,
// rather than getting squeezed thinner the longer an open-ended card's
// window grows. The track is free to run wider/taller than its own
// viewport; each viewport auto-scrolls (a spring transform, not real
// scroll) to keep the viewed interval in frame and fades its own trailing
// edge, the same idiom as Percent Correct's own draggable trial-bubble
// strip.
const SEG_W = 64;
const BAR_H = 10;
// The sampling-type row sits between the bubble row and the elapsed-time
// bar. Whole/Partial render a bracket there — a sideways curly brace
// ("{" on its side: a single point at top, straight arms spreading down
// to hooked ends) sized to the segment's own full or half width. The
// point sits at the row's own top edge, right where the bubble above it
// is — the bracket reads as hanging FROM the bubble, not pointing at the
// bar — while its two hooked ends reach down to the bar below. Momentary
// instead renders a short connector line down from its bubble, with its
// own dot actually living on the bar below (see that bar's own comment)
// rather than in this row. Connector height and the bracket's own total
// height both equal SAMPLING_ROW_H, so every variant reaches exactly as
// far down, right to the bar's edge.
const SAMPLING_ROW_H = 12;
// Bigger than the bar's own thickness (BAR_H = 10) on purpose — a
// same-size or smaller dot read as just another segment of the bar rather
// than a distinct marker sitting on top of it.
const SAMPLING_DOT_SIZE = 13;
// The bar row's own total height — taller than the bar itself (BAR_H) so
// the momentary dot (deliberately bigger than the bar, see above) has room
// to actually poke out top/bottom instead of being clipped by this row's
// own overflow-hidden (needed for the carousel's horizontal windowing, not
// for the bar's own vertical thickness). BAR_INSET centers the visual bar
// within that taller row; every element that used to assume the bar sat
// flush at the row's own top edge (top: 0) now sits BAR_INSET down instead.
const BAR_ROW_H = SAMPLING_DOT_SIZE;
const BAR_INSET = (BAR_ROW_H - BAR_H) / 2;
// How far each hooked end rises from the bar's edge before the arms start
// angling in toward the point at top — same proportions as the icon
// variants (IntervalWholeIcon/IntervalPartialIcon) so the two read as the
// same shape at different sizes, not two different designs.
const BRACKET_TICK_PX = 4;
// The bracket's own apex (and momentary's connector line, which reaches the
// same distance) starts this far down from the row's own top edge instead
// of right at y=0 — flush against 0 had the point/line touching the bubble
// sitting just above this row.
const SAMPLING_TOP_GAP_PX = 4;
// Same diameter as every period bubble (see IntervalTimeline's own comment) —
// hoisted here so the nav arrows below can vertically center themselves on
// the bubble row specifically, rather than the timeline's full height
// (bubbles + bar + chevron).
const BUBBLE = 24;
// The currently-viewed interval's own bubble stands out at a larger size —
// same "active is bigger" idiom used elsewhere (e.g. the enlarged current
// dot on other cards' quick-glance strips) — so it needs its own row height
// tall enough to fit without clipping (bubbles are bottom-anchored, so the
// bigger one simply grows upward).
const BUBBLE_CURRENT = 40;
const BUBBLE_ROW_H = BUBBLE_CURRENT;
// Matches IntervalTimeline's own leading `pt-0.5` before the bubble row —
// trimmed down from the interval label above so the bigger current bubble
// doesn't need to float as far below it.
const BUBBLE_ROW_TOP_PX = 2;
const NAV_CENTER_PX = BUBBLE_ROW_TOP_PX + BUBBLE_ROW_H / 2;
// The "now" chevron's own half-width, roughly, once rotated on its side —
// extra room so it can render in full even parked right at a track edge.
// Chevron width (its rotated SVG footprint, unrotated height 20) + a small
// gap + the timer pill's own height (h-5) stacked underneath it, following
// the same x position.
const CHEVRON_ROW_H = 20 + 4 + 20;
// How far the chevron's own tip pokes up into the bar above it (standard
// view) / right into the bar beside it (expanded view) — about half the
// bar's own thickness, so the tip visually meets the bar rather than
// pointing at a gap underneath/beside it.
const CHEVRON_OVERLAP_PX = 5;
const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 32 } as const;
// Fades both edges — like Percent Correct's own trial-bubble strip, the
// viewed interval sits centered in the viewport with past/future segments
// trailing off on either side, so both directions need to fade out. Narrow
// and hugging the edge, rather than eating a big chunk of the viewport.
// Exported for BookmarkBar.tsx, which reuses this same CSS mask (just not
// the rest of this file's Framer-Motion-driven carousel) for its own
// edge-fade over native overflow-x scroll.
export const HORIZONTAL_FADE_MASK = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
  maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
} as const;

function IntervalTimeline({
  intervalCount,
  fillFrac,
  viewIdx,
  statuses,
  samplingType,
  timerPill,
}: {
  intervalCount: number;
  // Precomputed by the caller as a fractional segment position (2.35 =
  // 35% of the way through segment 3) rather than a raw pixel offset, so
  // this component is the only place that has to know SEG_W — interval
  // mode derives it from elapsedMs/intervalMs (continuous, equal-length
  // segments), checkpoint mode from where "now" falls between two
  // wall-clock checkpoint times (not necessarily equal-length gaps); this
  // component doesn't need to know which.
  fillFrac: number;
  viewIdx: number;
  statuses: IntervalStatus[];
  samplingType: SamplingType;
  timerPill: ReactNode;
}) {
  const fillPx = fillFrac * SEG_W;
  // Every period is an equal length of time, so its bubble is the same size
  // as every other's — only the border weight and the solid/faded/gray
  // recency treatment set one apart from another, not a bigger diameter.
  // (BUBBLE itself lives at module scope — the nav arrows need it too.)
  // Every interval before the real (not graced) current one is fully
  // elapsed; that one itself is partially filled; nothing after it is
  // filled at all — a single continuous fill width follows directly from
  // that, rather than a percentage of some fixed (and, for an open-ended
  // card, nonexistent) total duration. This "now" fill/chevron always
  // reflects the real session clock, independent of whatever interval is
  // being browsed OR of `currentIndex`'s own half-interval scoring grace
  // (see its own comment above) — that grace only delays which interval
  // is highlighted/scored, not where "now" actually, physically is.
  // Continuous centering, the same idiom as Percent Correct's own
  // trial-bubble strip: the SAME track transform drives every row (bubble,
  // sampling indicator, bar, chevron) so they all move as one piece — only
  // each row's own LOCAL per-element position (see below) determines where
  // within that shared, moving track a given element actually lands.
  // Targets the interval's real END boundary; the current interval's own
  // bar segment (spanning one SEG_W ending at that boundary) therefore
  // spans from -SEG_W to 0 on screen, not centered on 0 itself — its
  // MIDPOINT (screen -SEG_W/2) is what Whole/Partial's bubble+bracket
  // target instead (see their own comments), which is what actually keeps
  // them centered over the bar segment they belong to, not the viewport.
  const trackOffsetPx = -((viewIdx + 1) * SEG_W);

  return (
    <div className="pt-0.5">
      {/* Period bubbles — parked in place above their own segment (not a
          draggable/swipeable strip like Percent Correct's trial bubbles),
          gray until scored then colored to match the button that scored
          it. The currently-viewed one grows larger to stand out. */}
      <div
        className="relative overflow-hidden"
        style={{ height: BUBBLE_ROW_H, ...HORIZONTAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          style={{ height: BUBBLE_ROW_H }}
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          {Array.from({ length: intervalCount }, (_, i) => {
            const recency = recencyOf(i, viewIdx);
            const { bg, text, fade } = statusColors(statuses[i], recency);
            const isCurrent = recency === "current";
            // Whole/Partial's bubble sits centered over its own interval,
            // matching where its bracket sits (see that row's own comment)
            // — a span of time reads more naturally under a bubble
            // centered over the whole span than one parked at its far
            // edge. Momentary's bubble stays at the interval's real END
            // boundary instead, since it scores that one specific instant
            // — a real point in time, not a span, so there's no "span" to
            // center over.
            const bubbleLeft = samplingType === "momentary" ? (i + 1) * SEG_W : (i + 0.5) * SEG_W;
            return (
              <div
                key={i}
                className="absolute bottom-0 -translate-x-1/2"
                style={{ left: bubbleLeft }}
              >
                <motion.div
                  className={cn(
                    "rounded-full flex items-center justify-center font-display font-bold tabular-nums transition-colors duration-200",
                    isCurrent ? "border-2 text-sm" : "border text-[11px]",
                    bg,
                    text,
                    fade,
                  )}
                  animate={{
                    width: isCurrent ? BUBBLE_CURRENT : BUBBLE,
                    height: isCurrent ? BUBBLE_CURRENT : BUBBLE,
                  }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                >
                  {i + 1}
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>
      {/* Sampling-type indicator — sits between the bubble row and the
          elapsed-time bar. Whole/Partial show a bracket here (a sideways
          curly brace, full or half width, its point hanging from the
          bubble above and its two hooked ends reaching down to the bar
          below) for the currently-viewed interval ONLY — every other
          interval's own bracket would just repeat the same fixed shape for
          that sampling type card-wide, adding visual noise without adding
          information; showing it only where you're actually looking (and
          about to score) is what actually matters moment to moment.
          Momentary has no span to show — just a connector dropping from
          the bubble down to meet the bar, where its own dot actually lives
          (see the bar's own comment below): "on the timeline," matching
          how Whole/Partial's bracket reads as part of it. That connector/
          dot pair still renders for every interval (it doubles as each
          one's own scored/unscored status, same as the bar's fill), unlike
          the single-interval bracket above. Gray when unscored, not just
          appearing once scored — this is a legend for what the card is
          measuring, not a "you scored this" celebration mark. */}
      <div
        className="relative overflow-hidden"
        style={{ height: SAMPLING_ROW_H, ...HORIZONTAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          style={{ height: SAMPLING_ROW_H }}
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          {Array.from({ length: intervalCount }, (_, i) => {
            // Current-interval-only for both variants — momentary's own
            // connector used to draw for every interval regardless, which
            // was just noise for anything but the one actually being looked
            // at (the bracket already worked this way).
            if (i !== viewIdx) return null;
            if (samplingType === "momentary") {
              return (
                <div
                  key={i}
                  // Same 2px thickness as the bracket's own stroke, and
                  // starting SAMPLING_TOP_GAP_PX down instead of flush at
                  // the row's top — both so it stops touching the bubble
                  // sitting just above this row. Colored the same way as
                  // the bracket above (samplingIndicatorFillColor is this
                  // connector's own bg-* counterpart to the bracket's
                  // text-*-based samplingIndicatorStrokeColor) rather than
                  // a flat gray, so it reflects this interval's scored
                  // status just like the bracket and the dot it leads down
                  // to already do.
                  className={cn(
                    "absolute w-0.5 -translate-x-1/2",
                    samplingIndicatorFillColor(statuses[i]),
                  )}
                  style={{
                    left: (i + 1) * SEG_W,
                    top: SAMPLING_TOP_GAP_PX,
                    height: SAMPLING_ROW_H - SAMPLING_TOP_GAP_PX,
                  }}
                  aria-hidden
                />
              );
            }
            const width = samplingType === "partial" ? SEG_W / 2 : SEG_W;
            const left = i * SEG_W + (SEG_W - width) / 2;
            return (
              <svg
                key={i}
                aria-hidden
                className={cn("absolute top-0", samplingIndicatorStrokeColor(statuses[i]))}
                style={{ left, width, height: SAMPLING_ROW_H }}
                viewBox={`0 0 ${width} ${SAMPLING_ROW_H}`}
              >
                <path
                  d={`M1,${SAMPLING_ROW_H} L1,${SAMPLING_ROW_H - BRACKET_TICK_PX} L${width / 2},${SAMPLING_TOP_GAP_PX} L${width - 1},${SAMPLING_ROW_H - BRACKET_TICK_PX} L${width - 1},${SAMPLING_ROW_H}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })}
        </motion.div>
      </div>
      {/* The single combined progress indicator: the gray track fills light
          blue as the session clock advances, and the chevron below marks
          exactly how far the fill has reached — no separate "percent
          scored" bar duplicating this one. The gray/blue pill is sized to
          the track's own true bounds (0 to the last interval's end), not
          the viewport — otherwise, once the viewed interval is centered,
          gray backdrop would show through before the session's own start. */}
      <div
        data-tour="interval-progress"
        className="relative overflow-hidden mt-0.5"
        style={{ height: BAR_ROW_H, ...HORIZONTAL_FADE_MASK }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div
            className="absolute rounded-full overflow-hidden bg-stone-200"
            style={{ top: BAR_INSET, left: 0, height: BAR_H, width: intervalCount * SEG_W }}
          >
            <div
              className="absolute bg-blue-200 transition-[width]"
              style={{ top: 0, left: 0, height: BAR_H, width: fillPx }}
              aria-hidden
            />
          </div>
          {Array.from({ length: intervalCount - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute w-px bg-white"
              style={{ top: BAR_INSET, height: BAR_H, left: (i + 1) * SEG_W }}
              aria-hidden
            />
          ))}
          {/* Whole/Partial's own scored-color accent — the same colored
              edge stripe the expanded view's own vertical bar already
              shows per interval, brought over to this horizontal bar too.
              Partial's own stripe is half-width and centered on its
              segment, matching its bracket above; Whole's spans the full
              segment, also matching its own (full-width) bracket. Shown
              for every scored interval, not just the current one — this is
              read-at-a-glance history, unlike the single-interval bracket
              above. */}
          {(samplingType === "whole" || samplingType === "partial") &&
            Array.from({ length: intervalCount }, (_, i) => {
              const status = statuses[i];
              if (status == null) return null;
              const width = samplingType === "partial" ? SEG_W / 2 : SEG_W;
              const left = i * SEG_W + (SEG_W - width) / 2;
              return (
                <div
                  key={`seg-${i}`}
                  className={cn(
                    "absolute rounded-full",
                    status === "correct" ? "bg-green-500" : "bg-red-500",
                  )}
                  // Explicit `top` rather than `bottom-0` — this sits inside
                  // the same motion.div as every sibling here (the fill
                  // track, momentary's dots), which has no explicit height
                  // of its own since ALL of its children are absolutely
                  // positioned; `bottom-0` resolved against that (in effect
                  // zero) height instead of the visible BAR_H-tall bar,
                  // landing this just above it instead of flush with its
                  // own bottom edge. BAR_INSET offsets to the bar's own top
                  // (see BAR_INSET's own comment — the bar itself no longer
                  // sits flush at this row's top edge).
                  style={{ left, top: BAR_INSET + BAR_H - 3, width, height: 3 }}
                  aria-hidden
                />
              );
            })}
          {/* Momentary's own marker actually sits ON the timeline (this bar),
              not floating above it — the connector line in the sampling-
              indicator row above just leads the eye down to it, the same
              way Whole/Partial's own bracket reads as part of this bar
              even though it's technically drawn in that row too (its own
              hooked ends reach down to the bar's edge for the same
              reason). Vertically centered in the bar's own height (which
              is this row's own height too, since BAR_INSET centers the bar
              within it — see that constant's own comment), same x as its
              bubble. Was clipped by this row's own overflow-hidden before
              BAR_ROW_H gave the dot room to actually poke out past the
              bar's own edges instead of being cropped flush with it. */}
          {samplingType === "momentary" &&
            Array.from({ length: intervalCount }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "absolute rounded-full -translate-x-1/2 -translate-y-1/2",
                  samplingIndicatorFillColor(statuses[i]),
                )}
                style={{
                  left: (i + 1) * SEG_W,
                  top: BAR_ROW_H / 2,
                  width: SAMPLING_DOT_SIZE,
                  height: SAMPLING_DOT_SIZE,
                }}
                aria-hidden
              />
            ))}
        </motion.div>
      </div>
      {/* The "now" chevron and the mini timer pill follow the same real
          elapsed-time position, the pill stacked directly underneath the
          chevron it belongs to rather than living in the card's own
          header — pulled up (negative margin) so the chevron's own tip
          overlaps into the bar above it instead of just pointing at a gap
          underneath it. Pulls up by BAR_INSET more than CHEVRON_OVERLAP_PX
          alone would: the bar's own row is now BAR_ROW_H tall (taller than
          the bar itself, see that constant's own comment), so the bar's
          real bottom edge sits BAR_INSET above the row's own bottom edge
          instead of flush with it — without the extra pull, the chevron's
          tip would just overlap that now-empty gap below the bar, short of
          actually reaching it. */}
      <div
        className="relative overflow-hidden"
        style={{
          height: CHEVRON_ROW_H,
          marginTop: -(CHEVRON_OVERLAP_PX + BAR_INSET),
          ...HORIZONTAL_FADE_MASK,
        }}
      >
        <motion.div
          className="absolute left-1/2 top-0"
          animate={{ x: trackOffsetPx }}
          transition={SPRING_TRANSITION}
        >
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0"
            style={{ left: fillPx }}
          >
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              style={{
                transform: "rotate(-90deg)",
                filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
              }}
              aria-hidden
            >
              <path d={NOW_CHEVRON_PATH} fill="var(--color-now-chevron)" />
            </svg>
            {/* Rotating a non-square box like this one leaves it centered in
                its own unrotated (16x20) footprint, so the visually-rotated
                chevron (now 20 wide x 16 tall) sits with a couple of px of
                empty space below it before the box's own reserved height
                ends — pulled up to close that gap without touching the
                chevron's own established shape. */}
            <div style={{ marginTop: -4 }}>{timerPill}</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const ROW_H = 28; // matches h-7 row buttons
// A bit more breathing room between rows than the standard-view idiom
// (space-y-1.5) — enough rows' worth of buttons crowd together vertically
// that the extra gap reads clearly, unlike a single horizontal row.
const ROW_GAP = 12;
const ROW_SLOT = ROW_H + ROW_GAP;
const VISIBLE_ROWS = 4; // how many intervals fit in the scrollable viewport at once
// Headroom above/below the scrollable viewport so the "now" chevron's own
// -translate-y-1/2 centering never pokes it past the viewport's own
// overflow-hidden edge when it's parked near the very top or bottom of the
// whole track (i.e. the first or last interval) — without this, the
// chevron's own tip gets silently clipped off exactly there.
const CHEVRON_PAD_Y = 10;

/** Twirl-down alternative to the standard view's horizontal timeline — same
 *  progress fill and "now" indicator, just running vertically alongside a
 *  list of every interval, each with its own working score buttons (not
 *  gated to only the current one), mirroring Task Analysis's own expanded
 *  per-step editing. Only `VISIBLE_ROWS` show at once, auto-scrolled
 *  (spring transform) to keep the viewed interval in frame. Unlike the
 *  standard view's own horizontal strip, nothing here fades at its edges —
 *  that fade exists purely so the horizontal nav arrows don't look like
 *  they're clipping content, and this view has no nav arrows of its own. */
function IntervalExpandedView({
  intervalCount,
  samplingType,
  rowLabel,
  statuses,
  viewIdx,
  fillFrac,
  canRecordData,
  positiveLabel,
  negativeLabel,
  onScore,
  timerPill,
}: {
  intervalCount: number;
  samplingType: SamplingType;
  /** Each row's own descriptive text — the interval's own time range
   *  ("0-30m") for interval mode, or a checkpoint's clock time + name for
   *  checkpoint mode. Indexed rather than a precomputed array so the caller
   *  doesn't have to build a whole array just to hand this component what
   *  is, either way, a pure function of the row index. */
  rowLabel: (index: number) => string;
  statuses: IntervalStatus[];
  viewIdx: number;
  // Same fractional-segment position IntervalTimeline's own `fillFrac`
  // prop takes — see its doc comment for why this is a plain fraction
  // rather than a raw pixel/row offset.
  fillFrac: number;
  canRecordData: boolean;
  positiveLabel: string;
  negativeLabel: string;
  onScore: (index: number, value: Exclude<IntervalStatus, null>) => void;
  timerPill: ReactNode;
}) {
  const fillPx = fillFrac * ROW_SLOT;
  const trackOffsetPx = -Math.max(0, viewIdx - (VISIBLE_ROWS - 1)) * ROW_SLOT;
  // The extra CHEVRON_PAD_Y headroom top/bottom (see its own comment) rides
  // along as a constant part of the same offset — the auto-scroll math
  // itself is unaffected since it's applied uniformly regardless of scroll
  // position, just shifting the whole track down to leave clipping-free
  // room above the topmost visible pixel and, symmetrically, below the
  // bottom-most one. Each row is centered ON its own divider rather than
  // top-aligned to its own slot (see the row wrapper's own `top` below), so
  // the last visible row's bottom edge actually lands ROW_H/2 further down
  // than VISIBLE_ROWS full slots would suggest — without adding that back
  // in here too, that row's own bottom half gets silently clipped off by
  // this viewport's own overflow-hidden edge.
  const viewportHeight = VISIBLE_ROWS * ROW_SLOT + ROW_H / 2 + 2 * CHEVRON_PAD_Y;
  const totalTrackHeight = intervalCount * ROW_SLOT;

  return (
    <div className="px-5 pt-1 pb-4">
      {/* The timer pill stays put here, above the whole track — unlike the
          standard view's own horizontal chevron, this one doesn't attach to
          it: the chevron still slides continuously along the vertical bar
          below, but pairing a moving pill with it down there reads as too
          unstable for a value that's otherwise always anchored in place.
          Anchored over the vertical progress bar itself (chevron gutter
          width + the row's own gap-3 + half the bar's own width) rather
          than centered on the whole card, so it reads as belonging to the
          bar right underneath it. */}
      <div className="relative mb-2" style={{ height: 20 }}>
        <div className="absolute top-0 -translate-x-1/2" style={{ left: 16 + 12 + 5 }}>
          {timerPill}
        </div>
      </div>
      <div className="relative overflow-hidden" style={{ height: viewportHeight }}>
        <motion.div
          className="absolute left-0 top-0 w-full flex gap-3"
          animate={{ y: trackOffsetPx + CHEVRON_PAD_Y }}
          transition={SPRING_TRANSITION}
        >
          {/* Current-time arrow, its own tip overlapping into the bar to its
              right. Fixed width on the gutter itself since its only child is
              absolutely positioned (for the vertical follow) and so can't
              otherwise size its own parent — without this the column
              collapses to zero width and pushes the chevron off the left
              edge of the card. */}
          <div className="relative shrink-0" style={{ width: 16 }}>
            <div
              className="absolute -translate-y-1/2"
              style={{ top: fillPx, right: -CHEVRON_OVERLAP_PX }}
            >
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
                aria-hidden
              >
                <path d={NOW_CHEVRON_PATH} fill="var(--color-now-chevron)" />
              </svg>
            </div>
          </div>
          <div
            className="relative shrink-0 rounded-full bg-stone-200 overflow-hidden"
            // BAR_ROW_H (not BAR_H's own 10px thickness) — wider than the
            // visible bar so the momentary dot below (deliberately bigger
            // than the bar, see SAMPLING_DOT_SIZE's own comment) has room
            // to poke out past its edges instead of being clipped by this
            // container's own overflow-hidden, the same fix as the standard
            // view's own horizontal bar (see BAR_INSET's comment there).
            // Pulled left out of the row's own gap-3 (12px), and further by
            // BAR_INSET, so the chevron's tip — which only pokes
            // CHEVRON_OVERLAP_PX past the gutter's own edge — reaches the
            // visible bar's own (inset) left edge exactly, not this wider
            // container's edge, the same overlap amount as the standard
            // view's own horizontal bar.
            style={{
              width: BAR_ROW_H,
              height: totalTrackHeight,
              marginLeft: -(12 - CHEVRON_OVERLAP_PX + BAR_INSET),
            }}
          >
            <div
              className="absolute bg-blue-200 transition-[height]"
              style={{ top: 0, left: BAR_INSET, right: BAR_INSET, height: fillPx }}
              aria-hidden
            />
            {Array.from({ length: intervalCount - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute h-px bg-white"
                style={{ top: (i + 1) * ROW_SLOT, left: BAR_INSET, right: BAR_INSET }}
                aria-hidden
              />
            ))}
            {/* Whole/Partial: a colored right-border stripe spanning a
                scored interval's own timespan, running right up to its
                badge — the vertical counterpart of the standard view's own
                horizontal bar accent (see IntervalTimeline). Partial's own
                stripe is half-height and centered on its span, matching its
                (also half-width) bracket in the standard view. Momentary
                instead gets a dot at the exact checkpoint moment (this
                bar's own divider line), same "point in time, not a span"
                marker the standard view's own bar uses, always shown (gray
                when unscored) rather than only once scored. */}
            {samplingType === "momentary"
              ? Array.from({ length: intervalCount }, (_, i) => (
                  <div
                    key={`dot-${i}`}
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                      samplingIndicatorFillColor(statuses[i]),
                    )}
                    style={{
                      top: (i + 1) * ROW_SLOT,
                      width: SAMPLING_DOT_SIZE,
                      height: SAMPLING_DOT_SIZE,
                    }}
                    aria-hidden
                  />
                ))
              : Array.from({ length: intervalCount }, (_, i) => {
                  const status = statuses[i];
                  if (status == null) return null;
                  const height = samplingType === "partial" ? ROW_SLOT / 2 : ROW_SLOT;
                  const top = i * ROW_SLOT + (ROW_SLOT - height) / 2;
                  return (
                    <div
                      key={`seg-${i}`}
                      className={cn(
                        "absolute w-[3px] rounded-full",
                        status === "correct" ? "bg-green-500" : "bg-red-500",
                      )}
                      // right: BAR_INSET — hugs the visible bar's own right
                      // edge, not this wider container's edge (see the
                      // container's own comment above).
                      style={{ top, height, right: BAR_INSET }}
                      aria-hidden
                    />
                  );
                })}
          </div>
          <div className="relative flex-1 min-w-0" style={{ height: totalTrackHeight }}>
            {Array.from({ length: intervalCount }, (_, i) => {
              const status = statuses[i];
              const recency = recencyOf(i, viewIdx);
              const { bg, text, fade } = statusColors(status, recency);
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  // Centered on `(i + 1) * ROW_SLOT` — the divider marking
                  // this interval's own END (or the track's own bottom edge
                  // for the last interval) — instead of this row's own
                  // slot-center, so the badge (and the label/buttons
                  // following along with it) reads as "this is what just
                  // finished," matching the standard view's own bubbles.
                  style={{ top: (i + 1) * ROW_SLOT - ROW_H / 2, height: ROW_H }}
                >
                  <span
                    className={cn(
                      "shrink-0 grid place-items-center size-6 rounded-full font-display font-bold text-[11px] tabular-nums",
                      recency === "current" ? "border-2" : "border",
                      bg,
                      text,
                      fade,
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground tabular-nums">
                    {rowLabel(i)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <RowScoreButton
                      variant="negative"
                      label={negativeLabel}
                      selected={status === "incorrect"}
                      disabled={!canRecordData}
                      onClick={() => onScore(i, "incorrect")}
                    />
                    <RowScoreButton
                      variant="positive"
                      label={positiveLabel}
                      selected={status === "correct"}
                      disabled={!canRecordData}
                      onClick={() => onScore(i, "correct")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function TriangleNav({
  direction,
  onClick,
  onDoubleClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  /** Jumps straight to the first/last interval — the same shortcut every
   *  other scrollable card's own nav arrows now offer. */
  onDoubleClick?: () => void;
  disabled?: boolean;
}) {
  const isLeft = direction === "left";
  return (
    <motion.button
      aria-label={isLeft ? "Previous interval" : "Next interval"}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      // Vertically centered on the period-bubble row specifically (not the
      // full bubbles+bar+chevron height), so the arrows sit above the time
      // bar rather than straddling it.
      style={{ top: NAV_CENTER_PX }}
      className={cn(
        "absolute -translate-y-1/2 z-20 grid place-items-center size-12 shrink-0 aspect-square text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        // This card's own timeline row reserves extra side padding (px-10)
        // for the interval visualization, which left its arrows sitting
        // noticeably further from the card's edge than every other card's
        // own nav arrows — pulled in further here (rather than shrinking
        // that shared padding, which other elements in the row also rely
        // on) to roughly halve that gap instead.
        isLeft ? "-left-4" : "-right-4",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
        fill="currentColor"
        aria-hidden
      >
        {isLeft ? (
          <path
            d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </motion.button>
  );
}

function ScoreButton({
  variant,
  label,
  selected,
  disabled,
  onClick,
}: {
  variant: "positive" | "negative";
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isPositive = variant === "positive";
  const Icon = isPositive ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "btn-bevel flex-1 min-w-0 h-10 rounded-full border-2 flex items-center justify-center gap-1.5 px-2 transition-colors disabled:opacity-40",
        isPositive
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          (isPositive
            ? "bg-green-500 border-green-600 text-white hover:bg-green-600"
            : "bg-red-500 border-red-600 text-white hover:bg-red-600"),
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={3} />
      <span className="text-sm font-medium truncate">{label}</span>
    </button>
  );
}

function RowScoreButton({
  variant,
  label,
  selected,
  disabled,
  onClick,
}: {
  variant: "positive" | "negative";
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isPositive = variant === "positive";
  const Icon = isPositive ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 rounded-full border-2 flex items-center justify-center gap-1 px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40 shrink-0",
        isPositive
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
        selected &&
          cn(
            "btn-bevel text-white",
            isPositive
              ? "bg-green-500 border-green-600 hover:bg-green-600"
              : "bg-red-500 border-red-600 hover:bg-red-600",
          ),
      )}
    >
      <Icon className="size-3" strokeWidth={3} />
      {label}
    </button>
  );
}
