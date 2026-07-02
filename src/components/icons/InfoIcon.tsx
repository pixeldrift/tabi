import type { SVGProps } from "react";

/**
 * Serif italic "i" — the app's stand-in for a conventional info icon, used
 * as both the info-sheet trigger glyph on data cards and the Info tab icon.
 * Drawn as SVG text on a 24x24 viewBox (rather than an HTML text node) so it
 * scales via width/height exactly like the lucide icons it sits next to.
 */
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <text
        x="10.5"
        y="18.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="19"
        fill="currentColor"
      >
        i
      </text>
    </svg>
  );
}
