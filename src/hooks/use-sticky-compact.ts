import { useEffect, useState, type RefObject } from "react";

/** Whether a sticky-positioned bar has actually pinned in place — tracked
 *  via direct geometry checks tied to the scroll container's own scroll/
 *  resize, rather than IntersectionObserver: IO callbacks are batched and
 *  can fire a frame or more after the browser's own `position: sticky`
 *  snap, which visibly lags any compact-mode crossfade tied to it.
 *
 *  `sentinelRef` is a zero-height marker placed immediately before the
 *  sticky bar in the DOM — once its top edge scrolls up past the scroll
 *  container's own top edge (the bar's `top-0` resolves against that same
 *  edge), the bar is pinned. Shared by Schedule's own toggles row and the
 *  Notifications filter bar, which both compact their labels down to icons
 *  only once stuck. `containerRef` is the app-shell's internally-scrolling
 *  content pane — a plain `div`/`section`, so it doesn't fire a native
 *  `resize` event the way `window` does, hence the ResizeObserver here
 *  instead. */
export function useStickyCompact(
  sentinelRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      setCompact(el.getBoundingClientRect().top <= container.getBoundingClientRect().top);
    };
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    check();
    container.addEventListener("scroll", onScrollOrResize, { passive: true });
    const ro = new ResizeObserver(onScrollOrResize);
    ro.observe(container);
    return () => {
      container.removeEventListener("scroll", onScrollOrResize);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sentinelRef, containerRef]);

  return compact;
}
