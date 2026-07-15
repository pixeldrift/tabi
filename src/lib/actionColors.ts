// Named constants for the exact hex values a few Framer Motion color
// animations need as literal strings — its own color interpolation can't
// resolve a `var(--custom-property)` reference mid-tween the way CSS itself
// can, so these can't just point at styles.css's own custom properties the
// way static SVG fills do (see TimestampCard/ScheduleView's "now" chevron).
// Kept here as the one place these particular values are defined, so they
// can't drift from the Tailwind shade each is pinned to.
export const TIMER_MORPH_DIGIT_MINI = "#292524"; // stone-800
export const TIMER_MORPH_DIGIT_FULL = "#1d4ed8"; // blue-700
export const TIMER_MORPH_BORDER_MINI = "#d6d3d1"; // stone-300
export const TIMER_MORPH_BORDER_FULL = "#3b82f6"; // blue-500
