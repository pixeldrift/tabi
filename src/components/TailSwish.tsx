import { motion } from "motion/react";
import { TAIL_SWISH_FRAMES, TAIL_SWISH_TIMES, TAIL_SWISH_VIEWBOX } from "@/lib/tailSwishFrames";
import { cn } from "@/lib/utils";

// Frame 0 repeated on the end closes the loop — the traced GIF's own last
// frame doesn't quite land back on its first, so without this the loop
// visibly snaps once per cycle instead of reading as one continuous swish.
const LOOP_FRAMES = [...TAIL_SWISH_FRAMES, TAIL_SWISH_FRAMES[0]];

/** An idle, looping cat-tail swish — path-morphed between 32 frames traced
 *  from a real tail-swish GIF (see src/lib/tailSwishFrames.ts for how).
 *  Pure decoration: sizing, color, and placement are entirely up to the
 *  caller via `className` (width/height + a text-color utility, since the
 *  stroke follows `currentColor`) and whatever wrapper positions it —
 *  nothing here assumes where it's used. */
export function TailSwish({
  className,
  strokeWidth = 7,
  // No frame-delay metadata survived from the original GIF (only the traced
  // PNG frames did) — 2.4s was a guess at a pleasant idle pace, not derived
  // from the source's real timing. Slowed to ~1/4 that speed (9.6s), then
  // sped back up 25% from there (9.6 * 0.75 = 7.2s) once live at that pace.
  durationSec = 7.2,
  // The traced viewBox is landscape (~290x152 — the source swish reads
  // wider than tall), so a box narrower/taller than that ratio leaves
  // padding on two sides under the default "meet, centered" fit. Callers
  // fitting this into a short, bottom-anchored slot (e.g. poking up from a
  // tab bar) want that padding pushed to the top instead, so the tail's own
  // base — not empty space — sits flush with the box's bottom edge.
  preserveAspectRatio = "xMidYMid meet",
}: {
  className?: string;
  /** In the tail's own ~290x152 viewBox units, not screen pixels — scales
   *  with the element like the rest of the path. */
  strokeWidth?: number;
  /** Seconds for one full swish cycle (both directions), looped forever. */
  durationSec?: number;
  preserveAspectRatio?: string;
}) {
  return (
    <svg
      viewBox={TAIL_SWISH_VIEWBOX}
      fill="none"
      // The viewBox is fit to the traced centerline itself, with no margin
      // for strokeWidth — at a thick stroke, the round cap at the curve's
      // widest swings pokes past that boundary, and an <svg> clips to its
      // own viewBox by default. overflow-visible (same fix the cat-ear tab
      // shape's own side walls needed, for the same reason) lets that
      // sliver actually render instead of getting cut off.
      className={cn("overflow-visible", className)}
      preserveAspectRatio={preserveAspectRatio}
      aria-hidden
    >
      <motion.path
        initial={{ d: LOOP_FRAMES[0] }}
        animate={{ d: LOOP_FRAMES }}
        // linear, not easeInOut: keyframe easing applies per-segment, so
        // easeInOut decelerates into and re-accelerates out of EVERY one of
        // the 32 frames — each frame boundary reads as a brief pause/step
        // rather than one continuous motion. Constant velocity between
        // frames is what actually blends them smoothly.
        //
        // times: without this, Motion splits the duration into 32 equal
        // slices — one per frame — regardless of how far any given frame
        // actually moved. The source swish naturally slows near both ends
        // of its arc (like a pendulum), so the slowest slices cover far
        // less distance than the fastest ones yet got the same amount of
        // time, which read as the whole loop pausing at both extremes.
        // These times (see their own comment in tailSwishFrames.ts) are
        // that same per-segment distance normalized instead, so time is
        // spent where the tail is actually moving.
        transition={{
          duration: durationSec,
          repeat: Infinity,
          ease: "linear",
          times: TAIL_SWISH_TIMES,
        }}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
