import type { SVGProps } from "react";

/**
 * Small side-panel glyph — used to invoke the card-detail drawer. Distinct
 * from InfoIcon (which is now reserved for the main-menu Info tab): a
 * rounded card outline with a divider near the right edge, hinting that it
 * opens a panel on that side.
 */
export function DetailsIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <line x1="15.5" y1="5" x2="15.5" y2="19" />
    </svg>
  );
}
