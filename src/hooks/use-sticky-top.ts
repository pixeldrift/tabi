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
 *  change reaches React.
 *
 *  `immediate` (routes/index.tsx passes `useSuppressSessionLayout()`, a
 *  grace-extended version of `suppressPaneLayout` — see that hook's own
 *  comment) lifts that debounce during a start/pause/resume/discard
 *  (-excluded) session transition — the same window where the content pane
 *  and tab nav ALSO give up `layout` tracking in favor of following the
 *  header's real reflow natively. With both of them already tracking it
 *  live, the sticky toolbar's own `top` waiting out a 60ms quiet period was
 *  the one thing left dragging behind: it'd sit frozen while the header
 *  visibly finished collapsing/expanding, then jump to the correct spot a
 *  beat later — read as the toolbar detaching from the pane. Committing
 *  every callback in real time during this window instead keeps it moving
 *  in the same frame-by-frame lockstep as its siblings. */
export function useStickyTop(immediate: boolean) {
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
  // (matching the server) and correcting via the effect below, same as
  // before, is what's actually safe — DataToolbar's own `layoutReady` gate
  // is what keeps that correction from being animated as a false move.
  const [stickyTop, setStickyTop] = useState(0);
  const debounceRef = useRef<number | null>(null);
  // Read fresh inside the ResizeObserver callback below without having to
  // tear down and re-observe on every flip — the callback closes over this
  // ref, not the `immediate` param directly.
  const immediateRef = useRef(immediate);
  useEffect(() => {
    immediateRef.current = immediate;
  }, [immediate]);

  useEffect(() => {
    const bar = document.querySelector("[data-status-bar]") as HTMLElement | null;
    if (!bar) return;
    const commit = () => setStickyTop(bar.getBoundingClientRect().height);
    const update = () => {
      if (immediateRef.current) {
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        commit();
        return;
      }
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
