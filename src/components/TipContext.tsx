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
import type { DisplayMode } from "./DataToolbarContext";
import { useSettings } from "./SettingsContext";
import { TABI_TIPS, type TabiTip } from "./tabiTips";
import { drawNextTipId } from "@/lib/tipShuffleBag";
import {
  useSpotlightTargetRect,
  type SpotlightRect,
  type SpotlightTargetStatus,
} from "@/hooks/use-spotlight-target-rect";

const ALL_TIP_IDS = TABI_TIPS.map((t) => t.id);

interface TipContextValue {
  active: boolean;
  currentTip: TabiTip | null;
  targetRect: SpotlightRect | null;
  targetStatus: SpotlightTargetStatus;
  drawTip: () => void;
  nextTip: () => void;
  dismiss: () => void;
}

const TipContext = createContext<TipContextValue | null>(null);

export function useTip() {
  const ctx = useContext(TipContext);
  if (!ctx) throw new Error("useTip must be used inside TipProvider");
  return ctx;
}

export function TipProvider({
  children,
  tab,
  setTab,
  setDisplayMode,
  mainSettled,
  /** True on the same `mainSettled` edge the guided tour is about to (or
   *  already did, via its own forceLaunch) auto-launch on — computed by
   *  IndexInner from TourContext's own inputs, not read directly from
   *  TourContext, so this provider never has to know the tour exists
   *  beyond this one boolean. Suppresses the tip's own auto-launch so the
   *  two overlays never stack. */
  tourWillAutoLaunch,
  forceLaunch,
  onForceLaunchHandled,
}: {
  children: ReactNode;
  tab: StatusTab;
  setTab: (t: StatusTab) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  mainSettled: boolean;
  tourWillAutoLaunch: boolean;
  /** Set by WelcomeScreen's "Preview a tip" escape hatch — same shape as
   *  the tour's own forceLaunch, force-shows a tip on the next mainSettled
   *  edge regardless of tipsEnabled/tourWillAutoLaunch. */
  forceLaunch: boolean;
  onForceLaunchHandled: () => void;
}) {
  const { tipsEnabled, tipBag, lastShownTipId, recordTipDraw } = useSettings();

  const [active, setActive] = useState(false);
  const [currentTipId, setCurrentTipId] = useState<string | null>(null);
  // Bumped on every draw (even a redraw landing on the same id would be a
  // one-in-24 coincidence, not worth special-casing) — same restart signal
  // role as TourContext's own generation counter.
  const [generation, setGeneration] = useState(0);

  // Internal bookkeeping only, not state that should re-render anything on
  // its own — how many more not-found redraws this "visit" (a fresh
  // user/auto-launch draw) is allowed before giving up quietly.
  const attemptsRemaining = useRef(TABI_TIPS.length);

  const drawTip = useCallback(() => {
    const { id, remainingBag } = drawNextTipId(tipBag, lastShownTipId, ALL_TIP_IDS);
    recordTipDraw(id, remainingBag);
    setCurrentTipId(id);
    setActive(true);
    setGeneration((g) => g + 1);
  }, [tipBag, lastShownTipId, recordTipDraw]);

  const nextTip = useCallback(() => {
    attemptsRemaining.current = TABI_TIPS.length;
    drawTip();
  }, [drawTip]);

  const dismiss = useCallback(() => setActive(false), []);

  // Auto-launch once, right as the welcome->main slide settles — mirrors
  // TourContext's own rising-edge effect exactly, see its comment for why
  // a plain `if (mainSettled)` check isn't enough.
  const prevMainSettledRef = useRef(mainSettled);
  useEffect(() => {
    const risingEdge = mainSettled && !prevMainSettledRef.current;
    prevMainSettledRef.current = mainSettled;
    if (!risingEdge) return;
    if (forceLaunch) {
      attemptsRemaining.current = TABI_TIPS.length;
      drawTip();
      onForceLaunchHandled();
    } else if (tipsEnabled && !tourWillAutoLaunch) {
      attemptsRemaining.current = TABI_TIPS.length;
      drawTip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainSettled]);

  const currentTip = active ? (TABI_TIPS.find((t) => t.id === currentTipId) ?? null) : null;

  // Several tip targets only exist in the DOM under a specific state (a
  // running session, review mode unlocked, etc. — see tabiTips.ts's own
  // note) — redraw a different tip rather than show a positionless/broken
  // callout, capped so an unlucky run of misses can't loop forever.
  const { rect: targetRect, status: targetStatus } = useSpotlightTargetRect(
    currentTip?.selector ?? null,
    generation,
  );
  useEffect(() => {
    if (!active || targetStatus !== "not-found") return;
    if (attemptsRemaining.current > 0) {
      attemptsRemaining.current -= 1;
      drawTip();
    } else {
      dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStatus]);

  // Defensive: a currentTipId that doesn't resolve to a real TABI_TIPS
  // entry should never happen from a real draw, but redraws immediately
  // rather than silently hanging forever if it ever does — sidesteps
  // useSpotlightTargetRect entirely (a null selector reports "not-found"
  // synchronously with no intervening "measuring" state, which can collide
  // with this provider's own pre-launch default and never register as a
  // change the effect above sees).
  useEffect(() => {
    if (!active || !currentTipId || currentTip) return;
    if (attemptsRemaining.current > 0) {
      attemptsRemaining.current -= 1;
      drawTip();
    } else {
      dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTipId]);

  // Drive the tab nav to wherever the current tip lives — same setter the
  // tab buttons themselves use, identical shape to TourContext's own.
  useEffect(() => {
    if (!currentTip) return;
    if (tab !== currentTip.tab) setTab(currentTip.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTip]);

  // No tour analog — lets a future tip point at something that only
  // renders in one Data-tab view mode (tabiTips.ts declared this field up
  // front for exactly that; no current tip sets it).
  useEffect(() => {
    if (!currentTip?.viewMode) return;
    setDisplayMode(currentTip.viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTip]);

  const value = useMemo(
    () => ({ active, currentTip, targetRect, targetStatus, drawTip, nextTip, dismiss }),
    [active, currentTip, targetRect, targetStatus, drawTip, nextTip, dismiss],
  );

  return <TipContext.Provider value={value}>{children}</TipContext.Provider>;
}
