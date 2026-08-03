import { useEffect, useState } from "react";

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type SpotlightTargetStatus = "measuring" | "settled" | "not-found";

/** Poll-until-stable measurement for a spotlight target (the guided tour's
 *  current step, or the tip engine's current tip) — same idiom as
 *  useElementRight (use-element-height.ts): a target frequently gets
 *  queried right after a tab switch, which can still be mid-flight
 *  through that tab's own scroll-position-restoring effect, so a single
 *  getBoundingClientRect() risks capturing a skewed, not-yet-settled rect
 *  with nothing to ever re-trigger a correction. Polling every frame
 *  until N consecutive identical readings land is what actually catches
 *  "settled," regardless of how long the real settling takes.
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
    // Same constants as useElementRight — 4 consecutive identical readings
    // reads as settled, capped at ~2s so a genuinely missing target doesn't
    // poll forever.
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
          return;
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
      setRect(next);
      const unchanged =
        hasRealBox &&
        lastRect !== null &&
        next.top === lastRect.top &&
        next.left === lastRect.left &&
        next.width === lastRect.width &&
        next.height === lastRect.height;
      settledStreak = unchanged ? settledStreak + 1 : 0;
      lastRect = next;
      if (settledStreak >= SETTLED_STREAK_TARGET) {
        setStatus("settled");
        return;
      }
      if (framesElapsed < MAX_POLL_FRAMES) {
        raf = requestAnimationFrame(tick);
      } else {
        // Gave it a generous chance and it never stopped moving — show it
        // anyway rather than leaving the caller stuck on "measuring" forever.
        setStatus("settled");
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [selector, generation]);

  return { rect, status };
}
