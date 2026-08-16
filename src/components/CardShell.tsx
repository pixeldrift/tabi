import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { DetailsIcon } from "./icons/DetailsIcon";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { CardEditControls, type CardEditControlsProps } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import type { TeachingProcedure } from "./TeachingProcedureAccordion";
import { renderBreakableTitle } from "./BreakableTitle";
import { PhaseInfoLabel, DataTypeInfoLabel } from "./KindInfoLabels";
import type { CardKind } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

/** Shared by every card kind so the toolbar's edit mode (reorder/favorite/
 *  hide) and the shared details drawer only need declaring once. */
export interface CardEditAndDrawerProps {
  /** True while the toolbar's pencil/edit mode is on — swaps the header's
   *  phase/data-type label and details button for drag/favorite/hide. */
  reorderEditing?: boolean;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  cardHidden?: boolean;
  onToggleHidden?: () => void;
  dragControls?: CardEditControlsProps["dragControls"];
  /** Controls the shared details drawer from outside — clicking the card's
   *  own details button (or the toolbar drawer tab) both funnel through
   *  this rather than each card owning an independent drawer instance. */
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  /** Activates this card AND opens the shared drawer — used by the card's
   *  own details button so clicking it on a non-active card both selects
   *  it and reveals its info. */
  onOpenDetails?: () => void;
  /** Viewport-relative pixel offset where the sticky toolbar begins — the
   *  drawer now starts here (not below the toolbar) so it slides out on
   *  top of it, passed through to the shared drawer. */
  stickyTop?: number;
  /** Set for the two quick-action grid modes — swaps this card's own
   *  full-size markup for a compact aspect-square tile rendering the same
   *  underlying state (see MiniTileShell), rather than mounting a separate
   *  component, which would lose that state on every mode switch. */
  tileDensity?: "large" | "small";
  /** Set for the list display mode — same reasoning as tileDensity: swaps
   *  this card's own markup for a DataListRow rendering the same
   *  underlying state, with this kind's own compact floating actions. */
  listMode?: boolean;
  /** Goal/rationale/procedure reference shown as a twirldown accordion in
   *  this card's own details drawer — optional since not every mock card
   *  has one filled in yet. */
  teachingProcedure?: TeachingProcedure;
  /** Skip to the previous/next card in display order, forwarded straight
   *  through to the shared drawer — see DataDetailsDrawer's own props for
   *  the full explanation. */
  onPrevCard?: () => void;
  onNextCard?: () => void;
  slideFrom?: "left" | "right" | null;
  /** Which of the drawer's two open widths is currently showing — lifted up
   *  here (rather than left as the drawer's own local state) so it survives
   *  a prev/next card switch. Each card mounts a fresh DataDetailsDrawer
   *  instance when it becomes active (see the `{isActive && ...}` gating in
   *  this file/DataListRow/MiniTileShell), which would otherwise reset a
   *  locally-owned width back to "normal" on every navigation — jarring
   *  when the user deliberately dragged to full width and just wants to
   *  page through cards at that size. */
  widthMode?: "normal" | "full";
  onWidthModeChange?: (mode: "normal" | "full") => void;
}

export interface CardShellProps extends CardEditAndDrawerProps {
  title: string;
  /** Which data-type info modal to open for this card's own dataType
   *  label/icon — see DataTypeInfoLabel. */
  kind: CardKind;
  phase?: string;
  dataType?: string;
  /** Small outline icon shown to the left of the dataType label. */
  dataTypeIcon?: ReactNode;
  isActive?: boolean;
  onActivate?: () => void;
  /** 0–100 progress. Pass null/undefined to hide the progress bar entirely. */
  progress?: number | null;
  isComplete?: boolean;
  helperText?: ReactNode;
  details?: ReactNode;
  editing?: boolean;
  /**
   * When both are provided, a twirl-down caret appears before the title
   * (same resting-right / rotate-on-open chevron as the Select dropdowns).
   * `children` is the standard view; `expandedView` swaps in when expanded,
   * with the standard view's height collapsing away entirely rather than
   * the two stacking.
   */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  expandedView?: ReactNode;
  children: ReactNode;
}

const EXPAND_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

/** The twirl-down's actual mechanic, kept deliberately plain: one
 *  container, pinned right under the header's divider, holding whichever
 *  of children/expandedView is current — swapped instantly, no crossfade
 *  of its own — with only the CONTAINER's own height animated and
 *  overflow clipped to it. A standard rolldown: the box's top edge never
 *  moves, its bottom edge eases open or shut, and whatever's inside is
 *  revealed or hidden by that boundary alone. Earlier attempts layered a
 *  crossfade (and briefly a translateY) on top of this same height
 *  animation to make the content itself feel like it was "entering" —
 *  that fought the clip instead of matching it, at best adding visible
 *  double-exposure ghosting and at worst (the translateY) shifting which
 *  slice of the content the clip window landed on, reading as the reveal
 *  opening from the middle instead of the top. */
