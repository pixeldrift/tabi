import type { SVGProps } from "react";

/** Two chevrons folding toward each other — "collapse this", not "hide this". */
export function CollapseIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6 9.5 12 4l6 5.5" />
      <path d="M6 19 12 13.5 18 19" />
    </svg>
  );
}
