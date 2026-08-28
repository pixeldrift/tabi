import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useIsPresent } from "motion/react";
import { playSoundEffect } from "@/lib/soundEffects";

export type SessionStatus = "idle" | "running" | "paused";
export type SaveStatus = "clean" | "dirty" | "saving";
export type TransitionKind = "start-new" | "join" | "resume" | "discard" | null;

// Every kind of session transition StatusBar's pill/box choreography cares
// about — a strict superset of TransitionKind above (adds "pause" and
// "submit", which never went through the staged start-new/join/discard
// machinery TransitionKind was built for, but still animate a pill/box).
export type SessionTransitionKind = Exclude<TransitionKind, null> | "pause" | "submit";

// The single source of truth StatusBar's pill/box rendering derives its
// entire visual sequence from: what's happening, and exactly when it
// started. Every other piece of that choreography (box height delay, pill
// travel delay/duration, digit hold, action-row reveal) is a pure function
// of `kind` and `performance.now() - startedAt`, computed where it's
// rendered (StatusBar) rather than staged through a chain of setTimeout-
// driven setState calls here — see `beginTransition` below.
export interface SessionTransition {
  kind: SessionTransitionKind;
  startedAt: number;
}

// The staff member "at this device" — there's no real auth in this
// prototype, so this is hardcoded rather than picked at runtime. An id, not
// a display name: this is the actual identity primitive (what a real
// sign-in would hand back), and every place that needs to show a name
// resolves it through StaffDirectory's own STAFF_DIRECTORY/staffName
// instead of duplicating it here. Every place that reads it does so through
// this one constant (never a literal string), so wiring up real sign-in
// later is a one-line change here, not a hunt through every consumer. Kept
// in this file rather than StaffDirectory.tsx since "who's logged in" is an
// auth-session concern, not a directory-of-all-staff one — a real backend
// would draw the same line (an auth service vs. a staff/HR service).
export const CURRENT_STAFF_ID = "perry-plat";
// A plausible "someone else" for the random session-state simulator below
// to attribute a session to — real RBTs already in STAFF_DIRECTORY
// (StaffDirectory.tsx), so a simulated co-worker still opens a real staff
// profile card when tapped.
const OTHER_STAFF_IDS = ["isabella-garcia-shapiro", "baljeet-tjinder"];

// A plausible (invented, not real) length for a just-finished session —
// used everywhere the idle box's "Previous Session" duration gets set: the
// initial random demo scenario below, and endAndSubmit/clearAndDiscard once
// a real session actually ends. A real elapsed time would usually read as
// implausibly short here (most manual testing/demo sessions last seconds,
// not hours), so this stands in for what an actual clinical session would
// have run.
function randomPreviousSessionMs() {
  return Math.floor((2 + Math.random() * 4) * 3600 * 1000); // 2-6hr
}

// A running session with no one present for at least this long is
// considered abandoned — see isAbandoned's own comment.
export const ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000;

// Every session start/pause/resume/end timing constant below (and the
// matching ones StatusBar.tsx and routes/index.tsx define locally for the
// same choreography) is multiplied by this. 2x, not new hand-picked
// numbers, so the RELATIVE pacing between constants — which beat is meant
// to read as quick vs. deliberate — stays intact; only the whole sequence's
// wall-clock speed changes, slow enough to actually watch each step happen
// instead of them blurring together at normal-app speed.
export const SESSION_TRANSITION_SPEED = 2;

// Shared 3-stage session-transition timing (ms) — CARD_EXIT_MS is stage 1's
// dwell (below), which also drives the header's own dimming (StatusBar).
// The card list's own slide animation is intentionally SLOWER than this
// (see routes/index.tsx's CARD_SLIDE_EXIT_MS) — new cards start entering
// the instant stage 2 commits (fresh data is ready), which lands partway
// through the old cards' own slide-out, so the two overlap into one
// continuous relay instead of "exit, dead pause, enter." HEADER_MORPH_MS
// matches the notification area's own transition elsewhere in the app.
export const CARD_EXIT_MS = 350 * SESSION_TRANSITION_SPEED;
export const HEADER_MORPH_MS = 350 * SESSION_TRANSITION_SPEED;

// The session box itself waits for the pill's HEADER_MORPH_MS morph to land
// in the mini slot before it collapses (see StatusBar's boxCollapsed state),
// so "clock moves, then box closes" reads as two beats instead of one. This
// extra collapse time is tacked onto stage 2's dwell (below) — but only for
// kinds that actually collapse the box (not discard) — so `dimmed`/
// transitionStage don't reset (and card content reappear) before that
// second beat has actually finished playing out.
export const BOX_COLLAPSE_MS = 200 * SESSION_TRANSITION_SPEED;

// The pill's own big<->mini morph (StatusBar's manual FLIP), broken into its
// three beats: for a fresh start, the odometer visibly rolls down to zero
// while the pill is still big and stationary (DIGIT_SETTLE_MS) before it
// starts shrinking/traveling (PILL_TRAVEL_MS), then crossfades into the
// real, correctly-positioned destination pill (PILL_CROSSFADE_MS).
// PILL_LAND_MS is when that whole sequence has fully finished.
// 3x the plain per-tick digit roll (see OdometerDigits' `slow` prop) so the
// reset-to-zero spin is actually watchable instead of a quick snap, with a
// matching hold here so the pill doesn't start traveling mid-spin.
export const DIGIT_SETTLE_MS = 900 * SESSION_TRANSITION_SPEED;
export const PILL_TRAVEL_MS = HEADER_MORPH_MS;
export const PILL_CROSSFADE_MS = 150 * SESSION_TRANSITION_SPEED;
export const PILL_LAND_MS = DIGIT_SETTLE_MS + PILL_TRAVEL_MS + PILL_CROSSFADE_MS;

