import Icon from "./svg/rate.svg?react";

/** Rate ("how many times per") — a stopwatch ring with a gap (rather than
 *  Duration's closed circle) and a checkmark in place of hands, since Rate
 *  is a count confirmed against time rather than elapsed time itself.
 *  Distinguishing it from Duration's plain stopwatch this way is
 *  deliberate — the two used to be hard to tell apart at small sizes. A
 *  hash-mark-tally variant was tried first but read as too dense/busy at
 *  icon size. Source: ./svg/rate.svg (edit there — this file just
 *  re-exports it). */
export const RateIcon = Icon;
