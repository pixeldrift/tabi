import { useEffect, useState } from "react";

/** Height of the fixed `[data-status-bar]` header, kept in sync via
 *  ResizeObserver — committed on every callback, not debounced. Every
 *  remaining consumer (NotificationsPane's and ScheduleView's own sticky
 *  filter/toggle bars, via their plain `style={{ top: stickyTop }}`) just
 *  wants this to track the header's real height in real time, the same way
 *  `position: sticky` itself already tracks scroll for free — debouncing it
 *  meant those bars sat at their PRE-transition `top` for the entire session
 *  start/pause/resume height change, then snapped to the new value in one
 *  jump once the debounce settled well after the header had already
 *  finished moving, reading as the bar floating loose from the header
 *  instead of sliding with it. (An earlier version of this hook debounced
 *  to protect a `layout="position"` FLIP consumer — the Data tab's own
 *  toolbar — from fighting frame-by-frame state churn; that toolbar has
 *  since moved inside the header's own single shared sticky container,
 *  see StatusBar, and no longer reads this hook at all.) */
export function useStickyTop() {
  // Deliberately NOT a lazy-measured initializer (unlike useElementHeight/
  // useElementRight). This hook is called once, at the top of the whole
  // page (routes/index.tsx), so — unlike those two, which back a component
  // that remounts repeatedly client-side (DataDetailsDrawer, once per
  // card) — it's always part of the very first SSR/hydration pass, every
  // single page load, with no later "pure CSR remount" case to speed up.
  // The server can't measure a real pixel height, so it renders `0`; if
  // this eagerly measured the real value instead, the client's very first
  // hydration-matching render would produce a DIFFERENT `top` than the
  // server did — a hydration mismatch React logs and does NOT patch up on
  // its own, leaving the toolbar visibly stuck at the wrong `top` until
  // some unrelated re-render happens to correct it. Starting at `0` here
  // (matching the server) and correcting via the effect below is safe by
  // default: a plain `style={{ top }}` write on a `position: sticky` element
  // just repositions it, with nothing watching this value to animate the
  // correction as a false move.
  const [stickyTop, setStickyTop] = useState(0);

  useEffect(() => {
    const bar = document.querySelector("[data-status-bar]") as HTMLElement | null;
    if (!bar) return;
    const commit = () => setStickyTop(bar.getBoundingClientRect().height);
    commit();
    const ro = new ResizeObserver(commit);
    ro.observe(bar);
    window.addEventListener("resize", commit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", commit);
    };
  }, []);

  return stickyTop;
}
