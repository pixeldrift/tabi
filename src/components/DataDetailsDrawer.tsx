import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { cn } from "@/lib/utils";

export interface DataDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  details?: ReactNode;
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
   *  pairs with card/grid mode's own drawerOpen compression (see IndexInner),
   *  which collapses to a single ~55%-wide column so this can sit alongside
   *  it rather than covering it; the "+14px" past an even half covers a
   *  card's own top-right info button the same way the list row's does.
   *  Below sm, card/grid content stays full-width instead (too dense to
   *  compress at phone widths without truncating), so this just overlays
   *  on top there rather than sitting side-by-side. */
  widthClassName?: string;
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
  top,
  toolbarHeight,
  cardRef,
  widthClassName = "w-[88%] sm:w-[calc(50%+14px)]",
}: DataDetailsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [arrowTop, setArrowTop] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setArrowTop(rect.top + rect.height / 2 - top);
    };
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
  }, [open, top, cardRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

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
        open ? "border-2 border-blue-400/80" : "border border-stone-200/70",
        widthClassName,
      )}
      style={{ top, bottom: 0 }}
      initial={false}
      animate={{ x: open ? 0 : "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      aria-hidden={!open}
    >
      {/* Pull tab — attached to the panel's own left edge (a child of the
          same animated element) so it rides along with the slide instead of
          staying fixed in the toolbar while the panel moves out from under
          it. Sized to the toolbar's own primary row (its py-1.5/size-7
          bounds: 6px + 28px + 6px = 40px = h-10), not `toolbarHeight` —
          that also includes the "Start session" banner's variable height
          below the row, which isn't part of "the filter bar" this tab
          should span. No border on the right so it blends seamlessly into
          the drawer — `border-r-0` has to come after the border-color/width
          utilities below (not just after `border-r-0` in this string) or
          `cn`'s tailwind-merge treats `border-2`/`border` as the later,
          winning declaration for every side, right included. -top-0.5
          shifts it up by the panel's own 2px border width, so the tab's
          outer top edge lines up with the panel's outer top edge instead of
          sitting a couple pixels below it (top-0 aligns with the inside of
          that border, not the outside). */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close details drawer" : "Open details drawer"}
        aria-expanded={open}
        className={cn(
          "absolute -left-7 -top-0.5 h-10 w-7 grid place-items-center rounded-l-lg bg-background text-stone-500 hover:text-stone-800 transition-colors",
          open ? "border-2 border-blue-400/80" : "border border-stone-200/70",
          "border-r-0",
        )}
      >
        {/* Base orientation points right; always faces the direction the
            drawer will slide if pressed again — left (toward opening) while
            closed, right (toward closing) while open — and animates between
            the two as the drawer itself slides. */}
        <TimeChevronIcon className={cn("size-3.5 transition-transform duration-300", !open && "rotate-180")} />
      </button>

      {/* Arrow — points at the card this drawer's contents belong to. Only
          rendered while open: when the panel slides off-screen its fixed
          -9px offset from the (now off-screen) left edge would otherwise
          leave it sitting as a stray diamond near the viewport's right
          edge instead of leaving with the rest of the panel. */}
      {open && (
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

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        aria-label="Close"
        className="absolute right-3 top-3 grid place-items-center size-7 rounded-full text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="h-full overflow-y-auto p-6">
        <h2 className="font-display text-lg leading-[1.05] pr-8">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        {details && <div className="mt-6 text-sm">{details}</div>}
      </div>
    </motion.div>,
    document.body,
  );
}
