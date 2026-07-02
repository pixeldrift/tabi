import type { SVGProps } from "react";

/**
 * Minimalist outline icons for data-collection types and the editable-number
 * indicator. Drawn in the same stroke language as lucide-react (24x24
 * viewBox, 2px stroke, round caps/joins, no fill) so they sit naturally next
 * to lucide icons elsewhere in the app. Color and size are controlled by the
 * caller via `className` (e.g. `size-3.5 text-muted-foreground`) or `props`,
 * exactly like a lucide icon.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Percent Correct — percent glyph with a checkmark and a tiny x in place of the two circles. */
export function PercentCorrectIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.7 7.2 6.4 9 9.3 4.8" />
      <path d="M14.7 14.7 19.3 19.3 M19.3 14.7 14.7 19.3" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Frequency — an italicized (slanted) number sign. */
export function FrequencyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="10" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="14" y2="20" />
      <line x1="5" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="19" y2="15" />
    </svg>
  );
}

/** Duration / Timer — stopwatch. */
export function DurationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <circle cx="12" cy="14" r="8" />
      <line x1="12" y1="14" x2="12" y2="10" />
      <line x1="12" y1="14" x2="15" y2="15.5" />
    </svg>
  );
}

/** Rate ("how many times per") — a number sign inside a stopwatch. */
export function RateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <circle cx="12" cy="14" r="8" />
      <line x1="9.5" y1="11" x2="9.5" y2="17" />
      <line x1="14.5" y1="11" x2="14.5" y2="17" />
      <line x1="8" y1="12.5" x2="16" y2="12.5" />
      <line x1="8" y1="15.5" x2="16" y2="15.5" />
    </svg>
  );
}

/** Score / Rank — ascending bars. */
export function ScoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="5" y1="19" x2="5" y2="14" />
      <line x1="12" y1="19" x2="12" y2="9" />
      <line x1="19" y1="19" x2="19" y2="5" />
    </svg>
  );
}

/** Task Analysis — three large ascending steps. */
export function TaskAnalysisIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19v-5h5v-5h5v-5h5" />
    </svg>
  );
}

/**
 * Editable-number indicator — a tiny number-pad glyph (3x3 grid of dots)
 * meant to sit beside any tappable numeric value to hint it's editable.
 */
export function NumberPadIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.4} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="8.3" cy="8" r="0.6" fill="currentColor" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
      <circle cx="15.7" cy="8" r="0.6" fill="currentColor" />
      <circle cx="8.3" cy="12" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      <circle cx="15.7" cy="12" r="0.6" fill="currentColor" />
      <circle cx="8.3" cy="16" r="0.6" fill="currentColor" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      <circle cx="15.7" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}
