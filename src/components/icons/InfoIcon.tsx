import type { SVGProps } from "react";

/**
 * Circled serif italic "i" — the app's main-menu Info tab glyph. The circle
 * is drawn in the SVG itself (not relied on from button chrome) so it reads
 * correctly wherever it's dropped in, sized like a lucide icon via props.
 */
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth={2} />
      <text
        x="10.9"
        y="16.7"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="13.5"
        fill="currentColor"
      >
        i
      </text>
    </svg>
  );
}
