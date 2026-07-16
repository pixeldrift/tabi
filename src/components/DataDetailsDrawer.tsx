import { createPortal } from "react-dom";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "motion/react";
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { DoubleChevronIcon } from "./icons/DoubleChevronIcon";
import { renderBreakableTitle } from "./BreakableTitle";
import { useElementHeight, useElementRight } from "@/hooks/use-element-height";
import { cn } from "@/lib/utils";

/** Breathing room left between a hugCardRight drawer's panel edge and the
 *  tile's own right edge — enough to read as a gap, not so much that it eats
 *  into the panel's already-tight body width. */
const DRAWER_TILE_GAP_PX = 6;

/** How long the outgoing card's content plays its exit slide before the
 *  real prev/next callback fires (see triggerPrev/triggerNext) — the
 *  parent doesn't actually switch `activeId` until this elapses, so the
 *  still-mounted outgoing instance has time to animate out before it's
 *  replaced by a freshly-mounted one for the new card. */
const EXIT_MS = 220;

/** Minimum breathing room, in px, kept between the drawer's normal-width
 *  left edge and the toolbar's view-mode icon cluster's own right edge (see
 *  viewModeIconsRight below) — enough to read as a clear gap, not just a
 *  hairline. */
const VIEW_MODE_ICONS_CLEARANCE_PX = 16;

/** Shared by both the outgoing (exit) and incoming (enter) title/content
 *  slides so the two halves read as one continuous motion instead of two
 *  mismatched animations stitched together — same duration, same curve,
 *  on both sides of the swap. */
const SLIDE_TRANSITION = { duration: EXIT_MS / 1000, ease: "easeInOut" } as const;

/** Whether an entering instance has cleared its "just mounted, still at the
 *  off-screen starting position" frame yet. An ancestor `<AnimatePresence
 *  initial={false}>` (see routes/index.tsx's card list) propagates that
 *  `initial={false}` down through context to every descendant motion
 *  component, no matter how deeply nested or how much later it mounts —
 *  so a plain `initial`-to-`animate` prop pair on these title/content
 *  elements never actually animates on mount, it just pops straight to
 *  the `animate` target. Framer *does* still animate a plain value change
 *  on an already-mounted instance regardless of that context, so the
 *  entrance is driven the same way the exit already is: render the first
 *  frame already sitting at the off-screen position (no transition), then
 *  flip a state field a tick later so the following render's `animate`
 *  change actually plays as a real, observable transition. */
