import { useEffect, useState } from "react";

/** Height of the `[data-status-bar]` header, kept in sync via ResizeObserver
 *  — committed on every callback, not debounced (debouncing meant a
 *  consumer sat at its PRE-transition value for the entire session start/
 *  pause/resume height change, then snapped to the new one in one jump well
 *  after the header had already finished moving).
 *
 *  Since the app-shell refactor (header is a plain `shrink-0` block above a
 *  separately-scrolling content pane, not a `position: sticky` element
 *  itself), this no longer backs any scroll-position math — NotificationBar
 *  and ScheduleView's own sticky filter/toggle bars pin with a trivial
 *  `top-0` now that they live inside that same bounded scroll container, and
 *  don't need this hook at all. The one remaining consumer (routes/index.tsx)
 *  uses it purely for real `position: fixed` viewport offsets: where
 *  DataDetailsDrawer's own slide-out should start (flush under the header,
 *  not the top of the viewport) and TrialCard/TaskAnalysisCard's topInset
 *  clamps. */
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
    // iOS Safari's address bar collapsing/expanding as the page scrolls
    // resizes the *visual* viewport without reliably firing `window`'s own
    // `resize` event — the same gap useKeyboardInset's own comment already
    // documents for the on-screen keyboard case. This hook's own header
    // ResizeObserver above catches most real changes, but not the case
    // where the header's height is unchanged and only the surrounding
    // viewport moved out from under it; visualViewport's own resize/scroll
    // events are the reliable signal for that on iOS.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", commit);
    vv?.addEventListener("scroll", commit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", commit);
      vv?.removeEventListener("resize", commit);
      vv?.removeEventListener("scroll", commit);
    };
  }, []);

  return stickyTop;
}
