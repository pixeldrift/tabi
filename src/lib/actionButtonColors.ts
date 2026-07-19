/** Shared color language for every scoring/action button across the app —
 *  red=error, amber=neutral/prompted/no-response, green=correct/independent,
 *  blue=increment, neutral=a plain unscored option (List row's own
 *  ListActionButton, and Trial/TaskAnalysis card's own bigger buttons, all
 *  draw from this same map instead of each re-declaring the same Tailwind
 *  strings) — one place to change if a shade ever needs to move. */
export const ACTION_BUTTON_COLORS = {
  neutral: {
    classes: "border-stone-200 bg-white text-foreground/70 hover:bg-stone-50",
    selectedClasses: "bg-stone-500 border-stone-600 text-white",
  },
  red: {
    classes: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClasses: "bg-red-500 border-red-600 text-white",
  },
  amber: {
    classes: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClasses: "bg-amber-500 border-amber-600 text-white",
  },
  green: {
    classes: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClasses: "bg-green-500 border-green-600 text-white",
  },
  blue: {
    classes: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    selectedClasses: "bg-blue-500 border-blue-600 text-white",
  },
  // Always filled/solid, never just outlined — for direct-action buttons
  // like Frequency/Rate's Increment that have no on/off "selected" state of
  // their own (they just fire), matching Card mode's own solid blue plus
  // button instead of reading as an unselected toggle.
  "blue-solid": {
    classes: "border-blue-600 bg-blue-500 text-white hover:bg-blue-600",
    selectedClasses: "bg-blue-500 border-blue-600 text-white",
  },
} as const;
