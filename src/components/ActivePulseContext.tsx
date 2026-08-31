import { createContext, useContext } from "react";

/** Border pulse (see styles.css's own `animate-now-pulse`) played on
 *  whichever card is active right when the display mode switches — same
 *  idea as the schedule's own flash on its "Now" button. A context rather
 *  than a prop threaded through all nine card-kind components: only the
 *  four leaf render targets (CardShell, TrialCard, MiniTileShell,
 *  DataListRow) actually need it, and each renders the pulse as a real
 *  child of its own root element, growing/moving/resizing with it for
 *  free — no separate `position: fixed` overlay to measure or keep in
 *  sync with a card that might still be scrolling or mid-morph.
 *
 *  `pulseActive` is true for a fixed window right after a switch (long
 *  enough to cover animate-now-pulse's own two-cycle duration) — a card
 *  only ever shows the pulse while BOTH this is true AND it's the active
 *  one, so selecting a different card outside that window never
 *  (re)triggers it. `pulseGen` is a plain trigger counter used as the
 *  pulse element's own `key`, so remounting it on every switch is what
 *  makes the CSS animation actually restart from 0% instead of no-opping
 *  on one that's already "played." */
export interface ActivePulseValue {
  pulseActive: boolean;
  pulseGen: number;
}

const ActivePulseContext = createContext<ActivePulseValue>({
  pulseActive: false,
  pulseGen: 0,
});

export const ActivePulseProvider = ActivePulseContext.Provider;

export function useActivePulse() {
  return useContext(ActivePulseContext);
}
