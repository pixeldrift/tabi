import type { StatusTab } from "./StatusBar";

/** Whatever a step's own `isApplicable` needs to know about live app state
 *  to decide whether it still makes sense to show — kept as a small, plain
 *  object (not the whole app) so tourSteps.ts stays pure data with no
 *  dependency on the providers that supply it. */
export interface TourStepContext {
  hasAnyCards: boolean;
}

export interface TourStep {
  id: string;
  tab: StatusTab;
  /** CSS selector for the element this step points at — a `data-tour`
   *  attribute where nothing else stable exists yet, or an existing `id`. */
  selector: string;
  title: string;
  body: string;
  /** Resolved once, at tour start — see TourContext's own comment on why
   *  re-evaluating per-step would make the step counter shift mid-tour. */
  isApplicable?: (ctx: TourStepContext) => boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "session-box",
    tab: "data",
    selector: '[data-tour="session-box"]',
    title: "Your session at a glance",
    body: "This shows whether a session is running, paused, or ready to start, and who's in it — the timer here drives every card's own rate data.",
  },
  {
    id: "tabs",
    tab: "data",
    selector: '[data-tour="tab-bar"]',
    title: "Five main areas",
    body: "Client Info, Data, Schedule, Notifications, and Settings — everything you need for a session lives in one of these five tabs.",
  },
  {
    id: "view-mode",
    tab: "data",
    selector: "[data-view-mode-toggle]",
    title: "Switch how cards are laid out",
    body: "List, card, or grid — pick whichever view makes it easiest to move through this client's targets during a session.",
  },
  {
    id: "first-card",
    tab: "data",
    selector: '[data-tour="first-card"]',
    title: "Each card is one target",
    body: "Tap a card to open its details — rationale, procedure, materials, and the full history of past trials all live there.",
    isApplicable: (ctx) => ctx.hasAnyCards,
  },
  {
    id: "client-info",
    tab: "info",
    selector: "#section-about-me",
    title: "Client Info",
    body: "Background, guardians, vehicles, and the care team all live here — everything you'd need before or after a session.",
  },
  {
    id: "schedule",
    tab: "schedule",
    selector: '[data-tour="schedule-toggles"]',
    title: "Schedule",
    body: "See the day's appointments at a glance, and switch between collapsed, appointment, and icon views.",
  },
  {
    id: "notifications",
    tab: "notifications",
    selector: '[data-tour="notifications-list"]',
    title: "Notifications",
    body: "Alerts, reminders, and supervisor notes collect here — including anything you've snoozed for later.",
  },
  {
    id: "settings",
    tab: "settings",
    selector: "#settings-help",
    title: "You're all set",
    body: "You can turn this tour's hints off, or replay it any time, right here.",
  },
];
