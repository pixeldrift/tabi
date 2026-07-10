import { useEffect, useRef, useState } from "react";

/** Height of the fixed `[data-status-bar]` header, kept in sync via ResizeObserver.
 *  Debounced rather than committed on every callback — the header's own CSS
 *  height transition (session start/end collapsing/expanding it) fires this
 *  on nearly every animation frame, and feeding each intermediate height
 *  straight into React state races against the panel below's own
 *  `layout="position"` FLIP tracking, producing a flurry of tiny competing
 *  repositions (tabs/panel visibly detaching and popping back) instead of
 *  one clean move driven by the header's own native reflow. Waiting for the
 *  callbacks to settle before committing means only the real, final height
 *  change reaches React. */
export function useStickyTop() {
  const [stickyTop, setStickyTop] = useState(0);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const bar = document.querySelector("[data-status-bar]") as HTMLElement | null;
    if (!bar) return;
    const commit = () => setStickyTop(bar.getBoundingClientRect().height);
    const update = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(commit, 60);
    };
    commit();
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return stickyTop;
}