// Duration for the "no session running" banner's own exit/enter
// (routes/index.tsx's dataToolbar) — lives here, not there, so any other
// session-timing logic that needs to reason about the banner's own motion
// has one shared constant instead of a duplicated guess.
export const DATA_BANNER_EXIT_MS = 400 * SESSION_TRANSITION_SPEED;

// How long each transition's visual sequence takes to actually land (pill
// travel finishes, box/actions are at rest) — the only thing this table is
// used for is knowing when SessionProvider should clear `transition` back
// to null. Every OTHER detail of the choreography (box height delay, pill
// travel delay, digit hold, action-row reveal) is a pure function of `kind`
// and elapsed time, computed where it's rendered (StatusBar) — not staged
// through a chain of setState calls here.
export const TRANSITION_LANDED_MS: Record<SessionTransitionKind, number> = {
  "start-new": DIGIT_SETTLE_MS + PILL_TRAVEL_MS,
  join: PILL_TRAVEL_MS,
  resume: PILL_TRAVEL_MS,
  // Pause's travel now starts immediately (see the pausing branch in the
  // pillTraveling effect below) rather than waiting out the box's own
  // HEADER_MORPH_MS grow first — and since PILL_TRAVEL_MS === HEADER_MORPH_MS,
  // both finish at the same moment, so "landed" is just the one duration,
  // not their sum.
  pause: PILL_TRAVEL_MS,
  submit: HEADER_MORPH_MS,
  discard: HEADER_MORPH_MS,
};

export interface ActiveTimer {
  id: string;
  label: string;
  scrollTo: () => void;
  activate?: () => void;
  source?: string;
}

