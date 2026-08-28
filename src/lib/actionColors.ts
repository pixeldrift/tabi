import type { ColorTheme } from "@/components/SettingsContext";

// Named constants for the exact hex values a few Framer Motion color
// animations need as literal strings — its own color interpolation can't
// resolve a `var(--custom-property)` reference mid-tween the way CSS itself
// can, so these can't just point at styles.css's own custom properties the
// way static SVG fills do (see IntervalCard/ScheduleView's "now" chevron).
// Kept here as the one place these particular values are defined, so they
// can't drift from the Tailwind shade each is pinned to.
export const TIMER_MORPH_DIGIT_MINI = "#292524"; // stone-800 — same in every theme
export const TIMER_MORPH_BORDER_MINI = "#d6d3d1"; // stone-300 — same in every theme

// The "full" pill state's digit/border colors DO need to track the active
// color theme — they used to be flat constants pinned to Tailwind's actual
// blue-700/blue-500, which is exactly what broke when Sand & Sage became
// the default (see styles.css's own `:root`/`[data-theme="alt"]` swap):
// these stayed hardcoded blue regardless of theme, so every big-pill<->
// mini-pill travel animation flashed true blue mid-transition even though
// nothing else on screen is blue anymore. Values below are each theme's own
// --color-blue-700/--color-blue-500 override, converted to hex the same way
// the CSS ones were (approximated by eye, not a precise oklch->hex match).
export const TIMER_MORPH_DIGIT_FULL: Record<ColorTheme, string> = {
  default: "#0a5351", // Sand & Sage's Slate — this theme's own blue-700
  alt: "#1d4ed8", // blue-700 — the original palette's own primary shade
};
export const TIMER_MORPH_BORDER_FULL: Record<ColorTheme, string> = {
  default: "#358987", // Sand & Sage's Slate, lighter — this theme's blue-500
  alt: "#3b82f6", // blue-500
};
