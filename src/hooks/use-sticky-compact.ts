import { useEffect, useState, type RefObject } from "react";

/** Whether a sticky-positioned bar has actually pinned in place — tracked
 *  via direct geometry checks tied to scroll/resize, rather than
 *  IntersectionObserver: IO callbacks are batched and can fire a frame or
 *  more after the browser's own `position: sticky` snap, which visibly lags
 *  any compact-mode crossfade tied to it.
 *
 *  `sentinelRef` is a zero-height marker placed immediately before the
 *  sticky bar in the DOM — once its top edge scrolls up past `stickyTop`
 *  (the sticky bar's own resolved `top`, from `useStickyTop`), the bar is
 *  pinned. Shared by Schedule's own toggles row and the Notifications
 *  filter bar, which both compact their labels down to icons only once
 *  stuck. */
export function useStickyCompact(sentinelRef: RefObject<HTMLElement | null>, stickyTop: number) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      setCompact(el.getBoundingClientRect().top <= stickyTop);
    };
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sentinelRef, stickyTop]);

  return compact;
}
