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
    commit();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [selector]);

  return right;
}
