import { useEffect, useRef, useState } from "react";

/** Rendered height of the first element matching `selector`, kept in sync
 *  via ResizeObserver — used to bound the data details drawer to below a
 *  sticky header instead of the full viewport. Height (not the element's
 *  own absolute position) is what's tracked, since a sticky element's own
 *  top offset can shift for reasons unrelated to its size (e.g. the status
 *  bar above it changing height) that a ResizeObserver on this element
 *  alone wouldn't catch — callers combine this with whatever positions the
 *  element (e.g. useStickyTop) to get an always-fresh absolute offset.
 *  Debounced the same way useStickyTop is — this element's own content can
 *  be mid-CSS-transition too (e.g. the toolbar's "Start session" banner
 *  collapsing at session start), and committing every intermediate frame
 *  into React state fights the panel's own `layout="position"` FLIP
 *  tracking instead of letting the transition's native reflow do the work. */
export function useElementHeight(selector: string) {
  // Lazily measured up front, not just `0` corrected a frame later — a
  // caller can read this value into a Motion `useMotionValue`'s own
  // one-time initializer (see DataDetailsDrawer's `x`), which never re-reads
  // it once mounted. Starting this at `0` would bake that wrong height in
  // permanently, only reachable afterward through an actual spring
  // animation — visibly playing out as a brief, unwanted size change right
  // after mount (e.g. every prev/next card switch, since that remounts the
  // drawer fresh) instead of just being correct from the first frame.
  const [height, setHeight] = useState(() => {
    if (typeof document === "undefined") return 0;
    return document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
  });
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    const commit = () => setHeight(el.getBoundingClientRect().height);
    const update = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(commit, 60);
    };
    commit();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      ro.disconnect();
    };
  }, [selector]);

  return height;
}

/** Viewport-relative right edge (in px) of the first element matching
 *  `selector`, kept in sync via ResizeObserver + a resize listener — used to
 *  keep the data details drawer's normal-width left edge from covering the
 *  toolbar's view-mode icon cluster. Same debounced-commit shape as
 *  useElementHeight above, just tracking a different rect field. */
export function useElementRight(selector: string) {
  // Same reasoning as useElementHeight's own lazy initializer above — this
  // value feeds DataDetailsDrawer's maxRestingWidthPx clamp, which its `x`
  // motion value's one-time initializer reads. Starting at `0` here reads
  // as "not yet measured" (see maxRestingWidthPx's own comment) and leaves
  // the clamp uncapped for that first render — on a fresh prev/next remount,
  // that let the panel open wider than its real clamped resting width for
  // one frame, then visibly spring-shrink down once this effect's first
  // commit corrected it a moment later.
  const [right, setRight] = useState(() => {
    if (typeof document === "undefined") return 0;
    return document.querySelector(selector)?.getBoundingClientRect().right ?? 0;
  });
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    const commit = () => setRight(el.getBoundingClientRect().right);
    const update = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(commit, 60);
    };
    // ResizeObserver only fires when THIS element's own box size changes —
    // not when an ancestor's still-animating transform shifts its absolute
    // position without touching its own size. The welcome→main screen slide
    // (see routes/index.tsx's own SCREEN_SLIDE_MS) is exactly that: a
    // position:fixed motion.div translating the whole app in from the side,
    // for real, over several hundred ms. A tap on the very first interactive
    // thing (a details drawer's pull tab) can land while that's still mid-
    // flight, and this cluster's own measured right edge — a real number,
    // just skewed by the ancestor's current, not-yet-settled translateX —
    // gets baked in with nothing to ever re-trigger a correction afterward,
    // which zeroed out the drawer's own resting-width cap (see
    // maxRestingWidthPx) and made its very first open land at the same x as
    // closed, silently.
    //
    // Rather than guess a fixed poll duration to outlast that one specific
    // transition (fragile if its timing ever changes, or if some other
    // animation causes the same kind of skew), poll every frame until the
    // measurement itself actually stops moving — a few consecutive identical
    // readings means whatever was animating has settled — capped so a
    // genuinely unstable layout can't poll forever.
    let raf = 0;
    let settledStreak = 0;
    let lastRight: number | null = null;
    let framesElapsed = 0;
    const MAX_POLL_FRAMES = 120; // ~2s at 60fps — generous safety cap
    const SETTLED_STREAK_TARGET = 4;
    raf = requestAnimationFrame(function tick() {
      const rect = el.getBoundingClientRect();
      // A still-zero-area box means the element hasn't actually been laid
      // out yet (not "settled at 0") — repeated identical zero readings
      // would otherwise satisfy the streak check below and stop polling
      // right before its real first real layout lands.
      const hasRealBox = rect.width > 0 || rect.height > 0;
      setRight(rect.right);
      settledStreak = hasRealBox && rect.right === lastRight ? settledStreak + 1 : 0;
      lastRight = rect.right;
      framesElapsed += 1;
      if (settledStreak < SETTLED_STREAK_TARGET && framesElapsed < MAX_POLL_FRAMES) {
        raf = requestAnimationFrame(tick);
      }
    });
    const ro = new ResizeObserver(update);
    ro.observe(el);
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
      cancelAnimationFrame(raf);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      ro.disconnect();
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [selector]);

  return right;
}
