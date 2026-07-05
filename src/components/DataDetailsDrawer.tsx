import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { DrawerHandleIcon } from "./icons/ToolbarIcons";
import { cn } from "@/lib/utils";

export interface DataDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  details?: ReactNode;
  /** Viewport-relative pixel offset where the Data pane begins (below the
   *  sticky toolbar) — the drawer is bounded to below this, not the full
   *  viewport, since it only applies within that one pane. */
  top: number;
  /** The card this drawer's contents describe — its on-screen position
   *  drives the arrow pointing back at it. */
  cardRef: RefObject<HTMLElement | null>;
}

/** A single shared, non-modal details panel — mounted only by whichever card
 *  is currently active (see CardShell) — rendered via portal so its `fixed`
 *  positioning isn't trapped by a transformed ancestor (Reorder.Item/motion
 *  layout tracking elsewhere in the card list). The pull tab and arrow are
 *  children of the same animated element, so they slide and reposition
 *  together with the panel instead of living separately in the toolbar. */
export function DataDetailsDrawer({ open, onOpenChange, title, description, details, top, cardRef }: DataDetailsDrawerProps) {
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

  const maxArrowTop = Math.max(24, window.innerHeight - top - 24);
  const clampedArrowTop = Math.min(Math.max(arrowTop, 24), maxArrowTop);

  return createPortal(
    <motion.div
      className="fixed right-0 z-40 w-[88%] sm:max-w-md bg-background border-l border-stone-200/70 shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.25)]"
      style={{ top, bottom: 0 }}
      initial={false}
      animate={{ x: open ? 0 : "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      aria-hidden={!open}
    >
      {/* Pull tab — attached to the panel's own left edge (a child of the
          same animated element) so it rides along with the slide instead of
          staying fixed in the toolbar while the panel moves out from under
          it. Mirrors the per-card details button, but in reverse: pressing
          it again pulls the drawer back off screen. */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close details drawer" : "Open details drawer"}
        aria-expanded={open}
        className="btn-bevel absolute -left-7 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-7 rounded-l-lg border border-r-0 border-blue-500 bg-blue-500 text-white"
      >
        <DrawerHandleIcon className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Arrow — points at the card this drawer's contents belong to. */}
      <div
        className="absolute -left-[7px] size-3 -translate-y-1/2 rotate-45 border-l-2 border-b-2 border-blue-400/80 bg-background shadow-[-2px_2px_3px_-1px_rgba(0,0,0,0.15)]"
        style={{ top: clampedArrowTop }}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        aria-label="Close"
        className="absolute right-3 top-3 grid place-items-center size-7 rounded-full text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="h-full overflow-y-auto p-6">
        <h2 className="font-display text-lg pr-8">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        {details && <div className="mt-6 text-sm">{details}</div>}
      </div>
    </motion.div>,
    document.body,
  );
}
