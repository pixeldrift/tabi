import type { SVGProps } from "react";

/**
 * Icons for the Data tab's toolbar — drawn in the same stroke language as
 * lucide-react (24x24 viewBox, 2px stroke, round caps/joins, no fill) so they
 * sit naturally next to lucide icons elsewhere in the app.
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

/** List view — three full-width rows, each a title line over a shorter
 *  detail line, echoing the stacked single-column card list. */
export function ListViewIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="9.2" x2="13" y2="9.2" />
      <line x1="4" y1="14.4" x2="20" y2="14.4" />
      <line x1="4" y1="17.6" x2="13" y2="17.6" />
    </svg>
  );
}

/** Card view — two stacked wide tiles, each with its own corner radius, for
 *  the two-column card layout. */
export function CardViewIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="6.5" rx="1.6" />
      <rect x="3.5" y="13" width="17" height="6.5" rx="1.6" />
    </svg>
  );
}

/** Grid view — a 2x2 array of small square tiles, for the denser
 *  multi-column layout. */
export function GridViewIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.3" />
      <rect x="13" y="4" width="7" height="7" rx="1.3" />
      <rect x="4" y="13" width="7" height="7" rx="1.3" />
      <rect x="13" y="13" width="7" height="7" rx="1.3" />
    </svg>
  );
}

/** Filter — a funnel, tines-down. */
export function FilterIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16l-6 7.2v5.3l-4 2v-7.3z" />
    </svg>
  );
}

/** Details-drawer pull tab — a rounded handle with a small chevron, like a
 *  tab sticking out from the side of the pane. Rotates 180° when the drawer
 *  it controls is open, so the chevron always points the direction the tab
 *  will move if pulled again. */
export function DrawerHandleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="3" width="10" height="18" rx="5" />
      <path d="M10.5 9.5 13 12l-2.5 2.5" />
    </svg>
  );
}
