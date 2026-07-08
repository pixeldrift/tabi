import Icon from "./svg/info.svg?react";

/**
 * Circled serif "i" — the app's main-menu Info tab glyph. The circle is
 * drawn in the SVG itself (not relied on from button chrome) so it reads
 * correctly wherever it's dropped in, sized like a lucide icon via props.
 * Source: ./svg/info.svg (edit there — this file just re-exports it).
 */
export const InfoIcon = Icon;
