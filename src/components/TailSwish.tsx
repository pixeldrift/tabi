import { motion } from "motion/react";
import { TAIL_SWISH_FRAMES, TAIL_SWISH_VIEWBOX } from "@/lib/tailSwishFrames";

// Frame 0 repeated on the end closes the loop — the traced GIF's own last
// frame doesn't quite land back on its first, so without this the loop
// visibly snaps once per cycle instead of reading as one continuous swish.
const LOOP_FRAMES = [...TAIL_SWISH_FRAMES, TAIL_SWISH_FRAMES[0]];

/** An idle, looping cat-tail swish — path-morphed between 16 frames traced
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
  // from the source's real timing. Requested at ~1/4 that speed, so this is
  // 4x that guess rather than 4x anything measured.
  durationSec = 9.6,
}: {
  className?: string;
  /** In the tail's own ~290x152 viewBox units, not screen pixels — scales
   *  with the element like the rest of the path. */
  strokeWidth?: number;
  /** Seconds for one full swish cycle (both directions), looped forever. */
  durationSec?: number;
}) {
  return (
    <svg viewBox={TAIL_SWISH_VIEWBOX} fill="none" className={className} aria-hidden>
      <motion.path
        initial={{ d: LOOP_FRAMES[0] }}
        animate={{ d: LOOP_FRAMES }}
        transition={{ duration: durationSec, repeat: Infinity, ease: "easeInOut" }}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
