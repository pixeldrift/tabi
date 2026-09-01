import Icon from "./svg/rate.svg?react";

/** Rate ("how many times per") — the same stopwatch frame as Duration, but
 *  with a tally hash mark (slanted to match FrequencyIcon's own "#") in
 *  place of a second hand, since Rate's actual function is closer to
 *  Frequency's ("a tally per time") than to Duration's ("how long something
 *  lasted"). Distinguishing it from Duration's plain stopwatch this way
 *  (rather than a subtler tweak like a dashed arc) is deliberate — the two
 *  used to be hard to tell apart at small sizes. Source: ./svg/rate.svg
 *  (edit there — this file just re-exports it). */
export const RateIcon = Icon;