function useEnterPhase(slideFrom: "left" | "right" | null | undefined) {
  const [entered, setEntered] = useState(!slideFrom);
  useEffect(() => {
    if (!slideFrom) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [slideFrom]);
  return entered;
}

/** The title's own vertical reel, split into its own memoized component so
 *  the panel's own arrowTop/hugWidth/offDirection state (which updates on
 *  every scroll/resize tick while the drawer is open) doesn't re-render —
 *  and thereby restart — this mid-flight slide/fade tween. */
const DrawerTitle = memo(function DrawerTitle({
  title,
  slideFrom,
  exitDir,
  onClick,
}: {
  title: string;
  slideFrom?: "left" | "right" | null;
  exitDir: "prev" | "next" | null;
  onClick: (e: React.MouseEvent) => void;
}) {
  const entered = useEnterPhase(slideFrom);
  const entering = slideFrom && !entered;
  return (
    // The title's own vertical reel — a plain "cards flowing left/right"
    // slide would read oddly on multi-line text, so it moves vertically
    // instead (like an odometer digit), matching the same "prev/next"
    // direction as the horizontal content slide below: prev reels upward
    // (this exits up, the incoming title rises up from below), next reels
    // downward (opposite). Clickable — scrolls the (now-sticky) body back
    // to top.
    <motion.h2
      onClick={onClick}
      // The prev/next/close/expand buttons flanking this title are all
      // size-7 (1.75rem tall) with their own icon glyph centered inside via
      // grid place-items-center — but this title's own single line of text
      // is only 1.15em tall (leading-[1.15]), and items-start (see the
      // header row above) aligns everything by box TOP, not center. Left
      // alone, that pins the (shorter) first line's own vertical center
      // noticeably above the (taller) button's own glyph center instead of
      // matching it. This margin nudges just the text down by exactly that
      // gap — half the height difference between the two — so the first
      // line's center lines up with the buttons' glyph center the same way
      // it would if both were simply centered together, while still only
      // ever growing the row downward as more lines wrap (this offset is a
      // fixed amount added once, not a function of how many lines follow).
      className="font-display text-base leading-[1.15] flex-1 min-w-0 break-words cursor-pointer select-none text-center mt-[calc((1.75rem-1.15em)/2)]"
      animate={
        exitDir
          ? { y: exitDir === "next" ? 16 : -16, opacity: 0 }
          : entering
            ? { y: slideFrom === "right" ? -16 : 16, opacity: 0 }
            : { y: 0, opacity: 1 }
      }
      transition={entering ? { duration: 0 } : SLIDE_TRANSITION}
    >
      {renderBreakableTitle(title)}
    </motion.h2>
  );
});

/** Same reasoning as DrawerTitle above — kept separate from the panel's
 *  own frequently re-rendering state. */
const DrawerContent = memo(function DrawerContent({
  details,
  slideFrom,
  exitDir,
  contentScrollRef,
}: {
  details?: ReactNode;
  slideFrom?: "left" | "right" | null;
  exitDir: "prev" | "next" | null;
  contentScrollRef: RefObject<HTMLDivElement | null>;
}) {
  const entered = useEnterPhase(slideFrom);
  const entering = slideFrom && !entered;
  return (
    <div
      ref={contentScrollRef}
      // overscroll-contain: stops this scroll region from "bleeding through"
      // once it hits its own top/bottom bound — without it, the underlying
      // card list (still scrollable behind the drawer) picks up whatever
      // scroll delta this div didn't consume, so flicking past the end of
      // the drawer's content also visibly scrolls the pane behind it.
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4"
    >
      <motion.div
        animate={
          exitDir
            ? { x: exitDir === "next" ? -24 : 24, opacity: 0 }
            : entering
              ? { x: slideFrom === "right" ? 24 : -24, opacity: 0 }
              : { x: 0, opacity: 1 }
        }
        transition={entering ? { duration: 0 } : SLIDE_TRANSITION}
      >
        {details && <div className="text-sm">{details}</div>}
      </motion.div>
    </div>
  );
});

export interface DataDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  details?: ReactNode;
  /** Skip to the previous/next card in display order without closing the
   *  drawer — rendered as small circular arrows flanking the title. Omit
   *  (leave undefined) when there's nowhere to go — e.g. only one visible
   *  card — the corresponding arrow renders disabled. */
  onPrevCard?: () => void;
  onNextCard?: () => void;
  /** Set by the parent for exactly the one mount that follows a prev/next
   *  click, so this freshly-mounted card's drawer knows to slide its
   *  content in from that side instead of just appearing in place. Since
   *  the whole component remounts fresh per active-card change (see
   *  CardShell/MiniTileShell/DataListRow's own `{isActive && ...}` gating),
   *  a plain `initial` offset read once at mount is enough — no
   *  AnimatePresence needed. */
  slideFrom?: "left" | "right" | null;
  /** Viewport-relative pixel offset where the sticky toolbar begins — the
   *  drawer starts here (not below the toolbar) so it slides out on top of
   *  the toolbar's filter/sort/search row, not just the pane below it. */
  top: number;
  /** The toolbar's own rendered height, in px — the pull tab is pinned to
   *  straddle the seam between the toolbar and the pane below it (this far
   *  down from the panel's own top), rather than the panel's literal top
   *  edge, which now sits higher up at the toolbar's own top. */
  toolbarHeight: number;
  /** The card this drawer's contents describe — its on-screen position
   *  drives the arrow pointing back at it. */
  cardRef: RefObject<HTMLElement | null>;
  /** The panel's own default resting width, in px, when neither dragged to
   *  full width nor `hugCardRight`. The sm+ half pairs with card mode's own
   *  drawerOpen compression (see IndexInner), which collapses to a single
   *  ~55%-wide column so this can sit alongside it rather than covering it;
   *  the "+14px" past an even half covers a card's own top-right info
   *  button the same way the list row's does. Below sm, card content stays
   *  full-width instead (too dense to compress at phone widths without
   *  truncating), so this just overlays on top there rather than sitting
   *  side-by-side. Ignored once `hugCardRight` computes a real width — this
   *  only matters as its fallback until then. */
  normalWidthPx?: (viewportWidth: number) => number;
  /** Instead of a fixed normalWidthPx, size the panel to exactly reach
   *  `cardRef`'s own right edge — for the quick-action grids, where each
   *  tile's own width is a card-count-dependent, non-round fraction of the
   *  pane (a plain half-viewport-ish normalWidthPx would either fall short
   *  of the tile's edge or overshoot past it, rather than the two meeting
   *  exactly). Measured the same way `arrowTop` already is, from the same
   *  card rect. Unlike normalWidthPx's own fallback, this doesn't add any
   *  extra overlap past that edge by default — see `hugGapPx` to change that. */
  hugCardRight?: boolean;
  /** How far past `cardRef`'s own right edge the panel's left edge sits,
   *  when `hugCardRight` is set — positive leaves breathing room (the
   *  default, DRAWER_TILE_GAP_PX), negative has the panel intentionally
   *  overlap INTO the tile instead of stopping short of it. Large grid
   *  tiles pass a negative value here since their action controls sit
   *  centered with room to spare on the right edge, so a small overlap
   *  reads as a wider, more confident panel rather than covering anything
   *  clickable — small grid tiles are too narrow for that margin, so they
   *  keep the default gap. */
  hugGapPx?: number;
  /** Which of the two open widths the panel is resting at — lifted up to
   *  (and owned by) the caller rather than kept as this component's own
   *  local state, the same way `open` already is: the whole component
   *  remounts fresh on every prev/next card switch (see `slideFrom`'s own
   *  comment), and local state doesn't survive a remount. Falls back to an
   *  internal default ("normal") when omitted, for any caller that doesn't
   *  need cross-card persistence. */
  widthMode?: "normal" | "full";
  onWidthModeChange?: (mode: "normal" | "full") => void;
}

