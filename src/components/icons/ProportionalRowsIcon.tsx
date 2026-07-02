import type { SVGProps } from "react";

/**
 * Same card-split-into-rows language as lucide's Rows3 (used for the
 * "collapsed / uniform rows" state), but with unequal band heights — pairs
 * with it to show that proportional mode sizes rows by duration, not width.
 */
export function ProportionalRowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M21 8H3" />
      <path d="M21 17H3" />
    </svg>
  );
}
