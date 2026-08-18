import { useEffect, useState, type RefObject } from "react";

/**
 * Horizontal pixel offset (from the popover content's own left edge) at
 * which a pointer arrow should sit so it keeps pointing at the anchor
 * element's center — even after Radix's collision-avoidance has shifted the
 * content sideways to stay on screen, which decouples the content's visual
 * center from the anchor's. Same technique DataToolbar's filter popover
 * already used for its own (forcibly re-centered) arrow, generalized here
 * for any popover that just needs to track wherever Radix actually placed it.
 * Returns null until the first post-mount measurement lands.
 */
export function useSlidingArrowOffset(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  margin = 16,
) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      const content = contentRef.current;
      if (!anchor || !content) return;
      const anchorRect = anchor.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const raw = anchorRect.left + anchorRect.width / 2 - contentRect.left;
      setLeft(Math.min(Math.max(raw, margin), contentRect.width - margin));
    };
    // Radix's own mount animation (zoom-in-95 + slide-in-from-*, see
    // PopoverContent) visually scales/slides the content into place via a
    // CSS transform over its own ~150ms — getBoundingClientRect() reports
    // that still-animating, not-yet-final box, so measuring on every early
    // frame (the previous approach) chases a moving target and visibly
    // drags the arrow sideways along with it as the box grows. Left at its
    // plain CSS `50%` fallback for that stretch instead, the arrow already
    // tracks the animating box correctly on its own (a CSS percentage is
    // relative to the box's own current rendered width, transform and all)
    // — so the only real work is a single authoritative measurement once
    // the animation has actually settled, not a poll through it.
    const content = contentRef.current;
    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      update();
    };
    content?.addEventListener("animationend", finalize, { once: true });
    // Safety net for when the animation is skipped entirely (e.g.
    // prefers-reduced-motion), so animationend never fires.
    const timeoutId = window.setTimeout(finalize, 200);
    window.addEventListener("resize", update);
    // See useStickyTop's own comment: iOS Safari's address bar collapsing/
    // expanding resizes the visual viewport without reliably firing
    // `window`'s own `resize` — visualViewport's events are the reliable
    // signal there, same fix as useKeyboardInset already applies for the
    // on-screen-keyboard case.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      content?.removeEventListener("animationend", finalize);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open, anchorRef, contentRef, margin]);

  return left;
}