function ExpandableArea({
  expanded,
  children,
  expandedView,
}: {
  expanded: boolean;
  children: ReactNode;
  expandedView: ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const isFirstMeasure = useRef(true);

  // Re-measures on every render where `expanded` flips AND on any later
  // resize of whichever side is currently mounted (scoring a step can grow
  // a row within the expanded list, for instance) — the observer isn't
  // torn down until `expanded` changes again, so it keeps tracking those
  // too, not just the initial swap. Content swaps synchronously with
  // `expanded` (same commit, no AnimatePresence), so the very first paint
  // of a toggle still shows the OLD `height` value as the target — genuinely
  // unchanged from what's already on screen, since nothing about the
  // container itself has moved yet — giving Motion a real, already-painted
  // number to ease FROM once this effect's remeasurement lands the new one.
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const commit = () => setHeight(el.scrollHeight);
    commit();
    const ro = new ResizeObserver(commit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  useEffect(() => {
    isFirstMeasure.current = false;
  }, []);

  return (
    <motion.div
      className="overflow-hidden"
      animate={{ height: height ?? "auto" }}
      // No prior state to visually transition from on first mount — skip
      // straight to the real height instead of animating up from nothing.
      transition={isFirstMeasure.current ? { duration: 0 } : EXPAND_TRANSITION}
    >
      <div ref={measureRef}>{expanded ? expandedView : children}</div>
    </motion.div>
  );
}

export function CardShell({
  title,
  kind,
  phase = "Intervention",
  dataType,
  dataTypeIcon,
  isActive = true,
  onActivate,
  reorderEditing = false,
  favorited = false,
  onToggleFavorite,
  cardHidden = false,
  onToggleHidden,
  dragControls,
  detailsOpen = false,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop = 0,
  progress,
  isComplete = false,
  helperText,
  details,
  editing = false,
  expanded = false,
  onToggleExpanded,
  expandedView,
  children,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: CardShellProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const hasExpandedView = Boolean(onToggleExpanded && expandedView);
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;
  const barBg = isComplete ? "bg-green-500/30" : pct >= 50 ? "bg-yellow-400/30" : "bg-blue-400/30";

  return (
    <article
      ref={articleRef}
      onClick={onActivate}
      className={cn(
        // Border is ALWAYS 1px — the selected look comes from an inset ring
        // (a box-shadow, not real border width) layered on top instead of an
        // actual border-2. A real width change there would shrink the
        // content box by the extra pixel on every side (border participates
        // in box-sizing; a fixed padding doesn't compensate), visibly
        // nudging every child inward the instant a card became active. A
        // ring paints without consuming layout space, so nothing inside
        // ever shifts. overflow-hidden also moved off this element (see the
        // inner clip wrapper below) — box-shadow is part of an element's own
        // paint, not its overflow, but keeping it on the SAME node as
        // overflow-hidden is what let the shadow visibly clip into a
        // squared-off corner instead of fading past the rounded edge.
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        isActive
          ? cn(
              // will-change-transform: pins this card to its own stable GPU
              // compositing layer instead of one the browser opportunistically
              // creates and tears down. Without it, on real mobile hardware
              // (confirmed on both iOS Safari and Android Chrome — not an
              // engine-specific bug) an active card sitting at the bottom of
              // a scrollable pane periodically has its shadow clip and
              // unclip like a blinker, roughly once a second, ONLY while a
              // session is running — i.e. only while something nearby (the
              // running session's own tick) keeps re-triggering this card's
              // ancestor `layout="position"` projection (see DataCardList).
              // Every one of those ticks is a repaint of this subtree, and a
              // repaint's invalidation rect can be computed from this
              // element's own layout box rather than its full paint bounds —
              // box-shadow bleeds ~36px past the box, so a box-only rect
              // silently drops it for that one frame. A dedicated layer is
              // rasterized (shadow included) once and then just recomposited
              // on subsequent ticks, so it never gets re-clipped. Scoped to
              // isActive only — only the active card ever has this bleeding
              // shadow at all, so promoting the other ~20 cards would just be
              // wasted GPU memory.
              "will-change-transform",
              editing
                ? "border border-border shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
                : "border border-blue-400/80 ring-2 ring-inset ring-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]",
            )
          : "border border-border opacity-80 hover:opacity-95",
      )}
    >
      {/* Clips inner content (mainly the progress bar's own square corners,
          see historical #18 fix) to the card's rounded shape — kept on a
          separate node from the border/shadow above, see that comment. */}
      <div className="relative rounded-xl overflow-hidden">
        <header
          className={cn("flex items-start gap-1 pl-5 pt-2 pb-0", reorderEditing ? "pr-3" : "pr-9")}
        >
          {hasExpandedView && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded?.();
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Show standard view" : "Show all"}
              data-tour="twirldown"
              className="-ml-1.5 mt-[-0.5px] shrink-0 grid place-items-center rounded-md p-0.5 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
            >
              <TimeChevronIcon
                className={cn(
                  "size-4 transition-transform duration-200",
                  expanded && "translate-y-0.5 rotate-90",
                )}
              />
            </button>
          )}
          <h2 className="font-display text-base leading-[1.05] flex-1 min-w-0 break-words mr-auto mt-0.5">
            {renderBreakableTitle(title)}
          </h2>
          {reorderEditing ? (
            <CardEditControls
              favorited={favorited}
              onToggleFavorite={onToggleFavorite ?? (() => {})}
              cardHidden={cardHidden}
              onToggleHidden={onToggleHidden ?? (() => {})}
              dragControls={dragControls}
            />
          ) : (
            <div className="text-right leading-tight -mt-0.5">
              <PhaseInfoLabel
                phase={phase}
                className="flex items-center justify-end gap-1 text-xs font-medium italic text-muted-foreground hover:text-blue-600 transition-colors"
              />
              {dataType && (
                <DataTypeInfoLabel
                  kind={kind}
                  label={dataType}
                  icon={dataTypeIcon}
                  className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground hover:text-blue-600 transition-colors"
                />
              )}
            </div>
          )}
        </header>

        {/* Universal header/body divider — present in every card and both
          the standard and expanded views, not just faded in while expanded. */}
        <div className="mx-[18px] mt-2.5 border-t border-dashed border-border" />

        {/* Positioned so the circle's center sits at the card's own corner-radius
          center (rounded-xl = 20px), rather than in the header's flex flow.
          Hidden in edit mode along with the phase/data-type label — no need
          to jump into a card's info while busy reordering/hiding cards. */}
        {!reorderEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails?.();
            }}
            aria-label="Card details"
            className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-current text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <DetailsIcon className="size-4" strokeWidth={1.5} />
          </button>
        )}

        {isActive && (
          <DataDetailsDrawer
            open={detailsOpen}
            onOpenChange={onDetailsOpenChange ?? (() => {})}
            title={title}
            details={details}
            onPrevCard={onPrevCard}
            onNextCard={onNextCard}
            slideFrom={slideFrom}
            top={stickyTop}
            cardRef={articleRef}
            widthMode={widthMode}
            onWidthModeChange={onWidthModeChange}
          />
        )}

        {hasExpandedView ? (
          <ExpandableArea expanded={expanded} expandedView={expandedView}>
            {children}
          </ExpandableArea>
        ) : (
          children
        )}

        {/* mx-4 mb-3: this used to run edge-to-edge, its own rounded corners
          tucked flush against the card's — which read as the bar merging
          into the border frame rather than sitting inside it, especially
          once a selected card's blue ring made that border more prominent.
          Insetting it (with its own now-visible rounded-md corners) keeps a
          clear margin of card background all the way around, so it reads as
          content living inside the border instead of touching it. */}
        {showProgress && (
          <div className="relative mt-3 mx-4 mb-3">
            <div className="relative h-5 rounded-md overflow-hidden">
              <div className="absolute inset-0 bg-stone-200">
                <motion.div
                  className={cn("absolute inset-y-0 left-0", barBg)}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 180, damping: 26 }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center px-3 text-[11px] text-foreground/75 leading-none pointer-events-none">
                {helperText}
              </div>
            </div>
            {isComplete && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <Starburst />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Starburst() {
  const rays = Array.from({ length: 8 });
  return (
    <span className="absolute inset-0 pointer-events-none">
      {rays.map((_, i) => {
        const angle = (i / rays.length) * Math.PI * 2;
        const x = Math.cos(angle) * 22;
        const y = Math.sin(angle) * 22;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -ml-1 -mt-1 size-2 rounded-full bg-yellow-300"
          />
        );
      })}
      <motion.span
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.7 }}
        className="absolute inset-0 grid place-items-center text-yellow-400"
      >
        <Sparkles className="size-6" />
      </motion.span>
    </span>
  );
}