interface SessionContextValue {
  // session
  status: SessionStatus;
  elapsedMs: number;
  lastUpdated: Date | null;
  pause: () => void;
  // Removes CURRENT_STAFF_ID from presentStaffIds without touching status —
  // the timer keeps running for whoever else is still in presentStaffIds.
  // Only meaningful (and only ever offered in the UI) when someone else
  // actually is: leaving a session nobody else is present in would just be
  // pause in disguise, minus the "for all" clarity pause's own confirm
  // already gives. isSessionMine reads presence (see its own comment),
  // so this flips it false the same way it would if you'd never joined —
  // the pill/box respond exactly like the "running, not mine" case
  // already does, no separate leave-specific rendering needed anywhere.
  leaveSession: () => void;
  endAndSubmit: () => void;
  // Which of the two ways a session most recently ended — set directly by
  // endAndSubmit/clearAndDiscard themselves, not inferred from status/
  // transitionKind timing. Consumers used to derive "was this a submit"
  // from `prev==="paused" && status==="idle" && transitionKind===null`,
  // which silently broke for discard specifically: its own dwellMs is 0
  // (see runStagedTransition), so its status-flips-to-idle commit and its
  // transitionKind-resets-to-null commit land close enough together that
  // React coalesces them into one render, and the intermediate "idle,
  // still transitionKind='discard'" state a consumer's own prevStatusRef
  // was counting on to tell the two apart never actually gets observed —
  // so a discard could get misread as a submit. An explicit field sidesteps
  // that class of bug entirely.
  lastEndAction: "submit" | "discard" | null;
  // Shared 3-stage transition orchestration — see CARD_EXIT_MS et al above.
  // `transitionStage` is 0 outside of a transition, 1 while old stuff is
  // exiting, 2 while the timer/header is morphing (this is also when the
  // real status change actually commits).
  transitionStage: 0 | 1 | 2;
  transitionKind: TransitionKind;
  // The session box's own render target and its delayed, real-CSS-height
  // counterpart — see their shared comment on the SessionProvider below.
  // StatusBar's box reads both directly; the pill-travel landing-prediction
  // logic there also needs `collapsed` itself, not just `boxCollapsed`.
  collapsed: boolean;
  boxCollapsed: boolean;
  // True while the mini-session pill is actually traveling between its big
  // and mini positions (see its own comment below) — StatusBar's visual
  // travel overlay is driven directly off this shared clock.
  pillTraveling: boolean;
  // The pill/box choreography's own single source of truth — see
  // `SessionTransition`'s own comment. Null outside of a transition.
  // Deliberately separate from transitionStage/transitionKind/boxCollapsed/
  // pillTraveling above: those exist for the card list's own staged exit/
  // enter (routes/index.tsx) and are untouched by this — StatusBar's
  // pill/box rendering reads only this field now.
  transition: SessionTransition | null;
  requestStartNew: () => void;
  requestResume: () => void;
  requestDiscard: () => void;
  // shared tick (so all timers stay in unison with the session timer)
  sessionRunning: boolean;
  // Who to credit for the current non-idle session's state — whoever
  // started it, or, once paused, whoever pressed Pause (see pause() below;
  // same "whoever actually performed the action" rule endAndSubmit uses for
  // lastEndedById) — null only while genuinely idle with no session to
  // attribute. isSessionMine only cares whether this is null, not who it
  // names, so crediting the pauser here doesn't change session ownership.
  startedById: string | null;
  // Who ended & submitted the previous session — shown in the idle box's
  // "Previous Session" line. Whoever performs End & Submit gets credited
  // here regardless of who originally started it (see endAndSubmit).
  lastEndedById: string | null;
  // Who's currently "in" the running session — starts as just whoever
  // started it; joinSession() adds CURRENT_STAFF_ID. Empty once nobody
  // (including the starter) is actively present — see isAbandoned.
  presentStaffIds: string[];
  // Derived: true if there's no session to speak of, or CURRENT_STAFF_ID
  // is the one who started it. False means someone else's session is
  // running/paused and hasn't been joined yet — this is what keeps the
  // session box expanded (not auto-collapsed into the toolbar's mini pill)
  // and swaps the pill's Play icon for a Join one, see StatusBar.
  isSessionMine: boolean;
  // Adds CURRENT_STAFF_ID to presentStaffIds — doesn't touch the timer or
  // hand off ownership, it just means another set of eyes (and hands) is
  // now on the same session. Runs through the same staged sequence as
  // requestStartNew (see runStagedTransition) so joining an in-progress or
  // abandoned session reads as the same deliberate handoff a fresh start
  // does, rather than an instant snap. Safe to call repeatedly.
  requestJoin: () => void;
  // An explicit, intentional unlock (see its own toggle in StatusBar) that
  // lets cards accept edits while genuinely paused, without starting the
  // timer or affecting rate data — off by default so a parked session
  // can't be edited by accident. Always resets to false on resume/end/
  // discard; never carries into the next paused instance.
  reviewModeUnlocked: boolean;
  setReviewModeUnlocked: (v: boolean) => void;
  // True once a running session has had no one present (see
  // presentStaffIds) for ABANDONMENT_THRESHOLD_MS — see its own effect
  // for the reminder notification this drives (pushed by a trigger
  // component mounted inside NotificationProvider, not here — this
  // provider sits ABOVE that context and can't call its own push).
  isAbandoned: boolean;
  // The demo-only "Previous Session" record shown while idle — randomized
  // once per page load (see the random-state effect below) rather than
  // living as StatusBar's own local state, so the simulator can set it
  // together with lastEndedById as one coherent scenario.
  previousSessionMs: number;
  previousSessionEndedAt: Date | null;
  subscribeTick: (cb: (deltaMs: number) => void) => () => void;
  /** Precise elapsed time right now, not the last-tick snapshot (which is up
   * to 250ms stale) — for one-time phase calculations like syncing a new
   * animation to the exact current beat. */
  getElapsedMsNow: () => number;
  // active timer registry
  activeTimers: ActiveTimer[];
  registerActiveTimer: (t: ActiveTimer) => void;
  unregisterActiveTimer: (id: string) => void;
  // save status
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  markDirty: () => void;
  forceSync: () => void;
  // increments whenever a fresh session is started — cards listen and reset.
  resetSignal: number;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

// Split out from SessionContextValue: most data cards only need `markDirty`
// and `resetSignal`, neither of which changes on every tick or transition
// stage. Reading them through the main context would re-render every card
// (and its whole subtree, e.g. TrialCard's keypads) on every 250ms timer
// tick and every stage of a start/pause/resume transition — that render
// storm was landing right at click time and stealing the frame budget the
// collapse animation needed to look smooth. Cards that also need live
// timer state (RateCard, DurationCard) just read both contexts.
interface CardSessionValue {
  markDirty: () => void;
  resetSignal: number;
  // The literal "is the timer running" state — split off from the main
  // context same as markDirty/resetSignal above: it only flips on start/
  // pause/resume/discard, not every tick, so reading it here doesn't cost
  // cards the render-storm subscribing to the full context (with its
  // every-250ms elapsedMs) would.
  sessionRunning: boolean;
  // What cards actually gate their own recording controls on (disabled
  // while this is false) — sessionRunning OR an intentional Review Mode
  // unlock while paused (see reviewModeUnlocked's own comment on the main
  // context). Deliberately a separate field from sessionRunning above:
  // Review Mode must unlock editing without ALSO waking up any card's own
  // tick-driven timer logic, which reads the real sessionRunning straight
  // from the main context instead (RateCard/DurationCard/IntervalCard).
  canRecordData: boolean;
  // Flips true the moment the session has actually accrued any real time
  // (or was continued from a previous session that already had some) and
  // stays true until the next fresh start — a stable boolean, not a ticking
  // number, so reading it here doesn't cost the render-storm elapsedMs
  // itself would. Lets a card with no timer of its own (Frequency,
  // Duration) tell "genuinely zero, observed for real" apart from "never
  // touched" — see FrequencyCard/DurationCard's own use for interfering
  // behaviors, where zero is itself the desired outcome and still counts
  // as real, gradeable data once there was actually time to observe it.
  hasElapsedTime: boolean;
}

const CardSessionContext = createContext<CardSessionValue | null>(null);

export function useCardSession() {
  const ctx = useContext(CardSessionContext);
  if (!ctx) throw new Error("useCardSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasElapsedTime, setHasElapsedTime] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  const [startedById, setStartedById] = useState<string | null>(null);
  const [lastEndedById, setLastEndedById] = useState<string | null>(null);
  const [presentStaffIds, setPresentStaffIds] = useState<string[]>([]);
  const [reviewModeUnlocked, setReviewModeUnlocked] = useState(false);
  // Whether YOU'RE actively part of the session right now — not "did I
  // start it." Basing this on presence (not on startedById) is what
  // makes joinSession() below actually collapse the box into the compact
  // toolbar pill: startedById never changes on a join (the original
  // starter still gets credited as having started it), so if this checked
  // that instead, a joined session would stay in the big, expanded box
  // forever even though you're now actively driving it.
  const isSessionMine = startedById === null || presentStaffIds.includes(CURRENT_STAFF_ID);
  const joinSession = useCallback(() => {
    setPresentStaffIds((ids) =>
      ids.includes(CURRENT_STAFF_ID) ? ids : [...ids, CURRENT_STAFF_ID],
    );
    setLastActivityAt(Date.now());
  }, []);

  // Any real sign someone's actively working the session — used to detect
  // abandonment (see isAbandoned below). Bumped on start/resume and on
  // markDirty (a card recording something), not on the 250ms tick itself,
  // which would make every running session look permanently "active"
  // regardless of whether anyone's actually there.
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [isAbandoned, setIsAbandoned] = useState(false);
  useEffect(() => {
    if (status !== "running" || presentStaffIds.length > 0) {
      setIsAbandoned(false);
      return;
    }
    const remaining = lastActivityAt + ABANDONMENT_THRESHOLD_MS - Date.now();
    if (remaining <= 0) {
      setIsAbandoned(true);
      return;
    }
    const id = window.setTimeout(() => setIsAbandoned(true), remaining);
    return () => window.clearTimeout(id);
  }, [status, presentStaffIds, lastActivityAt]);

  // Demo-only "Previous Session" record shown while idle — see its own
  // comment on the context interface. Randomized by the scenario effect
  // further down, alongside a matching lastEndedById, rather than living
  // as StatusBar's own local state.
  const [previousSessionMs, setPreviousSessionMs] = useState(2 * 3600 * 1000);
  const [previousSessionEndedAt, setPreviousSessionEndedAt] = useState<Date | null>(null);

  // Shared tick driver — when the session is running, a single interval
  // updates the session's elapsed AND notifies all subscribed timers with
  // the delta in ms, so every timer ticks in unison.
  const tickListenersRef = useRef<Set<(deltaMs: number) => void>>(new Set());
  const subscribeTick = useCallback((cb: (deltaMs: number) => void) => {
    tickListenersRef.current.add(cb);
    return () => {
      tickListenersRef.current.delete(cb);
    };
  }, []);

  // StatusBar's pill/box choreography's single source of truth — see
  // `SessionTransition`'s own comment. Declared here (ahead of pause/
  // resume/endAndSubmit/runStagedTransition below, which all set it) so the
  // tick effect just below can gate on it directly.
  const [transition, setTransition] = useState<SessionTransition | null>(null);
  // A fresh start's/resume's clock genuinely doesn't start running until
  // the pill has actually landed — not just held back on screen and then
  // jumped forward to "catch up" once it does. Gating the real interval
  // (not merely its displayed value) means there's no discontinuity to
  // paper over: the digits sit at their settled starting value (0, or the
  // frozen pre-pause elapsed) for the whole flight, then tick normally
  // the instant it's actually true. Join is deliberately NOT gated — its
  // session is already running for whoever else is in it, so holding its
  // display would mean inventing a freeze-then-jump of its own; letting it
  // keep reading the live value the whole time needs no special handling
  // at all, unlike start-new/resume, which are stopping their own clock
  // from 0 or a dead stop and have a real "hasn't started yet" moment to
  // protect.
  const tickGated =
    transition !== null && (transition.kind === "start-new" || transition.kind === "resume");
  useEffect(() => {
    if (status !== "running" || tickGated) return;
    startRef.current = performance.now();
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (startRef.current !== null) {
        setElapsedMs(baseRef.current + (now - startRef.current));
      }
      setHasElapsedTime(true);
      tickListenersRef.current.forEach((cb) => cb(delta));
    }, 250);
    return () => window.clearInterval(id);
  }, [status, tickGated]);

