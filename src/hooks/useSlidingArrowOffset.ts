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
    // Radix positions the content across its own layout effects, so wait a
    // frame before measuring, same as DataToolbar's own filter popover.
    // A single frame isn't always enough, though — floating-ui sometimes
    // needs an extra pass to settle (e.g. an initial estimate followed by
    // a collision-driven correction near a screen edge), and measuring
    // between those two passes catches a transient position instead of the
    // final one. Re-measuring for a few more frames converges on whatever
    // Radix actually settles at, cheaply and boundedly.
    let frame = 0;
    let raf = requestAnimationFrame(function tick() {
      update();
      frame += 1;
      if (frame < 5) raf = requestAnimationFrame(tick);
    });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, contentRef, margin]);

  return left;
}
