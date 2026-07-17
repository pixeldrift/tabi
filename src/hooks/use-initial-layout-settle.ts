import { useEffect, useState } from "react";

/** Shared across every `layout`-tracked node in the "session-bar"
 *  LayoutGroup (StatusBar's tab nav, the content pane, the Data toolbar) —
 *  StatusBar's own box shows a demo-only "Previous Session" row once
 *  `previousSessionEndedAt` resolves (see StatusBar's own comment: it's
 *  randomized, so it can only be generated client-side, after mount, never
 *  seeded identically for server and client). That's a real, one-time
 *  growth of the box's natural height, which every layout-tracked sibling
 *  below it faithfully (and correctly) tracks — but animating it on every
 *  single page load reads as the whole header/toolbar dropping down a beat
 *  after everything else has already settled. `markInitialLayoutSettled`
 *  (called once, by StatusBar, right after that one-time growth has
 *  already landed) flips this for every subscriber at once, so they all
 *  turn their OWN layout tracking on together — not on three independently
 *  timed clocks, which would just reintroduce the exact kind of
 *  frame-apart drift the shared LayoutGroup exists to prevent. */
let settled = false;
const listeners = new Set<() => void>();

export function markInitialLayoutSettled() {
  if (settled) return;
  settled = true;
  listeners.forEach((listener) => listener());
}

export function useInitialLayoutSettled() {
  const [value, setValue] = useState(settled);
  useEffect(() => {
    if (settled) {
      setValue(true);
      return;
    }
    const listener = () => setValue(true);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}
