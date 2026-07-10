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
  const [height, setHeight] = useState(0);
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