  const getElapsedMsNow = useCallback(() => {
    if (status !== "running" || tickGated || startRef.current === null) return elapsedMs;
    return baseRef.current + (performance.now() - startRef.current);
  }, [status, tickGated, elapsedMs]);

  const transitionClearTimeoutRef = useRef<number | null>(null);
  const beginTransition = useCallback((kind: SessionTransitionKind) => {
    if (transitionClearTimeoutRef.current !== null) {
      window.clearTimeout(transitionClearTimeoutRef.current);
    }
    setTransition({ kind, startedAt: performance.now() });
    transitionClearTimeoutRef.current = window.setTimeout(() => {
      setTransition(null);
      transitionClearTimeoutRef.current = null;
    }, TRANSITION_LANDED_MS[kind]);
  }, []);
  useEffect(() => {
    return () => {
      if (transitionClearTimeoutRef.current !== null) {
        window.clearTimeout(transitionClearTimeoutRef.current);
      }
    };
  }, []);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    // Set on the client only to avoid SSR hydration mismatches on time formatting.
    setLastSavedAt((d) => d ?? new Date());
  }, []);

  const markDirty = useCallback(() => {
    setSaveStatus((s) => (s === "saving" ? s : "dirty"));
    setLastActivityAt(Date.now());
  }, []);

  const performSave = useCallback(() => {
    setSaveStatus("saving");
    window.setTimeout(() => {
      setSaveStatus("clean");
      setLastSavedAt(new Date());
    }, 2200);
  }, []);

  const forceSync = useCallback(() => {
    setSaveStatus((s) => {
      if (s === "saving") return s;
      // trigger save
      window.setTimeout(() => performSave(), 0);
      return s;
    });
  }, [performSave]);

  // Bumped whenever a brand-new (empty) session is started, so every card
  // can subscribe and reset its local state.
  const [resetSignal, setResetSignal] = useState(0);
  // See the SessionContextValue interface's own comment on why this is an
  // explicit field rather than something consumers infer from status/
  // transitionKind timing.
  const [lastEndAction, setLastEndAction] = useState<"submit" | "discard" | null>(null);
  const startFresh = useCallback(() => {
    setResetSignal((n) => n + 1);
    // "How did we get to idle" stops being meaningful the moment a new
    // session actually begins — cleared here (not left to whichever
    // consumer read it last) so a later Start New Session can't be
    // misread as a repeat of whatever ended the PREVIOUS session, since
    // this also bumps resetSignal and nothing else about this field would
    // otherwise change in between.
    setLastEndAction(null);
    baseRef.current = 0;
    setElapsedMs(0);
    setStatus("running");
    setHasElapsedTime(false);
    const now = new Date();
    setLastUpdated(now);
    // Starting a session resets the saved baseline — no unsaved data yet.
    setLastSavedAt(now);
    setSaveStatus("clean");
    setStartedById(CURRENT_STAFF_ID);
    setPresentStaffIds([CURRENT_STAFF_ID]);
    setLastActivityAt(Date.now());
    playSoundEffect("sessionStart");
  }, []);

  const pause = useCallback(() => {
    baseRef.current = elapsedMs;
    setStatus("paused");
    setLastUpdated(new Date());
    // Credits whoever actually paused it, not necessarily whoever started
    // it — e.g. joining someone else's running session and then pausing it
    // should read as "Paused by You," not still name the original starter.
    setStartedById(CURRENT_STAFF_ID);
    beginTransition("pause");
    playSoundEffect("sessionPause");
  }, [elapsedMs, beginTransition]);
  // Deliberately doesn't touch status, startedById, or lastUpdated — the
  // session (and its attribution) keeps running exactly as it was for
  // whoever's still in presentStaffIds; only YOUR OWN presence changes.
  // Reuses "pause"'s own beginTransition kind purely for its established
  // box-grow/pill-travel choreography (the same motion this client's own
  // view needs whenever it stops being mine-and-running without a full
  // staged start-new/join/discard sequence) — it doesn't imply anything
  // about status, which is what the box's own "Session Paused" label
  // actually reads (see ExpandedSessionBox's `label`), so nothing else
  // downstream mistakes this for an actual pause.
  const leaveSession = useCallback(() => {
    setPresentStaffIds((ids) => ids.filter((id) => id !== CURRENT_STAFF_ID));
    beginTransition("pause");
  }, [beginTransition]);
  const resume = useCallback(() => {
    setStatus("running");
    setLastUpdated(new Date());
    setLastActivityAt(Date.now());
    // isSessionMine reads presence, not startedById (see its own comment) —
    // a paused session has nobody "present" (presence is a running-session
    // concept), so without this, resuming your own paused session left
    // isSessionMine false. That's invisible while the staged transition's
    // own transitionStage===2 window papers over `collapsed`, but the box
    // snaps back open to the big expanded view the instant that window
    // ends, instead of staying collapsed into the mini pill — same fix as
    // joinSession's own dedup add.
    setPresentStaffIds((ids) =>
      ids.includes(CURRENT_STAFF_ID) ? ids : [...ids, CURRENT_STAFF_ID],
    );
    beginTransition("resume");
    playSoundEffect("sessionResume");
  }, [beginTransition]);
  // Whoever actually performs End & Submit gets credited as having ended
  // the session, regardless of who started it (state 4's "submitting the
  // data would show it as being collected by that individual") — this is
  // also how a joined/reclaimed abandoned session's data ends up correctly
  // attributed to whoever actually finished it, not whoever walked away.
  const endAndSubmit = useCallback(() => {
    // Graphing the data is what actually closes this dataset out — the
    // Data tab's own cards should read as done, not still sitting there
    // live and editable with the same numbers a moment after they were
    // submitted (that used to be exactly what happened: this used to leave
    // resetSignal untouched, so the submit animation played but nothing
    // underneath it had actually changed). Bumping it here is what each
    // card's own useResetGuard reacts to, clearing back to zero.
    setResetSignal((n) => n + 1);
    setLastEndAction("submit");
    setStatus("idle");
    setElapsedMs(0);
    baseRef.current = 0;
    setLastUpdated(new Date());
    setLastEndedById(CURRENT_STAFF_ID);
    setStartedById(null);
    setPresentStaffIds([]);
    setReviewModeUnlocked(false);
    // Backfills the idle box's own "Previous Session" line — see
    // randomPreviousSessionMs's own comment for why this is invented
    // rather than the just-ended session's real (likely too-short) elapsed
    // time.
    setPreviousSessionMs(randomPreviousSessionMs());
    setPreviousSessionEndedAt(new Date());
    beginTransition("submit");
    playSoundEffect("submit");
  }, [beginTransition]);
  const clearAndDiscard = useCallback(() => {
    // Same reasoning as endAndSubmit's own resetSignal bump above —
    // discarding is the other path that ends a session, and the point of
    // discarding is that none of what was recorded sticks around.
    setResetSignal((n) => n + 1);
    setLastEndAction("discard");
    setStatus("idle");
    setElapsedMs(0);
    baseRef.current = 0;
    setStartedById(null);
    setPresentStaffIds([]);
    setReviewModeUnlocked(false);
    // Same reasoning as endAndSubmit above — discarding still ends the
    // session (just without keeping its data), so the idle box's "who and
    // when" should reflect that instead of sitting on whatever stale/
    // never-set values happened to precede it.
    setLastEndedById(CURRENT_STAFF_ID);
    setPreviousSessionMs(randomPreviousSessionMs());
    setPreviousSessionEndedAt(new Date());
    playSoundEffect("sessionDiscard");
  }, []);

  // Shared 3-stage transition orchestration (see CARD_EXIT_MS et al. above).
  // Stage 1: old stuff exits. Stage 2: the real state change commits (timer
  // rolls/header morphs). Back to 0: new stuff can enter. A ref-based busy
  // flag (not state) guards re-entrancy without needing transitionStage as a
  // callback dependency.
  const [transitionStage, setTransitionStage] = useState<0 | 1 | 2>(0);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>(null);
  const transitionBusyRef = useRef(false);
  const transitionTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => transitionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const runStagedTransition = useCallback(
    (kind: Exclude<TransitionKind, null>, commit: () => void) => {
      if (transitionBusyRef.current) return;
      transitionBusyRef.current = true;
      setTransitionKind(kind);
      setTransitionStage(1);
      const t1 = window.setTimeout(() => {
        setTransitionStage(2);
        commit();
        beginTransition(kind);
        // start-new's own pill travel doesn't begin until DIGIT_SETTLE_MS
        // after this commits (the odometer settles to zero first — see
        // DIGIT_SETTLE_MS's own comment), and StatusBar's box-collapse now
        // waits that same extra beat to avoid overlapping its own "pull nav
        // up" with the mini-session slot's "push nav down" (which read as a
        // bounce). This dwell has to stay in step with that or `dimmed`
        // resets — and stage-2 content reappears — before the box has
        // actually finished closing. Resume no longer runs through here at
        // all (see requestResume's own comment) — start-new, join, and
        // discard are the only kinds this function is ever actually called
        // with now.
        const dwellMs =
          kind === "discard" ? 0 : DIGIT_SETTLE_MS + HEADER_MORPH_MS + BOX_COLLAPSE_MS;
        const t2 = window.setTimeout(() => {
          setTransitionStage(0);
          setTransitionKind(null);
          transitionBusyRef.current = false;
        }, dwellMs);
        transitionTimeoutsRef.current.push(t2);
      }, CARD_EXIT_MS);
      transitionTimeoutsRef.current.push(t1);
    },
    [beginTransition],
  );

  const requestStartNew = useCallback(
    () => runStagedTransition("start-new", startFresh),
    [runStagedTransition, startFresh],
  );
  // Joining an in-progress or abandoned session now plays the same staged
  // sequence as starting fresh — see `requestJoin`'s own interface comment.
  // `runStagedTransition`'s dwell (see its own comment) already applies to
  // any kind other than "discard", so "join" inherits the same
  // DIGIT_SETTLE_MS + HEADER_MORPH_MS + BOX_COLLAPSE_MS pacing as
  // "start-new" without needing its own case there.
  const requestJoin = useCallback(
    () => runStagedTransition("join", joinSession),
    [runStagedTransition, joinSession],
  );
  // Unstaged, unlike start-new/discard above — same reasoning as `pause`
  // itself: the box's own collapse, the pill's travel, and the label/
  // actions row's own fade-out now all read as one smooth motion (the
  // pill lands at a fixed anchor independent of the box's own current
  // height — see StatusBar's own pill-travel comment — so there's no
  // longer a "let the pill land, then close the box around it" ordering
  // to protect by staging this). `requestResume` is kept as its own name
  // (rather than exposing `resume` directly) so call sites don't need to
  // know this used to be staged and could be again.
  const requestResume = resume;
  const requestDiscard = useCallback(
    () => runStagedTransition("discard", clearAndDiscard),
    [runStagedTransition, clearAndDiscard],
  );

  const isRunning = status === "running";
  // Shared by `collapsed` and the pill-travel effect below — both need to
  // treat "running but not yet joined" the same way (box stays expanded,
  // pill doesn't travel into the toolbar) and both need to react the
  // instant joinSession() flips isSessionMine true too, not just when
  // isRunning itself changes.
  const isMineAndRunning = isRunning && isSessionMine;

  // The session box's own render target: collapsed into the mini pill slot
  // once genuinely running, or once a staged transition's real commit has
  // landed (except discard, whose box was already open and stays that way
  // — only its displayed value swaps). Centralized here — not derived
  // separately in StatusBar and mirrored out to everything else — so the
  // box's own real height `animate()`, the tab nav, and the content pane
  // all read the exact same value on the exact same render, with nothing
  // to mirror or fall a tick behind.
  //
  // `isMineAndRunning`, not plain `isRunning` — a running session that
  // isn't yours yet (someone else's, not joined) stays in the big,
  // expanded box instead of auto-collapsing into the toolbar's compact
  // pill: "we should see the large timer already counting" so there's
  // something concrete to look at (who started it, how long it's been
  // running) before deciding to join, rather than a session you haven't
  // touched yet quietly taking over the toolbar. The transitionStage===2
  // branch doesn't need its own check — every staged transition is
  // something the current device just did, so it's already "mine" by the
  // time it commits.
  const collapsed = isMineAndRunning || (transitionStage === 2 && transitionKind !== "discard");

  // Delays `collapsed`'s effect on the box's own real CSS height into a
  // separate beat for a staged start (fresh or joined) — "clock moves, then
  // box closes" (see StatusBar's own render for the actual
  // `animate={{height}}`) — a staged start gets an extra DIGIT_SETTLE_MS +
  // HEADER_MORPH_MS head start so the odometer's reset-to-zero spin (fresh)
  // or the same beat's worth of dwell (joined, no actual reset but the same
  // pacing — see `requestJoin`'s own comment) is visibly readable before
  // anything starts shrinking, and the pill's own travel has time to finish
  // before the box closes in around it. Resume doesn't get that delay —
  // its pill lands at a fixed anchor independent of the box's own current
  // height (see StatusBar's own pill-travel comment), so there's no longer
  // a "let the pill land first" ordering to protect: the box's own
  // collapse, the pill's travel, and the label/actions row's own fade-out
  // all start on the same instant and read as one motion.
  // `collapseKindRef` captures `transitionKind` at the moment collapse
  // begins (not read directly from `transitionKind` in the timeout below)
  // so a later reset of `transitionKind` can't retroactively change an
  // already-scheduled delay.
  const collapseKindRef = useRef<TransitionKind>(null);
  const prevCollapsedRef = useRef(collapsed);
  if (collapsed !== prevCollapsedRef.current) {
    prevCollapsedRef.current = collapsed;
    if (collapsed) collapseKindRef.current = transitionKind;
  }
  const [boxCollapsed, setBoxCollapsed] = useState(collapsed);
  useEffect(() => {
    if (!collapsed) {
      setBoxCollapsed(false);
      return;
    }
    if (collapseKindRef.current === "start-new" || collapseKindRef.current === "join") {
      const id = window.setTimeout(() => setBoxCollapsed(true), DIGIT_SETTLE_MS + HEADER_MORPH_MS);
      return () => window.clearTimeout(id);
    }
    setBoxCollapsed(true);
  }, [collapsed]);

  // True while the mini-session pill is actually traveling between its big
  // and mini positions — starts the instant `isMineAndRunning` flips (after
  // the same DIGIT_SETTLE_MS head start as the box's own collapse, for a
  // fresh start), lasts exactly PILL_TRAVEL_MS. Purely timed rather than
  // tied to the travel overlay's own animation-complete callback, so
  // StatusBar's visual travel and every consumer's layout suppression read
  // the same clock instead of two that could drift apart. Driven by
  // `isMineAndRunning` (not plain `isRunning`) for the same reason
  // `collapsed` is above — joining someone else's already-running session
  // triggers this travel too, since that's the point it actually collapses.
  const prevIsMineAndRunningForPillRef = useRef(isMineAndRunning);
  // Captured once via a ref (not read from `transitionKind` in the
  // dependency array below) so SessionContext's own later reset of
  // transitionKind can't cancel an in-progress travel — same reasoning as
  // `collapseKindRef` above. Without this, `transitionKind` resetting to
  // null (via `runStagedTransition`'s own dwell timeout) while this travel
  // timer is still pending re-ran this effect, whose cleanup canceled the
  // pending "set false" timeout without ever setting `pillTraveling` false
  // itself — leaving it stuck true forever whenever the dwell timer's own
  // (single, flat) delay happened to fire before this one's (chained,
  // settle-then-travel) delay actually finished, which real-world timer
  // jitter made possible even though the nominal durations left margin.
  const pillTransitionKindRef = useRef<TransitionKind>(null);
  const [pillTraveling, setPillTraveling] = useState(false);
  useEffect(() => {
    if (isMineAndRunning === prevIsMineAndRunningForPillRef.current) return;
    prevIsMineAndRunningForPillRef.current = isMineAndRunning;
    pillTransitionKindRef.current = transitionKind;
    // Both staged "entering" kinds — a real fresh start and now a join too
    // (see `requestJoin`'s own comment) — get the same DIGIT_SETTLE_MS head
    // start before the pill travels, matching `collapseKindRef`'s own pair
    // above: same pacing either way, even though a join has no actual
    // digit-reset-to-zero to settle.
    const enteringStaged =
      isMineAndRunning &&
      (pillTransitionKindRef.current === "start-new" || pillTransitionKindRef.current === "join");
    let travelTimeoutId: number | undefined;
    const beginTravel = () => {
      setPillTraveling(true);
      travelTimeoutId = window.setTimeout(() => setPillTraveling(false), PILL_TRAVEL_MS);
    };
    if (enteringStaged) {
      const settleId = window.setTimeout(beginTravel, DIGIT_SETTLE_MS);
      return () => {
        window.clearTimeout(settleId);
        if (travelTimeoutId !== undefined) window.clearTimeout(travelTimeoutId);
      };
    }
    // Both remaining cases — pausing (a running session that was mine just
    // stopped being "mine and running" with no transitionKind at all, the
    // only way that happens) and resuming — start the pill's travel
    // immediately, in lockstep with the box's own grow/collapse. Pausing's
    // landing spot is inside the box, below wherever the tab bar ends up
    // once the box has grown to fit the paused actions — departing before
    // that grow finishes means the pill crosses space the tab bar hasn't
    // vacated yet, but that box grow runs on the same HEADER_MORPH_MS as
    // the pill's own travel, so departing together lands them together too.
    beginTravel();
    return () => {
      if (travelTimeoutId !== undefined) window.clearTimeout(travelTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMineAndRunning]);

  // Active timer registry (registration is internal bookkeeping; do NOT mark dirty here).
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const registerActiveTimer = useCallback((t: ActiveTimer) => {
    setActiveTimers((arr) => {
      if (arr.some((x) => x.id === t.id)) return arr.map((x) => (x.id === t.id ? t : x));
      return [...arr, t];
    });
  }, []);
  const unregisterActiveTimer = useCallback((id: string) => {
    setActiveTimers((arr) => arr.filter((x) => x.id !== id));
  }, []);

  // Autosave: if dirty for 20s, automatically perform a save.
  useEffect(() => {
    if (saveStatus !== "dirty") return;
    const id = window.setTimeout(() => performSave(), 10000);
    return () => window.clearTimeout(id);
  }, [saveStatus, performSave]);

  const sessionRunning = isRunning;
  // Not just `sessionRunning` — browsing a running session before joining it
  // (state 2's "or just scroll down and browse the data without modifying
  // anything") is read-only until it's actually yours. `sessionRunning`
  // itself stays keyed on the real timer regardless of whose session it is
  // (cards' own ticking logic reads that one directly), so this needs its
  // own, stricter check rather than reusing it.
  const canRecordData = isMineAndRunning || reviewModeUnlocked;

  // Picks one of the 4 session states this app is designed around (see
  // README's own writeup) to start in, once per page load: no real backend
  // to persist an actual session across a reload, so this stands in for
  // "whatever state the clinic's shared session happens to be in when you
  // open the app" — landing on the SAME idle/zero state every single time
  // would only ever demo state 1. A plain client-only mount effect (like
  // the old previousSessionMs randomizer this absorbed) would still flash
  // idle for a frame before hydration catches up; useLayoutEffect instead
  // commits before the browser paints, so states 2-4 render already
  // settled — no visible snap from idle into a mid-session view.
  useLayoutEffect(() => {
    const scenario = Math.floor(Math.random() * 4);
    const otherStaff = OTHER_STAFF_IDS[Math.floor(Math.random() * OTHER_STAFF_IDS.length)];
    const randomPastMs = () => Math.floor((1 + Math.random() * 4) * 3600 * 1000); // 1-5hr, same as before

    if (scenario === 0) {
      // State 1: idle, showing the previous (already ended & submitted)
      // session's record — same random-previous-session behavior this
      // absorbed from StatusBar, plus who ended it.
      const minMs = 60 * 1000;
      const maxMs = 3 * 24 * 3600 * 1000;
      setPreviousSessionMs(randomPreviousSessionMs());
      setPreviousSessionEndedAt(new Date(Date.now() - (minMs + Math.random() * (maxMs - minMs))));
      setLastEndedById(Math.random() < 0.5 ? CURRENT_STAFF_ID : otherStaff);
      return;
    }

    const elapsed = randomPastMs();
    baseRef.current = elapsed;
    setElapsedMs(elapsed);
    setHasElapsedTime(true);
    setLastActivityAt(Date.now());
    // Backdated to when this (simulated) session would have actually
    // started — StatusBar's attribution line reads this as "X ago" next to
    // who started it, so leaving it null would silently drop that whole
    // line for every seeded running/paused scenario.
    setLastUpdated(new Date(Date.now() - elapsed));

    if (scenario === 1) {
      // State 2: running, started by someone else — joinable, browsable
      // without joining. Both other staff are already in it (not just the
      // one who started it), so joining lands you with 2 other people
      // present — the reliable, always-reachable case for exercising the
      // presence icon's own sup-count badge, same idea as
      // ActiveDurationIndicator's multi-timer count right beside it.
      setStatus("running");
      setStartedById(otherStaff);
      setPresentStaffIds([...OTHER_STAFF_IDS]);
    } else if (scenario === 2) {
      // State 3: paused — parked, could be your own or someone else's.
      setStatus("paused");
      setStartedById(Math.random() < 0.5 ? CURRENT_STAFF_ID : otherStaff);
    } else {
      // State 4: running, abandoned — started by someone else, nobody
      // present. Backdating lastActivityAt past the threshold means
      // isAbandoned's own effect (above) fires almost immediately instead
      // of requiring an actual 30-minute wait to see it in a demo.
      setStatus("running");
      setStartedById(otherStaff);
      setPresentStaffIds([]);
      setLastActivityAt(Date.now() - ABANDONMENT_THRESHOLD_MS - 5 * 60 * 1000);
    }
    // Intentionally once-only: seeds the initial demo scenario, not a
    // real reactive effect — every setter above is stable, and nothing in
    // here should ever re-run off its own writes.
  }, []);

  const value = useMemo(
    () => ({
      status,
      elapsedMs,
      lastUpdated,
      pause,
      leaveSession,
      endAndSubmit,
      lastEndAction,
      transitionStage,
      transitionKind,
      collapsed,
      boxCollapsed,
      pillTraveling,
      transition,
      requestStartNew,
      requestResume,
      requestDiscard,
      sessionRunning,
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
      subscribeTick,
      getElapsedMsNow,
      activeTimers,
      registerActiveTimer,
      unregisterActiveTimer,
      saveStatus,
      lastSavedAt,
      markDirty,
      forceSync,
      resetSignal,
    }),
    [
      status,
      elapsedMs,
      lastUpdated,
      pause,
      leaveSession,
      endAndSubmit,
      lastEndAction,
      transitionStage,
      transitionKind,
      collapsed,
      boxCollapsed,
      pillTraveling,
      transition,
      requestStartNew,
      requestResume,
      requestDiscard,
      sessionRunning,
      startedById,
      lastEndedById,
      presentStaffIds,
      isSessionMine,
      requestJoin,
      reviewModeUnlocked,
      isAbandoned,
      previousSessionMs,
      previousSessionEndedAt,
      subscribeTick,
      getElapsedMsNow,
      activeTimers,
      registerActiveTimer,
      unregisterActiveTimer,
      saveStatus,
      lastSavedAt,
      markDirty,
      forceSync,
      resetSignal,
    ],
  );

  const cardValue = useMemo(
    () => ({ markDirty, resetSignal, sessionRunning, canRecordData, hasElapsedTime }),
    [markDirty, resetSignal, sessionRunning, canRecordData, hasElapsedTime],
  );

  return (
    <SessionContext.Provider value={value}>
      <CardSessionContext.Provider value={cardValue}>{children}</CardSessionContext.Provider>
    </SessionContext.Provider>
  );
}

export function useRegisterActiveTimer(args: {
  id: string;
  label: string;
  active: boolean;
  elementRef: React.RefObject<HTMLElement | null>;
  source?: string;
  onActivate?: () => void;
}) {
  const { registerActiveTimer, unregisterActiveTimer } = useSession();
  const { id, label, active, elementRef, source, onActivate } = args;
  // Keep latest onActivate in a ref so we don't re-register on every render.
  const activateRef = useRef(onActivate);
  useEffect(() => {
    activateRef.current = onActivate;
  }, [onActivate]);
  // MorphContent's own display-mode crossfade (routes/index.tsx) keeps the
  // OLD card instance mounted for a brief exit fade via AnimatePresence
  // mode="popLayout" while the NEW instance for the same logical card
  // mounts immediately — so for that ~120ms window, two instances sharing
  // the same registry `id` coexist. Each reads its own `active` from a
  // local, mount-time-only snapshot (see useCardState's own comment on why
  // it doesn't resubscribe to a sibling's later writes), so the exiting
  // instance's `active` can be stale — and if it re-registers AFTER the
  // entering instance's correct unregister (ordering between the two
  // isn't guaranteed), a phantom "running" entry is left behind until the
  // exiting fiber finally unmounts. useIsPresent() distinguishes the two:
  // false exactly while AnimatePresence is playing this instance's exit,
  // so treating a non-present instance as inactive regardless of its own
  // (possibly stale) `active` value keeps the exiting instance from ever
  // contesting the registry entry the entering one owns. Safe to call
  // unconditionally — it defaults to true for any instance not nested in
  // an AnimatePresence at all.
  const isPresent = useIsPresent();
  const effectiveActive = active && isPresent;
  useEffect(() => {
    if (!effectiveActive) {
      unregisterActiveTimer(id);
      return;
    }
    registerActiveTimer({
      id,
      label,
      scrollTo: () => {
        elementRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      activate: () => activateRef.current?.(),
      source,
    });
    return () => unregisterActiveTimer(id);
  }, [effectiveActive, id, label, elementRef, source, registerActiveTimer, unregisterActiveTimer]);
}
