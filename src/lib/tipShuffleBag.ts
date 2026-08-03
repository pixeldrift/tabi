/** Pure shuffle-bag logic for the "Did you know?" tip engine — kept free of
 *  React so it's trivially testable/reasoned about on its own, same as
 *  dataTypeInfo.ts/promptLevels.ts alongside it. */

/** Fisher–Yates — doesn't mutate `arr`. */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Draws the next tip id off `bag` (persisted, remaining ids this cycle),
 *  reshuffling a fresh copy of `allIds` once the bag runs out. Either way,
 *  guards against serving `lastShownId` back-to-back — the one seam a
 *  reshuffle could otherwise produce, since a fresh shuffle's first slot has
 *  no memory of what was last shown before it emptied — by swapping the
 *  first two entries when the draw would repeat it.
 *
 *  Single primitive used identically for auto-launch, "Next tip" clicks, and
 *  not-found redraws — one code path, not three, for what "draw a tip"
 *  means. */
export function drawNextTipId(
  bag: string[],
  lastShownId: string | null,
  allIds: string[],
): { id: string; remainingBag: string[] } {
  const source = bag.length > 0 ? [...bag] : shuffle(allIds);
  if (source.length > 1 && source[0] === lastShownId) {
    [source[0], source[1]] = [source[1], source[0]];
  }
  const [id, ...remainingBag] = source;
  return { id, remainingBag };
}