/** A single shared, non-modal details panel — mounted only by whichever card
 *  is currently active (see CardShell) — rendered via portal so its `fixed`
 *  positioning isn't trapped by a transformed ancestor (Reorder.Item/motion
 *  layout tracking elsewhere in the card list). The pull tab and arrow are
 *  children of the same animated element, so they slide and reposition
 *  together with the panel instead of living separately in the toolbar. */
export function DataDetailsDrawer({
  open,
  onOpenChange,
  title,
  description,
  details,
  onPrevCard,
  onNextCard,
  slideFrom,
  top,
  toolbarHeight,
  cardRef,
  normalWidthPx: normalWidthPxFn = (vw) => (vw < 640 ? vw * 0.88 : vw * 0.5 + 14),
  hugCardRight = false,
  hugGapPx = DRAWER_TILE_GAP_PX,
  widthMode: widthModeProp,
  onWidthModeChange: onWidthModeChangeProp,
}: DataDetailsDrawerProps) {
  // Just the toolbar row's own collapsed height — not `toolbarHeight` (which
  // also grows by the "Start session" banner's variable height below it).
  // The pull tab and sticky header should track "the filter bar" itself at
  // its normal height, not balloon whenever that banner happens to be
  // showing — measured directly here (rather than threaded down as a prop)
  // since it's a different element than whatever positions this drawer.
  const toolbarRowHeight = useElementHeight("[data-toolbar-row]");
  const [mounted, setMounted] = useState(false);
  const [arrowTop, setArrowTop] = useState(0);
  // Lazily measured up front (not just `null`, corrected a frame later by
  // the layout effect below) — `x`'s own useMotionValue call just below only
  // ever reads its initializer argument once, on this exact first render, so
  // if this started at `null` here it would bake that (wrong, fallback-width)
  // value into `x` permanently; the layout effect's later correction would
  // then only reach it through an actual spring animation, visibly playing
  // out as the panel briefly changing width right after a prev/next switch.
  // Measuring synchronously here instead means the first real value is
  // already correct, before `x` ever reads it.
  const [hugWidth, setHugWidth] = useState<number | null>(() => {
    if (!hugCardRight) return null;
    const el = cardRef.current;
    if (!el) return null;
    return window.innerWidth - el.getBoundingClientRect().right - hugGapPx;
  });
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Right edge (viewport-relative px) of the toolbar's view-mode segmented
  // control — 0 until measured, which is treated as "not yet known" below
  // rather than clamping the drawer down to nothing on the very first
  // render. Only bounds the plain normalWidthPxFn fallback, not hugCardRight
  // — the two grid display modes already size themselves off a real tile's
  // own measured edge, which never comes anywhere near this cluster.
  const viewModeIconsRight = useElementRight("[data-view-mode-toggle]");
  // Set once the card has scrolled fully out of the visible pane (not just
  // clamped near an edge — clampedArrowTop below already handles "close to
  // the edge" by sliding the diamond to it). While this is set, the arrow —
  // which would otherwise have to point off the top/bottom of the panel —
  // is replaced by a button indicating which way to scroll to bring the
  // card back into view.
  const [offDirection, setOffDirection] = useState<"above" | "below" | null>(null);
  // Which of the two open widths the panel is currently resting at — a tap
  // on the pull tab only ever toggles "normal" vs. closed (see its onClick);
  // "full" is reached only by dragging the tab all the way left. Reset to
  // "normal" the moment the drawer closes so the next open always starts at
  // the usual width rather than remembering a full-width session. Falls
  // back to local state when the caller doesn't lift this (see the props'
  // own comment) — same optional-controlled-prop shape as `open`/
  // `onOpenChange` conceptually are, just not made fully required since not
  // every caller cares about cross-card persistence.
  const [localWidthMode, setLocalWidthMode] = useState<"normal" | "full">("normal");
  const widthMode = widthModeProp ?? localWidthMode;
  const setWidthMode = onWidthModeChangeProp ?? setLocalWidthMode;
  // The "reset to normal on close" used to live in a `useEffect` keyed on
  // `open` — but effects fire asynchronously relative to the click events
  // that trigger them, and a double-click's two constituent single clicks
  // (each toggling `open` on its own, before the dblclick handler even
  // runs — see openToFull's own comment) could commit their close-triggered
  // reset AFTER openToFull had already set widthMode:"full", stale-stomping
  // it back down a beat later. That race got worse (not better) once
  // `widthMode` moved from this component's own local state to a value
  // lifted up to a distant ancestor (see the props' own comment) — the
  // re-render it now triggers is much bigger, which only widens the window
  // for the stale effect to land after the fact. Doing the reset inline,
  // synchronously, in the same handler that actually closes the drawer
  // sidesteps the whole race: there's no async gap left for a later commit
  // to land in.
  const closeDrawer = () => {
    setWidthMode("normal");
    onOpenChange(false);
  };

  // Guards every window.innerWidth read below — this whole block runs
  // above the `if (!mounted) return null` gate (hooks can't follow a
  // conditional return), and this app's dev server does an initial SSR
  // pass where `window` doesn't exist yet (see the mounted-gated JSX
  // further down, which already assumed a browser and read window there
  // safely). 0 is never actually seen on screen — first real paint happens
  // client-side, by which point window is real and this recomputes.
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;

  // The panel's own resting width, in px, for whichever non-full state it's
  // in right now — hugWidth (once measured) wins the same way it already
  // does for the old CSS width class, falling back to normalWidthPxFn until
  // then. Recomputed fresh every render (no memoization) so it's
  // automatically fresh, including the one triggered by the resize
  // listener below.
  const rawRestingWidthPx = hugCardRight && hugWidth !== null ? hugWidth : normalWidthPxFn(viewportWidth);
  // Caps the plain (non-hugCardRight) fallback width so the panel's own
  // normal-width left edge never rests to the left of the view-mode icon
  // cluster's right edge — otherwise, at wider default widths, list/card
  // mode's drawer would open right on top of those buttons instead of
  // beside them. Infinity (no cap) until the cluster's actually been
  // measured, and hugCardRight skips this entirely — its own measured width
  // already stops well short of the toolbar's far-left controls.
  const maxRestingWidthPx =
    viewModeIconsRight > 0
      ? Math.max(0, viewportWidth - viewModeIconsRight - VIEW_MODE_ICONS_CLEARANCE_PX)
      : Infinity;
  const restingWidthPx = hugCardRight ? rawRestingWidthPx : Math.min(rawRestingWidthPx, maxRestingWidthPx);

  // Drives the panel's own horizontal position — always rendered at a full
  // viewport width (see the panel's own w-full below) and translated via x
  // to reveal only as much as the current state calls for, rather than
  // animating `width` itself: a transform is cheap to update every frame of
  // a drag/spring, where `width` would force a synchronous layout each time.
  // x === 0 is fully expanded (the panel's own left edge sits at the
  // viewport's own left edge); x === viewport width is fully closed (the
  // whole panel — pull tab included — has slid completely off the right
  // edge); anything in between reveals exactly that many px from the right.
  // Mirrors the sync effect's own target formula below exactly (including
  // the widthMode==="full" case) — this only runs once, on mount, so a
  // fresh prev/next remount while at full width used to ignore widthMode
  // here and initialize at the NORMAL-width target instead, then visibly
  // spring the rest of the way to 0 once that effect's first commit caught
  // up a beat later.
  const x = useMotionValue(
    !open ? viewportWidth : widthMode === "full" ? 0 : viewportWidth - restingWidthPx,
  );
  // The shell above is always rendered at full viewport width so translating
  // it is cheap — but that means everything INSIDE it (header, body) also
  // defaults to that same full local width. Left unconstrained, right-flush
  // content (the close button, the next-card arrow) ends up positioned at
  // the shell's own right edge — which, at any x > 0, sits translated PAST
  // the real viewport's right edge and is therefore genuinely invisible and
  // unclickable, not just visually off. What's actually on-screen of the
  // shell is its own LEFT portion, [0, viewportWidth - x] in the shell's
  // local coordinates — so the content wrapper below is sized to exactly
  // that (viewportWidth - x, derived straight from the same drag/spring
  // value driving the shell itself, not a separate widthMode branch) so it
  // continuously fills whatever's actually visible, mid-drag included,
  // rather than only being correct once a drag settles.
  const contentWidth = useTransform(x, (val) => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    return vw - val;
  });
  const isDraggingRef = useRef(false);
  // A swipe gesture still ends in a native click on whatever was under the
  // pointer (pointerdown + pointerup with little movement is a click
  // regardless of the pan machinery layered on top) — without this, every
  // swipe would also fire that element's own click handler (toggle, close,
  // prev/next) and immediately undo whatever the swipe just settled on.
  // Same idiom as NotificationBar's own swipe-vs-tap guard, just applied to
  // every clickable thing on the panel now that the whole surface is a pan
  // surface, not just the pull tab.
  const wasDraggingRef = useRef(false);
  // Armed just before a swipe-driven setWidthMode/onOpenChange call, so the
  // sync effect below — which would otherwise immediately re-animate `x` to
  // the same target it's already being sent to, but without the release
  // velocity onPanEnd already knows about — skips exactly that one run
  // instead of restarting the spring from a dead stop.
  const skipNextSyncRef = useRef(false);

  // Keeps `x` pointed at wherever (open, widthMode, restingWidthPx) say it
  // should rest — covers the pull tab's own tap-to-toggle, the header's
  // Close button, Escape, and a resting resize, as well as (see onPanEnd
  // below) every swipe: a swipe never moves `x` itself mid-gesture, so this
  // effect is what actually plays the transition once onPanEnd decides
  // which detent to land on and calls setWidthMode/onOpenChange.
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const target = !open ? window.innerWidth : widthMode === "full" ? 0 : window.innerWidth - restingWidthPx;
    const controls = animate(x, target, { type: "spring", stiffness: 340, damping: 34 });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, widthMode, restingWidthPx]);

  const handlePanStart = () => {
    isDraggingRef.current = true;
    wasDraggingRef.current = true;
  };

  // Decides which of the three resting spots (full / normal / closed) a
  // released swipe lands on — modeled as a swipe-to-dismiss gesture (the
  // Facebook/Instagram "swipe a sheet closed" idiom) rather than a
  // plain drag-to-position: where your finger happens to be isn't the whole
  // story, how fast you were moving when you let go matters just as much.
  // Both "normal" (open) and "full" are sticky detents that resist a slow,
  // undecided release — leaving one takes either swiping clearly past it or
  // releasing with real speed — while a hard enough swipe from "full" can
  // skip "normal" entirely and land on "closed" in one motion, the same way
  // a fast flick down a stack of sheets blows past the middle stop.
  //
  // Deliberately built on Framer's standalone onPan/onPanEnd handlers rather
  // than `drag` — `drag` would have `x` visually track the pointer in real
  // time, letting the panel rest at any arbitrary width the instant you lift
  // your finger. Plain pan handlers report the same offset/velocity info
  // without ever touching `x` themselves, so the panel only ever moves via
  // the `animate()` calls below and in the sync effect above — always a
  // spring straight to one of the three fixed detents, never a position the
  // gesture passed through along the way.
  const handlePanEnd = (_e: unknown, info: PanInfo) => {
    isDraggingRef.current = false;
    // The resting position this swipe started from — never touched mid-pan
    // (see the comment above), so still exactly where it was before the
    // pointer went down.
    const restingAtStart = x.get();
    const vx = info.velocity.x;
    const vw = window.innerWidth;
    const xFull = 0;
    const xNormal = vw - restingWidthPx;
    const xClosed = vw;

    // Reconstructs where a live-following drag would have ended up — the
    // starting rest position plus the pointer's own raw cumulative offset,
    // clamped to the same bounds a real drag's dragConstraints would have
    // enforced — since nothing actually moved the panel to read that back
    // off of `x` itself.
    const draggedTo = Math.min(xClosed, Math.max(xFull, restingAtStart + info.offset.x));

    // Projects where the gesture would carry the panel a beat past release
    // if its velocity kept going — a fast flick lands far past its own raw
    // stop point, a slow deliberate drag barely moves past it at all.
    // Picking a target off THIS projected point rather than the raw release
    // point is what lets a hard swipe from "full" reach "closed" directly
    // (the projection overshoots past "normal" toward "closed") while a
    // gentler swipe covering the same on-screen distance still only
    // reaches "normal".
    const PROJECTION_SEC = 0.22;
    const projected = Math.min(xClosed, Math.max(xFull, draggedTo + vx * PROJECTION_SEC));

    // Each detent holds onto a gesture that started there unless the
    // projection clears a real chunk of the gap to its neighbor — capped at
    // half the smaller neighboring gap so the bonus can never make a detent
    // literally unleavable on a narrow viewport (same reasoning the old
    // flat STICKY_RADIUS needed capping for).
    const startMode: "full" | "normal" | "closed" = !open ? "closed" : widthMode;
    const gapFullNormal = xNormal - xFull;
    const gapNormalClosed = xClosed - xNormal;
    const stickyBonus = (mode: "full" | "normal" | "closed") => {
      if (mode !== startMode) return 0;
      if (mode === "normal") return Math.min(70, gapFullNormal / 2, gapNormalClosed / 2);
      if (mode === "full") return Math.min(70, gapFullNormal / 2);
      return Math.min(70, gapNormalClosed / 2);
    };

    const detents: { mode: "full" | "normal" | "closed"; x: number }[] = [
      { mode: "full", x: xFull },
      { mode: "normal", x: xNormal },
      { mode: "closed", x: xClosed },
    ];
    let target = detents[0];
    let bestScore = Infinity;
    for (const d of detents) {
      const score = Math.abs(d.x - projected) - stickyBonus(d.mode);
      if (score < bestScore) {
        bestScore = score;
        target = d;
      }
    }

    const willClose = target.mode === "closed";
    const mode: "normal" | "full" = willClose ? "normal" : target.mode === "full" ? "full" : "normal";

    animate(x, target.x, { type: "spring", velocity: vx, stiffness: 340, damping: 34 });
    if (mode !== widthMode || willClose) skipNextSyncRef.current = true;
    if (mode !== widthMode) setWidthMode(mode);
    if (willClose) onOpenChange(false);
    // Cleared a tick later, not synchronously — the click this drag's own
    // pointerup produces fires (as a browser event) right after this
    // handler returns, so it has to still see wasDraggingRef as true.
    window.setTimeout(() => {
      wasDraggingRef.current = false;
    }, 80);
  };

  // Which nav button is mid-press — set the instant it's clicked so THIS
  // (still-mounted, about-to-be-replaced) instance can play its own exit
  // slide immediately, rather than just vanishing the moment the parent's
  // real callback swaps activeId. The real onPrevCard/onNextCard only
  // fires after EXIT_MS, once that exit has actually played out.
  const [exitDir, setExitDir] = useState<"prev" | "next" | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(exitTimeoutRef.current ?? undefined), []);

  const triggerPrev = () => {
    if (!onPrevCard || exitDir) return;
    setExitDir("prev");
    exitTimeoutRef.current = window.setTimeout(() => onPrevCard(), EXIT_MS);
  };
  const triggerNext = () => {
    if (!onNextCard || exitDir) return;
    setExitDir("next");
    exitTimeoutRef.current = window.setTimeout(() => onNextCard(), EXIT_MS);
  };

  useEffect(() => setMounted(true), []);

  // useLayoutEffect (not useEffect) — this runs before the browser paints,
  // so a freshly-mounted instance (after a prev/next card switch) measures
  // and settles arrowTop/hugWidth in the same frame it first renders,
  // instead of painting once at their zeroed defaults and visibly
  // snapping into place a frame later.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2 - top;
      setArrowTop(midY);
      // A small positive gap (unlike Card/List's normalWidthPx fallback,
      // which deliberately reaches a bit past a card's own edge to cover its
      // now-redundant info button) — a tile is small enough that a body
      // overlap running its full height would sit across real controls the
      // whole way down, not just near one button. So the panel's left edge
      // stops a few px short of the tile's right edge instead, leaving a
      // sliver of breathing room; only the arrow (below, via its own fixed
      // inset, unaffected by this gap) and the pull tab still dip into the
      // tile a little, the same intentional, localized overlap Card/List's
      // fallback width has always accepted.
      if (hugCardRight) setHugWidth(window.innerWidth - rect.right - hugGapPx);
      // Same thresholds as clampedArrowTop below (minArrowTop/maxArrowTop) —
      // switch to the scroll-to-card button as soon as the arrow's natural
      // position would need clamping to the drawer's top (toolbar) or
      // bottom edge, rather than waiting for the card to scroll fully out
      // of view. A clamped-but-still-a-diamond arrow sitting pinned at that
      // edge for a while first (while the card is still mostly visible)
      // read as pointing at nothing in particular; this way the switch
      // happens right as the arrow would have started sitting still.
      const minTop = toolbarHeight + 24;
      const maxTop = Math.max(minTop, window.innerHeight - top - 24);
      if (midY < minTop) setOffDirection("above");
      else if (midY > maxTop) setOffDirection("below");
      else setOffDirection(null);
    };
    // A grid-mode tile has already finished reflowing into its single left
    // column by the time `open` goes true (IndexInner delays the drawer's
    // own slide-open until that settles — see its own comment), so a single
    // measurement now lands on the tile's real, final position instead of
    // needing to poll every frame to chase a still-moving one.
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [open, top, toolbarHeight, cardRef, hugCardRight, hugGapPx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A Radix Dialog (e.g. DrawerQuickFacts' data-type/phase info modal)
      // opened from inside this drawer adds its own Escape handling, but
      // doesn't stop the event from also reaching this listener — without
      // this guard, dismissing that modal with Escape closed the whole
      // drawer out from under it too. Registered with `capture: true` so
      // this runs during the capture phase, before Radix's own dismiss
      // layer (which reacts on a plain bubble/document listener) has had a
      // chance to react to this same keydown — checking after that point
      // would already see the dialog mid-close and miss it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      closeDrawer();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Same smooth-center pattern as the Schedule tab's own "Now" button.
  const scrollToCard = () => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Tapping the (now-sticky) title jumps its scrolled content back to top —
  // a quick way back after digging into a long teaching-procedure section.
  // Wrapped in useCallback (stable identity) so it doesn't defeat
  // DrawerTitle's memoization below.
  const onTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggingRef.current) return;
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Double-tapping the pull tab jumps straight to full width — a shortcut
  // past "normal" for anyone who already knows that's where they're headed.
  // Deliberately NOT implemented via the browser's native `dblclick`/React's
  // `onDoubleClick` — the whole panel doubles as a drag surface (see `drag`
  // on the panel below), and something about that combination reliably
  // suppresses native double-click synthesis on this button in practice
  // (confirmed empirically: same DOM node throughout, well within any
  // timing threshold, still zero native `dblclick` events observed even
  // with a raw two-click CDP dispatch and a capture-phase listener on
  // `document`). Detecting the second tap ourselves — same click handler,
  // just checking how recently the previous one landed — sidesteps
  // whatever that interaction is entirely, since it never depends on the
  // browser agreeing the two clicks constitute a "double click" at all.
  const lastTabClickAtRef = useRef(0);
  const DOUBLE_TAP_MS = 350;
  const openToFull = () => {
    setWidthMode("full");
    onOpenChange(true);
  };

  if (!mounted) return null;

  // Kept below the toolbar-covered strip at the panel's own top (the arrow
  // only ever points at a card in the pane, never into the toolbar itself).
  const minArrowTop = toolbarHeight + 24;
  const maxArrowTop = Math.max(minArrowTop, window.innerHeight - top - 24);
  const clampedArrowTop = Math.min(Math.max(arrowTop, minArrowTop), maxArrowTop);

  return createPortal(
    <motion.div
      // z-[62]: above the sticky toolbar's z-[60] — the panel now starts at
      // the toolbar's own top (see `top` below) so it slides out on top of
      // the filter/sort/search row instead of only covering the pane below
      // it, which means it has to out-stack the toolbar, not just sit next
      // to it.
      className={cn(
        // Always a full viewport width — see the `x` motion value above for
        // why position, not width, is what actually changes.
        "fixed right-0 w-full z-[62] bg-background shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.25)]",
        // Matches the active card's own border while open — same blue, same
        // 2px weight — so the drawer visibly reads as "this card, pulled
        // out," not a generic unrelated panel. Only drawn on edges that
        // aren't already flush against the real viewport edge: top never is
        // (the panel starts at `top`, below the header, in both states),
        // right and bottom always are (the panel is pinned right-0/bottom-0
        // regardless of width), and left is the one that flips — flush at
        // full width (the panel's own left edge IS the viewport's left edge
        // then) but not at normal width, where it's the one real seam
        // between the drawer and whatever's showing behind it. The
        // now-removed pull tab used to supply its own top-left rounding at
        // that same normal-width seam (see the old comment on the tab
        // below); with the tab gone, the panel's own corner takes over that
        // rounding instead so it still reads as one continuous shape rather
        // than a flat corner where the tab used to attach. Not rounded at
        // full width — that corner sits flush against the real viewport
        // corner there, where a rounded cutout would just expose whatever's
        // behind the page instead of reading as a merged shape.
        open
          ? cn(
              "border-blue-400/80",
              widthMode === "full" ? "border-t-2" : "border-t-2 border-l-2 rounded-tl-lg",
            )
          : "border border-border/70",
      )}
      // touchAction: "pan-y" — the same touch-scroll carve-out `drag="x"`
      // used to configure automatically, kept now that horizontal gesture
      // tracking comes from plain onPan handlers instead: lets a vertical
      // scroll on a touchscreen still pass through unclaimed, while a
      // horizontal swipe on this panel is recognized as a swipe.
      style={{ x, top, bottom: 0, touchAction: "pan-y" }}
      onPanStart={handlePanStart}
      onPanEnd={handlePanEnd}
      aria-hidden={!open}
    >
      {/* Pull tab — attached to the panel's own left edge (a child of the
          same animated element) so it rides along with the slide instead of
          staying fixed in the toolbar while the panel moves out from under
          it. Sized to toolbarRowHeight (the toolbar's own primary row, not
          `toolbarHeight`, which also includes the "Start session" banner's
          variable height below the row — that isn't part of "the filter
          bar" this tab should span). No border on the right so it blends
          seamlessly into the drawer — `border-r-0` has to come after the
          border-color/width utilities below (not just after `border-r-0` in
          this string) or `cn`'s tailwind-merge treats `border-2`/`border` as
          the later, winning declaration for every side, right included.
          -top-0.5 shifts it up by the panel's own 2px border width, so the
          tab's outer top edge lines up with the panel's outer top edge
          instead of sitting a couple pixels below it (top-0 aligns with the
          inside of that border, not the outside). Only rendered while
          closed — once open (either width), the tab has nothing left to do:
          the whole panel already drags as its own handle, and its own
          expand/collapse control has moved into the sticky header below
          (see the header's own leading button) rather than living out here
          past the panel's own edge. */}
      {!open && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (wasDraggingRef.current) return;
            const now = Date.now();
            const isDoubleTap = now - lastTabClickAtRef.current < DOUBLE_TAP_MS;
            lastTabClickAtRef.current = now;
            if (isDoubleTap) {
              openToFull();
              return;
            }
            onOpenChange(true);
          }}
          aria-label="Open details drawer"
          aria-expanded={false}
          className="absolute -left-7 -top-0.5 w-7 grid place-items-center rounded-l-lg border border-border/70 border-r-0 bg-background text-stone-500 hover:text-stone-800 transition-colors touch-none"
          style={{ height: toolbarRowHeight }}
        >
          {/* Only one direction does anything from here (drag/tap left to
              open), so the single chevron's own base-right orientation
              rotates to point left, toward that action. */}
          <TimeChevronIcon className="size-3.5 rotate-180" />
        </button>
      )}

      {/* Arrow — points at the card this drawer's contents belong to. Only
          rendered while open: when the panel slides off-screen its fixed
          -9px offset from the (now off-screen) left edge would otherwise
          leave it sitting as a stray diamond near the viewport's right
          edge instead of leaving with the rest of the panel. Swapped out
          entirely once the card has scrolled fully out of the visible pane
          — pointing at a card that isn't there to point at reads as broken,
          not just imprecise, so a direction button takes its place instead
          (see offDirection above). Hidden at full width too — the card it
          points to is now completely covered by the panel itself, not just
          sitting beside it, so pointing "at" it no longer means anything. */}
      {open && !offDirection && widthMode !== "full" && (
        <div
          // size-6 (24px) is size-4 (16px) scaled by 1.5x, so the -left
          // offset scales with it too — nudged a little further in past
          // that scaled value so the diamond overlaps into the panel's own
          // border instead of just touching it, hiding the unbordered
          // corner's sharp square edge behind the panel rather than
          // leaving it exposed. 2px blue borders to match the panel/tab's
          // own outline.
          className="absolute -left-[13px] size-6 -translate-y-1/2 rotate-45 border-l-2 border-b-2 border-blue-400/80 bg-background shadow-[-2px_2px_3px_-1px_rgba(0,0,0,0.15)]"
          style={{ top: clampedArrowTop }}
          aria-hidden
        />
      )}

      {/* Off-screen indicator — replaces the arrow above once the card it
          points to has scrolled fully out of view. Same corner the arrow
          would otherwise sit near (top-left/bottom-left of the panel), and
          the same smooth-center scroll as the Schedule tab's "Now" button.
          Same full-width exception as the arrow above. */}
      {open && offDirection && widthMode !== "full" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (wasDraggingRef.current) return;
            scrollToCard();
          }}
          aria-label={
            offDirection === "above"
              ? "Active card is above — scroll to it"
              : "Active card is below — scroll to it"
          }
          title="Scroll to active card"
          className={cn(
            "absolute left-3 z-10 grid place-items-center size-7 rounded-full border-2 border-blue-400/80 bg-background text-blue-600 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)] hover:bg-blue-50 transition-colors active:scale-95",
            offDirection === "below" && "bottom-3",
          )}
          // "above" sits just below the sticky header instead of a flat
          // top-3 — that used to land right on top of the title/nav/close
          // row (all live in the first toolbarHeight-tall band), blocking
          // them instead of just pointing the way back to the card.
          style={offDirection === "above" ? { top: toolbarHeight + 12 } : undefined}
        >
          {offDirection === "above" ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      )}

      <motion.div
        className={cn(
          // overflow-hidden clips the sticky header's own square corner
          // (its bg-background rectangle otherwise pokes past the outer
          // panel's rounded arc, showing as a small square notch beyond the
          // curve) to match the outer panel's own rounding below — scoped
          // to this inner wrapper rather than the outer panel itself, since
          // the outer panel also hosts the arrow pointer and off-screen
          // indicator, both deliberately positioned outside its own box via
          // a negative left offset; overflow-hidden there would clip those
          // instead of just the header's corner.
          "flex h-full flex-col overflow-hidden",
          open && widthMode !== "full" && "rounded-tl-lg",
        )}
        style={{ width: contentWidth }}
      >
        {/* Sticky header — stays put while the content below scrolls under
            it. bg-background keeps scrolled content from showing through;
            the border gives scrolled content a clear edge to disappear
            behind instead of just clipping invisibly. Close now lives here
            too (rather than floating absolutely over the body) so it, the
            arrows, and the title's own top line all sit in one flex row and
            align naturally instead of needing separately-matched offsets. */}
        <div
          className="shrink-0 border-b border-border/70 bg-background py-1.5 px-4"
          style={{ minHeight: toolbarRowHeight }}
        >
          {/* items-start (not items-center) — a multi-line title grows this
              row taller than the icons' own size-7, and centering would
              slide every icon down to stay centered in that taller row
              instead of holding still. Pinning to the top keeps them at
              the same spot regardless of how many lines the title wraps
              to, matching where they already sit in the common single-line
              case. */}
          <div className="flex items-start gap-1">
            {/* Expand/collapse — replaces the pull tab's own bidirectional
                chevron now that the tab itself only shows while closed (see
                its own comment above). Toggles between the two open widths
                directly; a full close still goes through the dedicated X
                below rather than this icon doubling up on both jobs.
                Styled like the X (plain icon, no pill chrome) rather than
                like prev/next's bordered circles — it's a panel-level
                control, not another step through the card list. Pulled in
                further than the X's own -mr-1 (-ml-4, not -ml-1) so its own
                icon sits about as close to this corner as the collapsed
                pull tab's chevron sits to its corner, rather than noticeably
                deeper inside the header's padding than that tab was. */}
            {open && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (wasDraggingRef.current) return;
                  setWidthMode(widthMode === "full" ? "normal" : "full");
                }}
                aria-label={
                  widthMode === "full" ? "Collapse drawer to normal width" : "Expand drawer to full width"
                }
                aria-expanded={widthMode === "full"}
                className="-ml-4 grid shrink-0 place-items-center size-7 text-muted-foreground transition-colors hover:text-foreground"
              >
                <DoubleChevronIcon className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (wasDraggingRef.current) return;
                triggerPrev();
              }}
              disabled={!onPrevCard || exitDir !== null}
              aria-label="Previous card"
              className="grid shrink-0 place-items-center size-7 rounded-full border border-border text-blue-500 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
            </button>
            <DrawerTitle
              title={title}
              slideFrom={slideFrom}
              exitDir={exitDir}
              onClick={onTitleClick}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (wasDraggingRef.current) return;
                triggerNext();
              }}
              disabled={!onNextCard || exitDir !== null}
              aria-label="Next card"
              className="grid shrink-0 place-items-center size-7 rounded-full border border-border text-blue-500 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="size-4" />
            </button>
            {/* No circular button background here (unlike the prev/next
                arrows) — this is the drawer's own close action, not another
                step through the card list, so it reads as a plain icon
                control rather than matching their pill-button chrome. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (wasDraggingRef.current) return;
                closeDrawer();
              }}
              aria-label="Close"
              className="-mr-1 grid shrink-0 place-items-center size-7 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <DrawerContent
          details={details}
          slideFrom={slideFrom}
          exitDir={exitDir}
          contentScrollRef={contentScrollRef}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
