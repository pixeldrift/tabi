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
import { motion } from "motion/react";
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { renderBreakableTitle } from "./BreakableTitle";
import { useElementHeight } from "@/hooks/use-element-height";
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
      className="font-display text-base leading-[1.15] flex-1 min-w-0 break-words cursor-pointer select-none text-center"
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
    <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
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
  /** Overrides the panel's own width classes — the sm+ half of the default
   *  pairs with card mode's own drawerOpen compression (see IndexInner),
   *  which collapses to a single ~55%-wide column so this can sit alongside
   *  it rather than covering it; the "+14px" past an even half covers a
   *  card's own top-right info button the same way the list row's does.
   *  Below sm, card content stays full-width instead (too dense to compress
   *  at phone widths without truncating), so this just overlays on top
   *  there rather than sitting side-by-side. Ignored once `hugCardRight`
   *  computes a real width — this only matters as its fallback until then. */
  widthClassName?: string;
  /** Instead of a fixed widthClassName, size the panel to exactly reach
   *  `cardRef`'s own right edge — for the quick-action grids, where each
   *  tile's own width is a card-count-dependent, non-round fraction of the
   *  pane (a plain half-viewport-ish widthClassName would either fall short
   *  of the tile's edge or overshoot past it, rather than the two meeting
   *  exactly). Measured the same way `arrowTop` already is, from the same
   *  card rect. Unlike widthClassName's own fallback, this doesn't add any
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
  widthClassName = "w-[88%] sm:w-[calc(50%+14px)]",
  hugCardRight = false,
  hugGapPx = DRAWER_TILE_GAP_PX,
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
  const [hugWidth, setHugWidth] = useState<number | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Set once the card has scrolled fully out of the visible pane (not just
  // clamped near an edge — clampedArrowTop below already handles "close to
  // the edge" by sliding the diamond to it). While this is set, the arrow —
  // which would otherwise have to point off the top/bottom of the panel —
  // is replaced by a button indicating which way to scroll to bring the
  // card back into view.
  const [offDirection, setOffDirection] = useState<"above" | "below" | null>(null);
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
      // A small positive gap (unlike Card/List's widthClassName fallback,
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
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

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
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
        "fixed right-0 z-[62] bg-background shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.25)]",
        // Matches the active card's own border while open — same blue,
        // same 2px weight — so the drawer visibly reads as "this card,
        // pulled out," not a generic unrelated panel.
        open ? "border-2 border-blue-400/80" : "border border-border/70",
        // widthClassName is only a fallback here — a real hugWidth (once
        // measured) wins via the inline style below regardless of which
        // class is present, so there's no conflict in leaving both applied.
        widthClassName,
      )}
      style={{ top, bottom: 0, ...(hugCardRight && hugWidth !== null ? { width: hugWidth } : {}) }}
      initial={false}
      animate={{ x: open ? 0 : "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
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
          inside of that border, not the outside). */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label={open ? "Close details drawer" : "Open details drawer"}
        aria-expanded={open}
        className={cn(
          "absolute -left-7 -top-0.5 w-7 grid place-items-center rounded-l-lg bg-background text-stone-500 hover:text-stone-800 transition-colors",
          open ? "border-2 border-blue-400/80" : "border border-border/70",
          "border-r-0",
        )}
        style={{ height: toolbarRowHeight }}
      >
        {/* Base orientation points right; always faces the direction the
            drawer will slide if pressed again — left (toward opening) while
            closed, right (toward closing) while open — and animates between
            the two as the drawer itself slides. */}
        <TimeChevronIcon
          className={cn("size-3.5 transition-transform duration-300", !open && "rotate-180")}
        />
      </button>

      {/* Arrow — points at the card this drawer's contents belong to. Only
          rendered while open: when the panel slides off-screen its fixed
          -9px offset from the (now off-screen) left edge would otherwise
          leave it sitting as a stray diamond near the viewport's right
          edge instead of leaving with the rest of the panel. Swapped out
          entirely once the card has scrolled fully out of the visible pane
          — pointing at a card that isn't there to point at reads as broken,
          not just imprecise, so a direction button takes its place instead
          (see offDirection above). */}
      {open && !offDirection && (
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
          the same smooth-center scroll as the Schedule tab's "Now" button. */}
      {open && offDirection && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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

      <div className="flex h-full flex-col">
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
                onOpenChange(false);
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
      </div>
    </motion.div>,
    document.body,
  );
}
