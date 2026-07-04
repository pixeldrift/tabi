import type { SVGProps } from "react";

/** The solid, rounded-flag chevron used to mark "now" on the schedule
 * timeline — reused here (rotated to point down) as the Select dropdown's
 * open/close indicator, so the two read as the same shape language. */
export function TimeChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 20" fill="currentColor" aria-hidden {...props}>
      <path d="M3 2 Q1 2 1 4 V16 Q1 18 3 18 L13 11.5 Q15 10 13 8.5 Z" />
    </svg>
  );
}
