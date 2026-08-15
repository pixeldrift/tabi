import { useEffect, useState } from "react";

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type SpotlightTargetStatus = "measuring" | "settled" | "not-found";

// A target can be genuinely present in the DOM with a real (non-zero) box
// and still not be something scrolling could ever reveal — a details
// drawer collapsed to its own pull tab, say, whose nav buttons still exist
// but sit almost entirely past the viewport's own right edge as part of
// that collapsed state's design, not because the page just needs to
// scroll further. `el.scrollIntoView` below already handles the common
// case (something merely further down a normal scrollable list); this
// catches what's left over — treated the same as a selector that matched
// nothing at all, so the caller redraws to a target that's actually
// reachable instead of pointing an arrow at a mostly-invisible sliver.
const MIN_VISIBLE_FRACTION = 0.5;
function isMeaningfullyVisible(r: SpotlightRect): boolean {
  if (r.width <= 0 || r.height <= 0) return false;
  const visibleWidth = Math.max(
    0,
    Math.min(r.left + r.width, window.innerWidth) - Math.max(r.left, 0),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(r.top + r.height, window.innerHeight) - Math.max(r.top, 0),
  );
  return (visibleWidth * visibleHeight) / (r.width * r.height) >= MIN_VISIBLE_FRACTION;
}

/** Poll-until-stable, then keep tracking, measurement for a spotlight
 *  target (the guided tour's current step, or the tip engine's current
 *  tip) — same idiom as useElementRight (use-element-height.ts): a target
 *  frequently gets queried right after a tab switch, which can still be
 *  mid-flight through that tab's own scroll-position-restoring effect, so
 *  a single getBoundingClientRect() risks capturing a skewed, not-yet-
 *  settled rect with nothing to ever re-trigger a correction. Polling
 *  every frame until N consecutive identical readings land is what
 *  actually catches "settled," regardless of how long the real settling
 *  takes — but the poll never actually STOPS once found: `rect` is a live
 *  read of the target's current position for as long as this hook stays
 *  mounted with this selector/generation, not a one-time snapshot frozen
 *  at whatever it measured first. Something the tour/tip overlay itself
 *  has no control over — a notification banner popping in above the
 *  content, an orientation change, anything else that reflows the page —
 *  can move the real target well after it first "settled"; without
 *  continuous tracking the spotlight would keep pointing at stale
 *  coordinates instead of following the element it's actually meant to be
 *  attached to. `setRect` only fires on an actual change (not every
 *  frame), so a genuinely static target costs one state update, not 60/s.
 *
 *  `generation` should bump on every target change (even if `selector`
 *  happens to repeat) so the poll restarts fresh each time rather than
 *  reusing a stale settled/not-found result from a previous target. */
export function useSpotlightTargetRect(selector: string | null, generation: number) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [status, setStatus] = useState<SpotlightTargetStatus>("measuring");

  useEffect(() => {
    if (!selector) {
      setRect(null);
      setStatus("not-found");
      return;
    }
    setStatus("measuring");
    let raf = 0;
    let settledStreak = 0;
    let lastRect: SpotlightRect | null = null;
    let framesElapsed = 0;
    let hasSettled = false;
    // Same constants as useElementRight — 4 consecutive identical readings
    // reads as settled, capped at ~2s so a genuinely missing target doesn't
    // block the reveal forever.
    const MAX_POLL_FRAMES = 120;
    const SETTLED_STREAK_TARGET = 4;
    // Longer than the settle streak alone — a target that's truly absent
    // (wrong selector, or this step's tab hasn't rendered it) reports
    // "not-found" only after giving it a real chance to appear, not on the
    // very first still-mounting frame.
    const NOT_FOUND_GRACE_FRAMES = 30;
    // A target further down a tab than the current scroll position (e.g.
    // Settings' own "Help" section, below Appearance/Notifications/
    // Schedule/Data) never enters the viewport on its own — scrolled into
    // view exactly once per generation the first frame it's found, then
    // left alone; the poll-until-stable loop below already absorbs
    // whatever reflow that scroll itself causes, the same way it absorbs a
    // tab switch's own scroll-restoration.
    let hasScrolledIntoView = false;

    raf = requestAnimationFrame(function tick() {
      const el = document.querySelector(selector) as HTMLElement | null;
      framesElapsed += 1;
      if (!el) {
        if (framesElapsed >= NOT_FOUND_GRACE_FRAMES) {
          setStatus("not-found");
          return; // not-found is terminal for this generation — a redraw elsewhere picks a new target
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!hasScrolledIntoView) {
        hasScrolledIntoView = true;
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
      const r = el.getBoundingClientRect();
      const hasRealBox = r.width > 0 || r.height > 0;
      const next: SpotlightRect = { top: r.top, left: r.left, width: r.width, height: r.height };
      const unchanged =
        hasRealBox &&
        lastRect !== null &&
        next.top === lastRect.top &&
        next.left === lastRect.left &&
        next.width === lastRect.width &&
        next.height === lastRect.height;
      // Only touch state on a real change — every frame still re-measures
      // the live element (see the comment above), but a static target
      // shouldn't cost a re-render 60 times a second.
      if (!unchanged) setRect(next);
      settledStreak = unchanged ? settledStreak + 1 : 0;
      lastRect = next;
      if (
        !hasSettled &&
        (settledStreak >= SETTLED_STREAK_TARGET || framesElapsed >= MAX_POLL_FRAMES)
      ) {
        hasSettled = true;
        setStatus(isMeaningfullyVisible(next) ? "settled" : "not-found");
      }
      // Keep polling indefinitely rather than stopping once settled — see
      // this hook's own doc comment.
      raf = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, [selector, generation]);

  return { rect, status };
}
