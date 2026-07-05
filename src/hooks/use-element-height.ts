import { useEffect, useState } from "react";

/** Rendered height of the first element matching `selector`, kept in sync
 *  via ResizeObserver — used to bound the data details drawer to below a
 *  sticky header instead of the full viewport. Height (not the element's
 *  own absolute position) is what's tracked, since a sticky element's own
 *  top offset can shift for reasons unrelated to its size (e.g. the status
 *  bar above it changing height) that a ResizeObserver on this element
 *  alone wouldn't catch — callers combine this with whatever positions the
 *  element (e.g. useStickyTop) to get an always-fresh absolute offset. */
export function useElementHeight(selector: string) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selector]);

  return height;
}
