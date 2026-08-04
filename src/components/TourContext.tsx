import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StatusTab } from "./StatusBar";
import { useSettings } from "./SettingsContext";
import { TOUR_STEPS, type TourStep, type TourStepContext } from "./tourSteps";
import {
  useSpotlightTargetRect,
  type SpotlightRect,
  type SpotlightTargetStatus,
} from "@/hooks/use-spotlight-target-rect";

interface TourContextValue {
  active: boolean;
  currentStep: TourStep | null;
  stepIndex: number;
  stepCount: number;
  targetRect: SpotlightRect | null;
  targetStatus: SpotlightTargetStatus;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  /** The tour's own "Show tour next time" checkbox — deselected each time
   *  the tour (re)starts, read once at finish/skip to decide whether this
   *  run should re-arm tourCompleted for the next visit instead of the
   *  normal one-and-done behavior. See finish()'s own comment. */
  showNextTime: boolean;
  setShowNextTime: (v: boolean) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}

export function TourProvider({
  children,
  tab,
  setTab,
  hasAnyCards,
  mainSettled,
  forceLaunch,
  onForceLaunchHandled,
}: {
  children: ReactNode;
  /** The Data tab's live `tab`/`setTab` (IndexInner's own state) — the tour
   *  drives tab switches through the exact same setter the tab nav uses,
   *  rather than owning a parallel copy of "which tab is active." */
  tab: StatusTab;
  setTab: (t: StatusTab) => void;
  /** Feeds the "first-card" step's own isApplicable — skipped if this
   *  client has no cards to point at. */
  hasAnyCards: boolean;
  /** Rising edge (false -> true) is "the welcome->main slide just finished
   *  landing on main" — see routes/index.tsx's own Index() component. */
  mainSettled: boolean;
  /** Set by WelcomeScreen's "Preview guided tour" button — force-starts on
   *  the next mainSettled rising edge regardless of tourHintsEnabled/
   *  tourCompleted, a manual escape hatch for testing/demos distinct from
   *  the real auto-launch-on-first-use behavior. Owned by Index() (not
   *  here), since it has to be set BEFORE the screen-slide even starts. */
  forceLaunch: boolean;
  /** Called the instant a forced launch actually fires, so Index() can
   *  reset its own flag — otherwise it'd force-relaunch on every LATER
   *  mainSettled edge too (e.g. back to welcome, then a normal Get
   *  Started). */
  onForceLaunchHandled: () => void;
}) {
  const { tourHintsEnabled, tourCompleted, setTourCompleted } = useSettings();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [resolvedSteps, setResolvedSteps] = useState<TourStep[]>([]);
  // Bumped on every step change (start/next/back), even when two steps
  // happen to share a selector — see use-spotlight-target-rect's own comment on
  // why the measuring hook needs a fresh restart signal independent of the
  // selector string itself.
  const [generation, setGeneration] = useState(0);
  // Deselected by default on every fresh start — see the checkbox's own
  // rendering in TourOverlay. Plain state (not a ref) since it drives a
  // visible checked state.
  const [showNextTime, setShowNextTime] = useState(false);

  // Checking "Show tour next time" re-arms tourCompleted so the tour
  // auto-launches again on the very next mainSettled edge, instead of the
  // normal one-and-done behavior (tourCompleted -> true, no auto-relaunch
  // until manually replayed from Settings). Leaves tourHintsEnabled alone
  // either way — this only ever un-does "already seen it," it doesn't
  // override a deliberate Settings toggle to turn hints off entirely.
  const finish = useCallback(() => {
    setActive(false);
    setTourCompleted(!showNextTime);
  }, [setTourCompleted, showNextTime]);

  const start = useCallback(() => {
    const ctx: TourStepContext = { hasAnyCards };
    const applicable = TOUR_STEPS.filter((s) => !s.isApplicable || s.isApplicable(ctx));
    setResolvedSteps(applicable);
    setStepIndex(0);
    setActive(true);
    setShowNextTime(false);
    setGeneration((g) => g + 1);
  }, [hasAnyCards]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= resolvedSteps.length) return i;
      return i + 1;
    });
    setGeneration((g) => g + 1);
    if (stepIndex + 1 >= resolvedSteps.length) finish();
  }, [stepIndex, resolvedSteps.length, finish]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
    setGeneration((g) => g + 1);
  }, []);

  const skip = finish;

  // Auto-launch once, right as the welcome->main slide settles — not on
  // every render where mainSettled happens to already be true (e.g. the
  // user later taps the header's back button then Get Started again
  // mid-session shouldn't silently relaunch the tour a second time just
  // because this component re-rendered).
  const prevMainSettledRef = useRef(mainSettled);
  useEffect(() => {
    const risingEdge = mainSettled && !prevMainSettledRef.current;
    prevMainSettledRef.current = mainSettled;
    if (!risingEdge) return;
    if (forceLaunch) {
      start();
      onForceLaunchHandled();
    } else if (tourHintsEnabled && !tourCompleted) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainSettled]);

  const currentStep = active ? (resolvedSteps[stepIndex] ?? null) : null;

  // Drive the tab nav's own setTab whenever the current step needs a
  // different tab — same setter the tab buttons themselves use, so
  // everything else that reacts to `tab` (scroll restoration, drawer
  // suppression) behaves exactly as it would for a real click.
  // Deliberately keyed on `currentStep` alone, not `tab`/`setTab` too — this
  // should only fire when the STEP changes, never re-fire just because
  // `tab` itself changed (e.g. from this same call), which `tab` in the dep
  // array would cause.
  useEffect(() => {
    if (!currentStep) return;
    if (tab !== currentStep.tab) setTab(currentStep.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const { rect: targetRect, status: targetStatus } = useSpotlightTargetRect(
    currentStep?.selector ?? null,
    generation,
  );

  const value = useMemo(
    () => ({
      active,
      currentStep,
      stepIndex,
      stepCount: resolvedSteps.length,
      targetRect,
      targetStatus,
      start,
      next,
      back,
      skip,
      showNextTime,
      setShowNextTime,
    }),
    [
      active,
      currentStep,
      stepIndex,
      resolvedSteps.length,
      targetRect,
      targetStatus,
      start,
      next,
      back,
      skip,
      showNextTime,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
