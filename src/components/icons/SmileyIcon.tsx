import type { SVGProps } from "react";

/** Simple smiley face, drawn in the app's stroke-icon style, for the
 * activity/location emoji visibility toggle. */
export function SmileyIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14c.8 1.2 2 2 3.5 2s2.7-.8 3.5-2" />
      <line x1="9" y1="9.5" x2="9" y2="9.51" />
      <line x1="15" y1="9.5" x2="15" y2="9.51" />
    </svg>
  );
}
