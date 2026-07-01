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

/** Percent Correct — the classic percent glyph. */
export function PercentCorrectIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Frequency / Tally / Count — four tally marks with a strike. */
export function FrequencyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="6" y1="5" x2="6" y2="19" />
      <line x1="10" y1="5" x2="10" y2="19" />
      <line x1="14" y1="5" x2="14" y2="19" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="4.5" y1="17" x2="19.5" y2="7" />
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

/** Rate ("how many times per") — dial with a needle. */
export function RateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <line x1="12" y1="16" x2="16" y2="10.5" />
      <line x1="4" y1="16" x2="4" y2="18" />
      <line x1="20" y1="16" x2="20" y2="18" />
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

/** Task Analysis — ascending steps. */
export function TaskAnalysisIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19v-4h4v-4h4V7h4V3" />
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
