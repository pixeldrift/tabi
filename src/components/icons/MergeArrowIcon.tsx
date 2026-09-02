import Icon from "./svg/merge-arrow.svg?react";

/** Two branches converging into a single arrow — used for the big session
 *  pill's Join button (someone else already started the session; tapping it
 *  merges you into that same running session) instead of a plain rightward
 *  arrow, which read as "resume/forward" and didn't say "join" on its own.
 *  Bolder stroke (4, vs. the app's usual 2.6) than the rest of the custom
 *  icon set — this one's small render size (a 24px button icon) needs the
 *  extra weight to keep the fork legible instead of collapsing into a
 *  blurry check mark. Source: ./svg/merge-arrow.svg (edit there — this file
 *  just re-exports it). */
export const MergeArrowIcon = Icon;
