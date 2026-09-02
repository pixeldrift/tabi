import Icon from "./svg/merge-arrow.svg?react";

/** Two branches converging into a single arrow — used for the big session
 *  pill's Join button (someone else already started the session; tapping it
 *  merges you into that same running session) instead of a plain rightward
 *  arrow, which read as "resume/forward" and didn't say "join" on its own.
 *  Same 2.6 stroke as every other custom icon here — only the silhouette is
 *  meant to stand out, not the line weight. Source: ./svg/merge-arrow.svg
 *  (edit there — this file just re-exports it). */
export const MergeArrowIcon = Icon;
