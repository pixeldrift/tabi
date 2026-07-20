// ScheduleView's own animation timing — split out from the component file
// so its Motion/CSS-transition tuning lives in one place, separate from the
// (already large) render logic. TODO: surface in user settings.
export const EDIT_MODE_DURATION_MS = 350;
export const EDIT_MODE_STAGGER_MS = 60;
export const APPT_COLLAPSE_STIFFNESS = 320;
export const APPT_COLLAPSE_DAMPING = 32;
export const APPT_COLLAPSE_DURATION_MS = 320;
export const MODE_TRANSITION_DURATION_MS = 220;
