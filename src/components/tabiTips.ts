import type { StatusTab } from "./StatusBar";
import type { DisplayMode } from "./DataToolbarContext";

/** One entry in the "Did you know?" tip rotation — reuses the guided
 *  tour's own shape (`tab` + `selector`, see tourSteps.ts) since it reuses
 *  the same spotlight/callout mechanism, just single-step and resurfaced
 *  periodically instead of walked through once in sequence. */
export interface TabiTip {
  id: string;
  tab: StatusTab;
  /** CSS selector for the element this tip points at — a `data-tour`
   *  attribute added specifically for this purpose, or an existing stable
   *  `id`. Some of these only exist in the DOM under a specific condition
   *  (see the per-file note below the list) — the runtime that eventually
   *  consumes this list needs to skip/reroll a tip whose target isn't
   *  found, the same way TourContext's own measuring hook already reports
   *  a distinct "not-found" status for exactly this reason. */
  selector: string;
  /** Force this Data-tab view mode before highlighting, for a tip whose
   *  target only renders in one view (e.g. something Grid-only). Unset
   *  for every tip below — none currently need it — but part of the
   *  agreed shape so a future tip can opt in without a data-format change. */
  viewMode?: DisplayMode;
  title: string;
  body: string;
}

export const TABI_TIPS: TabiTip[] = [
  {
    id: "tab-scroll-top",
    tab: "data",
    selector: '[data-tour="tab-data"]',
    title: "Jump to the top",
    body: "Clicking on the current tab will scroll you back to the top of its contents.",
  },
  {
    id: "drawer-width-toggle",
    tab: "data",
    selector: '[data-tour="drawer-width-toggle"]',
    title: "Resize the details drawer",
    body: "You can use the arrow buttons to expand or contract the details drawer. You can also use swipe gestures to go full-width or get it out of the way.",
  },
  {
    id: "drawer-card-indicator",
    tab: "data",
    selector: '[data-tour="drawer-card-indicator"]',
    title: "Know which card you're viewing",
    body: "The details drawer indicates which data card it's referring to, and the arrow button will take you to it when it's scrolled off screen.",
  },
  {
    id: "drawer-prev-next",
    tab: "data",
    selector: '[data-tour="drawer-prev-next"]',
    title: "Skip between cards from the drawer",
    body: "The forward and next buttons on either side of the drawer title let you skip between data cards directly from the drawer. Just another way to navigate.",
  },
  {
    id: "keep-card-centered",
    tab: "settings",
    selector: "#keepActiveCardCentered",
    title: "Auto-center your active card",
    body: "In your preferences, you can have Tabi automatically scroll your view to stay centered on whatever data card you have selected.",
  },
  {
    id: "schedule-now-button",
    tab: "schedule",
    selector: '[data-tour="schedule-now-button"]',
    title: "What's happening now",
    body: 'When viewing the schedule, you can tap the "Now" button to jump directly to the current time to see what's on thr scheduke right now.',
  },
  {
    id: "timestamp-alert-jump",
    tab: "data",
    selector: '[data-tour="timestamp-alert-jump"]',
    title: "Score right from the alert",
    body: "For data collection with a timestamp, you can collect your data directly from the reminder alert, or tap it to jump to that card in the list.",
  },
  {
    id: "duration-stopwatch-badge",
    tab: "data",
    selector: '[data-tour="active-duration-indicator"]',
    title: "Never lose track of a running timer",
    body: "When you start a duration timer, a stopwatch symbol appears to remind you it's running, even if you scroll away. Multiple timers running at once show a number badge. Tapping the stopwatch takes you straight to the card, tapping again cycles through every running timer.",
  },
  {
    id: "duration-auto-advance",
    tab: "data",
    selector: '[data-tour="duration-status-row"]',
    title: "One card, three metrics",
    body: "Stopping a duration timer automatically advances to a fresh instance resdy to start. It counts frequency, individual duration, and and toral combined duration all in a single interaction.",
  },
  {
    id: "presence-indicator",
    tab: "data",
    selector: '[data-tour="presence-indicator"]',
    title: "See who's in session with you",
    body: "You can easily see if anyone else is in the same session with you, whethere it's another RBT, your BCBA, or a related-services clinician. You'll get a notification when someone joins the data sheet.",
  },
  {
    id: "review-mode",
    tab: "data",
    selector: '[data-tour="review-mode-toggle"]',
    title: "Fix a mistake after the fact",
    body: "If you need to modify data after a session has ended, you can unlock Review Mode as long as you haven't submitted yet. This lets you make changes without affecting any rate data, since the session timer stays right where it left off while you log.",
  },
  {
    id: "schedule-alert-cycle",
    tab: "schedule",
    selector: '[data-tour="schedule-alert-cycle"]',
    title: "Quick alarm toggles",
    body: "You can quickly toggle alarms for any activity directly from that item on the schedule, without having to open it for editing.",
  },
  {
    id: "ta-helping-hand",
    tab: "data",
    selector: '[data-tour="step-plan-badge"]',
    title: "Know which prompt to use",
    body: 'Task Analysis cards show a "helping hand" symbol to remind you which prompt level to use for each step in forward or backward chaining. There's no need to go read the description.',
  },
  {
    id: "blurred-photos",
    tab: "info",
    selector: '[data-tour="client-photo"]',
    title: "Private by default",
    body: "For privacy, client photos are blurred by default. Tap to reveal them temporarily.",
  },
  {
    id: "guardian-vehicle-handoff",
    tab: "info",
    selector: "#section-guardians",
    title: "Faster pickups",
    body: "Client handoff at the end of a session is made easier with quick access to guardian and pickup vehicle information.",
  },
  {
    id: "notification-swipe-dismiss",
    tab: "data",
    selector: '[data-tour="notification-swipe-row"]',
    title: "Swipe away alerts",
    body: "You can quickly dismiss or silence alarms by swiping the notification away.",
  },
  {
    id: "alarm-click-to-schedule",
    tab: "notifications",
    selector: '[data-tour="notification-view-schedule"]',
    title: "Alerts link back to the schedule",
    body: "Clicking on an alarm can take you directly to that item on the schedule.",
  },
  {
    id: "twirldown",
    tab: "data",
    selector: '[data-tour="twirldown"]',
    title: "See every trial at once",
    body: "For many cards, you can tap the twirl-down arrow to reveal an expanded view where multiple trials can be seen all at once. Click again to collapse it back to the standard view.",
  },
  {
    id: "card-datatype-label",
    tab: "data",
    selector: '[data-tour="card-datatype-label"]',
    title: "Brush up on data types",
    body: "Click on a data type to learn more, with an explanation of how that card style works.",
  },
  {
    id: "card-phase-label",
    tab: "data",
    selector: '[data-tour="card-phase-label"]',
    title: "Refresh yourself on phases",
    body: "Click on a phase to learn more about it and be reminded of what that particular phase involves.",
  },
  {
    id: "edit-mode",
    tab: "data",
    selector: '[data-tour="edit-mode-toggle"]',
    title: "Reorder, hide, or favorite",
    body: "Use edit mode to rearrange the order of your data collection cards, hide them, or mark them as favorites.",
  },
  {
    id: "bookmark-bar-visibility-toggle",
    tab: "data",
    selector: '[data-tour="bookmark-bar-visibility-toggle"]',
    title: "Toggle the bookmarks bar",
    body: "Show your pinned shelf of favorited cards or interfering behaviors so they're at your fingertips, or hide it when you want more screen space.",
  },
  {
    id: "bookmark-bar-mode-toggle",
    tab: "data",
    selector: '[data-tour="bookmark-bar-mode-toggle"]',
    title: "Two shelves in one bar",
    body: "The bookmarks bar toggles lets you choose between viewing your favorited cards or interfering behaviors, so whichever set you need during a session is one tap away.",
  },
  {
    id: "trial-min-dot",
    tab: "data",
    selector: '[data-tour="trial-min-dot"]',
    title: "Your minimums at a glance",
    body: "Percent Correct cards visually indicate the minimum number of trials required for the data to be valid for submission. Just complete the dots. Any maximums are also clearly indicated.",
  },
  {
    id: "filter-cycle",
    tab: "data",
    selector: '[data-tour="filter-cycle-chip"]',
    title: "Filter your data",
    body: "Use the filters to quickly find the card you need. The filter icons cycle between showing only those items, excluding those items, or removing the filter entirely.",
  },
  {
    id: "target-interfering-toggle",
    tab: "data",
    selector: '[data-tour="behavior-filter-toggle"]',
    title: "Split goals and behaviors",
    body: "You can instantly switch between viewing cards that are only for improvement goals, only ones for interfering behaviors, or both.",
  },
  {
    id: "appt-overlay-toggle",
    tab: "schedule",
    selector: '[data-tour="schedule-appt-toggle"]',
    title: "Tuck appointments out of the way",
    body: "Appointments overlay directly on your activity schedule. Show or hide them, or tap the arrows to roll them up into a thin bar without taking up space. Tap it again to expand it back.",
  },
  {
    id: "schedule-layout-toggle",
    tab: "schedule",
    selector: '[data-tour="schedule-layout-toggle"]',
    title: "Two ways to see your day",
    body: "Proportional view visualizes each activity by its real duration, while collapsed mode shows a compact view listed by the start times.",
  },
  {
    id: "staff-bio-popover",
    tab: "data",
    selector: '[data-tour="session-attribution-pill"]',
    title: "Connect with your team",
    body: "Click on a staff member's name to pull up their bio, contact links, or other details.",
  },
  {
    id: "pause-before-end",
    tab: "data",
    selector: '[data-tour="end-submit-button"]',
    title: "Pause, then end",
    body: "Pausing is a required step before ending a session. This gives you a chance to resume, review, or revise things before submitting the data, without feeling pressured that the timer is still running.",
  },
  {
    id: "discard-double-confirm",
    tab: "data",
    selector: '[data-tour="end-discard-button"]',
    title: "No accidents",
    body: "You can only discard a session after pausing it first, and only after intentionally confirming the action twice. Your data can't be thrown away by accident.",
  },
  {
    id: "keypad-seconds-to-minutes",
    tab: "data",
    selector: '[data-tour="time-keypad-display"]',
    title: "Type seconds, get minutes",
    body: "Entering a time on the keypad automatically rolls double-digit seconds into minutes. Typing 73 becomes 1 minute 13 seconds. You can also just type it straight as 113. Either way lands the same.",
  },
  {
    id: "time-period-guess",
    tab: "schedule",
    selector: '[data-tour="time-period-override"]',
    title: "AM or PM? Tabi knows.",
    body: "When entering an activity or appointment time, Tabi reasonably guesses AM or PM based on business hours. Of course you can always specify yourself.",
  },
  {
    id: "fit-time-buttons",
    tab: "schedule",
    selector: '[data-tour="fit-start-button"]',
    title: "Fill available time",
    body: 'When adding an activity, Tabi suggests start and end times to match the schedule gap. Adjust freely within that open time, or tap the "fit start"/"fit end" shortcuts to snap a time to the available slot.',
  },
  {
    id: "duration-add-time",
    tab: "data",
    selector: '[data-tour="duration-keypad-add-button"]',
    title: "Add time, without doing math",
    body: "While editing a duration, the keypad's + button lets you add it to the existing value instead of replacing it. Handy for bumping up a timer you started a little late.",
  },
  {
    id: "tally-add-multiple",
    tab: "data",
    selector: '[data-tour="tally-keypad-add-button"]',
    title: "Add multiple instances at once",
    body: "You can manually edit any tally by tapping its number and using the keypad popup. The + button adds several new occurrences to the total at once, rather than tapping + repeatedly.",
  },
  {
    id: "save-status-indicator",
    tab: "data",
    selector: '[data-tour="save-status"]',
    title: "Your data is safe",
    body: "Even if you have a spotty connection, Tabi auto-syncs frequently in the background. Tap the cloud icon to force an instant save for peace of mind, or tap the status for precise details.",
  },
  {
    id: "timestamp-interval-progress",
    tab: "data",
    viewMode: "card",
    selector: '[data-tour="timestamp-interval-progress"]',
    title: "Keep track of timestamps",
    body: "Timestamp cards show a live progress bar comparing the current elapsed time to the logging intervals, so you always know to mark your next data point.",
  },
];
