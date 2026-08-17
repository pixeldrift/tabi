import { createFileRoute } from "@tanstack/react-router";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, AnimatePresence, Reorder, useDragControls, type DragControls } from "motion/react";
import { ClientInfoPane } from "@/components/ClientInfoPane";
import { TrialCard } from "@/components/TrialCard";
import { FrequencyCard } from "@/components/FrequencyCard";
import { RateCard } from "@/components/RateCard";
import { DurationCard } from "@/components/DurationCard";
import { TaskAnalysisCard } from "@/components/TaskAnalysisCard";
import { RatingCard } from "@/components/RatingCard";
import { TimestampCard } from "@/components/TimestampCard";
import { ScheduleView } from "@/components/ScheduleView";
import {
  SessionProvider,
  useSession,
  PILL_LAND_MS,
  CURRENT_STAFF_ID,
  DATA_BANNER_EXIT_MS,
  type TransitionKind,
} from "@/components/SessionContext";
import { staffName } from "@/components/StaffDirectory";
import { SettingsProvider, useSettings } from "@/components/SettingsContext";
import { ScheduleProvider } from "@/components/ScheduleContext";
import { SettingsPane } from "@/components/SettingsPane";
import { StatusBar, type StatusTab } from "@/components/StatusBar";
import { NotificationProvider, useNotifications } from "@/components/NotificationContext";
import { NOTIFICATION_AREA_TRANSITION, NotificationsPane } from "@/components/NotificationBar";
import { useStickyTop } from "@/hooks/use-sticky-top";
import { useElementHeight } from "@/hooks/use-element-height";
import { DataToolbar } from "@/components/DataToolbar";
import { BookmarkBar } from "@/components/BookmarkBar";
import {
  DataToolbarProvider,
  useDataToolbar,
  type CardKind,
  type DataToolbarFilters,
  type DisplayMode,
} from "@/components/DataToolbarContext";
import { CardDataStoreProvider } from "@/components/CardDataStore";
import { TourProvider } from "@/components/TourContext";
import { TourOverlay } from "@/components/TourOverlay";
import { TipProvider } from "@/components/TipContext";
import { TipOverlay } from "@/components/TipOverlay";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import type { TeachingProcedure } from "@/components/TeachingProcedureAccordion";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        name: "description",
        content:
          "A prototype front-end platform for Applied Behavioral Analysis data collection and session management.",
      },
    ],
  }),
  component: Index,
});

// `id` is intersected onto every variant rather than repeated per-branch —
// stable identity for drag-reorder, favoriting, hiding, and active-card
// tracking, independent of array position (which filtering/reordering
// otherwise makes an unreliable key).
export type CardConfig = {
  id: string;
  behaviorRole?: "interfering";
  teachingProcedure?: TeachingProcedure;
} & (
  | {
      kind: "trial";
      title: string;
      phase: string;
      description: string;
      /** Omit for "No Min" — cards can set a max with no min (or vice versa). */
      minTrials?: number;
      maxTrials?: number;
      /** Adds a third, neutral "No Response" option between Error and Correct. */
      noResponse?: boolean;
      /** Error becomes a picker for these prompt levels instead of a plain toggle. */
      promptLevels?: string[];
    }
  | { kind: "frequency"; title: string; phase: string; description: string; minCount: number }
  | {
      kind: "rate";
      title: string;
      phase: string;
      description: string;
      /** Omit for interfering behaviors — there's no minimum window; every
       *  instance counts regardless. */
      minDurationSec?: number;
      locked?: boolean;
    }
  | {
      kind: "duration";
      title: string;
      phase: string;
      description: string;
      /** Omit for interfering behaviors — there's no minimum; every
       *  instance counts regardless. */
      minDurationSec?: number;
    }
  | {
      kind: "task-analysis";
      title: string;
      phase: string;
      description: string;
      steps: string[];
      /** "forward" (default) or "backward" chaining plan. */
      chainingDirection?: "forward" | "backward";
      /** Per-step expected mastery level from the chaining plan (same length
       *  as steps) — a prompt-level name, "Independent", or omitted. */
      stepPlan?: (string | null)[];
      /** Prompted becomes a picker for these prompt levels instead of a
       *  plain toggle. */
      promptLevels?: string[];
    }
  | {
      kind: "rating";
      title: string;
      phase: string;
      description: string;
      min?: number;
      max: number;
      levelDescriptions?: string[];
    }
  | {
      kind: "timestamp";
      title: string;
      phase: string;
      description: string;
      /** Length of each scored interval, in minutes (e.g. 30 or 60). */
      intervalMin: number;
      /** Total number of intervals across the whole observation window —
       *  omit for an open-ended card that just keeps showing (and scoring)
       *  intervals for as long as the session runs. */
      intervalCount?: number;
      /** Only relevant when `intervalCount` is omitted — how many hours of
       *  intervals to show by default (defaults to 4). */
      defaultWindowHours?: number;
      /** Button + measurement-row label for the positive outcome — defaults
       *  to "Correct" when omitted. */
      positiveLabel?: string;
      /** Button + measurement-row label for the negative outcome — defaults
       *  to "Incorrect" when omitted. */
      negativeLabel?: string;
      /** TEMPORARY test hook — unlocks the elapsed-time pill for manual
       *  entry instead of following the session clock. Defaults to locked. */
      locked?: boolean;
    }
);

// The built-in demo set — seed data for `cards` (see IndexInner), which
// merges this with whatever's been created via the Settings "Add New Card"
// flow and persisted separately. Never mutated itself.
const BUILT_IN_CARDS: CardConfig[] = [
  {
    id: "holds-hand-transition",
    kind: "trial",
    title: "Holds hand during transition",
    phase: "Intervention",
    description:
      "Score correct if the learner reaches for and maintains hand-hold from the start of the transition through arrival at the destination.",
    minTrials: 5,
    teachingProcedure: {
      goal: "Phineas will hold an adult's hand throughout each room-to-room transition without prompting, across 4 of 5 consecutive opportunities.",
      rationale:
        "Elopement risk during transitions is a safety priority; a reliable hand-hold keeps him within arm's reach in hallways and other unsecured spaces until independent safety awareness is established.",
      procedure:
        "As the transition begins, offer an open hand at his side (not directly in front of him) and pair it with the SD. Walk at his pace. If he reaches and holds, continue the transition and deliver praise once you arrive. If he doesn't take your hand within 3 seconds, move to the correction procedure.",
      sd: '"Take my hand, let\'s go to [destination]."',
      measurement: {
        markCorrect:
          "He reaches for and maintains the hand-hold independently from the start of the transition through arrival, with no more than a momentary release (under 1 second).",
        markError:
          "He does not reach for the hand within 3 seconds of the SD, pulls away and does not reinitiate within 3 seconds, or requires a physical prompt to reconnect the hold.",
      },
      correction:
        'Model the hand-hold by gently guiding his hand to yours (partial physical), narrate "hand together," and continue the transition. Do not repeat the SD — the transition continues either way, just with support.',
      instructionalNotes:
        "Fades from full physical guidance to a gestural offer as he becomes more reliable; note which prompt level he needed in your session notes even though this card only scores correct/error.",
    },
  },
  {
    id: "requests-preferred-item",
    kind: "trial",
    title: "Requests preferred item",
    phase: "Baseline",
    description:
      "Score correct if the learner independently requests using a full phrase within 5 seconds of the item being visible. Score No Response if the learner does not attempt within the window.",
    minTrials: 8,
    noResponse: true,
    teachingProcedure: {
      goal: 'Phineas will independently request a preferred item using a full phrase ("I want ___") within 5 seconds of the item being visible, across 8 of 10 opportunities per baseline probe.',
      rationale:
        "Functional communication reduces reliance on grabbing or protesting to access preferred items, and a full-phrase request generalizes better across communication partners than a single-word mand.",
      procedure:
        "Present a preferred item just out of reach so it's clearly visible. Wait silently for up to 5 seconds. If he requests using a full phrase, deliver the item immediately. If the window elapses with no attempt, score No Response and move on — this is a baseline probe, so no prompting or correction is delivered.",
      sd: "The preferred item itself, visible but out of reach — no verbal prompt is given during baseline.",
      measurement: {
        markCorrect:
          'A full-phrase request ("I want [item]") within 5 seconds of the item becoming visible.',
        markError:
          "An unclear or partial attempt (single word, gesture only, or an unintelligible approximation) within the window; if there is no attempt at all, score No Response instead.",
      },
      correction:
        "None during baseline — this card is being probed to establish a starting point, not taught in the moment. If probes show minimal spontaneous requesting, the team will introduce a prompting procedure in a future phase.",
      materials:
        "2-3 known preferred items (rotate to prevent satiation), identified via the most recent preference assessment.",
      instructionalNotes:
        'Keep your own language minimal during the window — resist the urge to prompt "What do you want?"; the point of baseline is to see what he does without support.',
    },
  },
  {
    id: "follows-one-step-direction",
    kind: "trial",
    title: "Follows one-step direction",
    phase: "Probing",
    description:
      "Score correct if the learner completes the direction independently. If an error occurs, record the least-to-most prompt level required.",
    // No minimum — demos the "end bar" divider + max-trials-reached state
    // instead of the usual minimum-trials quota.
    maxTrials: 8,
    promptLevels: ["Verbal", "Gestural", "Modeling", "Partial Physical", "Full Physical"],
    teachingProcedure: {
      goal: "Phineas will follow a novel one-step direction independently, needing no more than a gestural prompt, across 8 of 10 trials during probing.",
      rationale:
        "Direction-following is a foundational skill for group instruction and classroom routines; probing the current prompt level needed tells us exactly where to start formal teaching.",
      procedure:
        "Give the direction once, using natural tone and pacing, then wait 3-5 seconds. If he completes it, mark Independent. If he does not respond or responds incorrectly, deliver the least intrusive prompt in the hierarchy (Verbal, Gestural, Modeling, Partial Physical, Full Physical) just sufficient to get a correct response, and record that level.",
      sd: 'A one-step direction using vocabulary and objects already in his receptive repertoire (e.g., "Give me the block," "Stand up," "Touch your nose").',
      measurement: {
        markCorrect:
          "Completes the full direction within 3-5 seconds with no prompt beyond the original SD.",
        markError:
          "Does not respond within the window, or responds incorrectly — record the least-intrusive prompt level required to occasion the correct response.",
      },
      correction:
        "Not applicable in the traditional sense during probing — the prompt-level picker on this card IS the correction record. Deliver only the amount of help needed, then return to an independent SD on the next trial rather than staying at the prompted level.",
      materials:
        'A few familiar small objects for object-directed steps (a block, a cup, a favorite toy); none needed for body-directed steps like "stand up."',
      instructionalNotes:
        'Vary the specific direction between trials so he\'s generalizing "follow a one-step direction" and not just memorizing one script.',
    },
  },
  {
    id: "giggles-laughs",
    kind: "frequency",
    title: "Giggles/laughs during therapist-led play",
    phase: "Intervention",
    description: "Tally each instance the learner giggles or laughs during therapist-led play.",
    minCount: 5,
    teachingProcedure: {
      goal: "Increase Phineas's spontaneous giggling/laughing during therapist-led play to at least 5 instances per session, as an index of engagement and rapport.",
      rationale:
        "Laughter during play is a naturalistic marker of positive affect and engagement — tracking it helps confirm sessions are reinforcing, not just compliant, and flags when an activity has stopped being fun.",
      procedure:
        "Tally each spontaneous giggle or laugh that occurs during therapist-led play (not during data-collection trials themselves). No prompting is used — this is an observational count of a naturally occurring behavior, not a taught skill.",
      sd: "None — this is passively observed during ongoing play, not evoked by a specific instruction.",
      measurement: {
        markCorrect:
          "Any audible giggle or laugh clearly directed at or arising from the shared play interaction.",
        markError: 'Not applicable — there is no "incorrect" laugh; only tally occurrences.',
      },
      correction:
        "None — nothing to correct. If the count is consistently low across sessions, that's a signal to revisit the activity choice or pacing, not the child's response.",
      instructionalNotes:
        "If laughter seems forced or scripted rather than spontaneous, use clinical judgment and don't tally it — the goal is genuine engagement, not a performance.",
    },
  },
  {
    id: "flopping-dropping",
    kind: "rate",
    title: "Flopping/dropping to floor",
    behaviorRole: "interfering",
    phase: "Baseline",
    description:
      "During a timed observation, tally each flop/drop. Rate is reported as occurrences per minute.",
    teachingProcedure: {
      goal: "Reduce Phineas's flopping/dropping-to-floor behavior to fewer than 1 occurrence per minute across a timed observation, as it currently interferes with transitions and participation.",
      rationale:
        "Flopping is believed to function as escape from task demands or transitions; tracking rate (not just raw count) lets us compare across sessions of different lengths and see if antecedent strategies are reducing it.",
      procedure:
        "During the timed observation window, do not stop data collection when a flop occurs — tally it and continue. If a flop happens during a demand, briefly wait it out (planned ignoring for the behavior itself) while keeping the original expectation active, then represent the demand once he's up.",
      sd: "Typically evoked by a transition cue or a non-preferred task demand — note the antecedent in session notes when possible, even though this card only tracks rate.",
      measurement: {
        markCorrect:
          "He goes limp or intentionally drops to the floor, refusing to remain upright.",
        markError: "An accidental stumble/trip, or sitting down normally when instructed to do so.",
      },
      correction:
        "Do not deliver attention or comment in the moment (planned ignoring for the behavior itself). Keep the original demand or transition expectation active and calmly restate it once he's back up, rather than dropping it.",
      instructionalNotes:
        "This card's timer is a plain observation window, not linked to the session clock — start/stop it to bound a specific block you want rate data for, not necessarily the whole session.",
    },
  },
  {
    id: "uses-aac-to-request",
    kind: "rate",
    title: "Uses AAC to request",
    phase: "Maintenance",
    description: "Tally each independent AAC request. This timer is linked to the session timer.",
    minDurationSec: 60,
    locked: true,
    teachingProcedure: {
      goal: "Increase Phineas's independent AAC-mediated requests to at least 1 per minute across the session, as his primary functional communication mode.",
      rationale:
        "Consistent AAC use is the foundation for reducing frustration-driven behavior and building a communication repertoire that will scale as vocabulary grows.",
      procedure:
        "Throughout the session, tally each independent, unprompted use of the AAC device to request an item, activity, or break. This timer is linked to the session clock, so it's always running whenever a session is — there's no separate start/stop for it.",
      sd: "Naturally occurring motivation across the session — a desired item in view, a preferred activity ending, or a demand he'd like a break from — rather than a single scripted prompt.",
      measurement: {
        markCorrect:
          "An independent tap/selection on the AAC device that functions as a request, with no verbal or physical prompt beforehand.",
        markError:
          "A prompted or modeled selection (hand-over-hand, or after a verbal model of the exact request) — valuable, but not counted toward the independent rate.",
      },
      correction:
        "If he doesn't initiate but seems to want something, model the request on the device without requiring him to imitate it, then wait — don't tally that instance, but do reinforce access to what he wanted.",
      materials: "His AAC device, charged and within reach at all times.",
      instructionalNotes:
        "Because this timer tracks the whole session, rate naturally dips during highly structured discrete-trial blocks — that's expected, not a regression.",
    },
  },
  {
    id: "property-destruction-throwing",
    kind: "frequency",
    title: "Property destruction/throwing",
    behaviorRole: "interfering",
    phase: "Baseline",
    description:
      "Tally each instance the learner throws or destroys property, including books, toys, or furniture.",
    minCount: 3,
    teachingProcedure: {
      goal: "Reduce Phineas's property destruction/throwing to fewer than 3 instances per session.",
      rationale:
        "Throwing and destroying materials disrupts sessions, poses a safety risk to peers and staff, and is believed to serve an escape or attention function that a replacement behavior can address instead.",
      procedure:
        "Tally each instance as it occurs. Do not stop data collection to address the behavior — score it, then respond per the correction procedure and continue the session.",
      sd: "Most often evoked by a non-preferred task being presented or a preferred item/activity being removed or denied.",
      measurement: {
        markCorrect:
          "Any throw, sweep, or forceful destruction of materials directed away from his own body.",
        markError:
          "Normal manipulation of materials during play (e.g., building then knocking down blocks as part of the game itself).",
      },
      correction:
        "Block the trajectory or move materials out of reach if safety requires it, but avoid extended verbal attention. Once calm, represent the original task/demand rather than letting the throw successfully end it.",
      instructionalNotes:
        "If throwing reliably follows removal of a specific preferred item, flag it for the team — a scheduled, predictable transition warning may reduce the antecedent altogether.",
    },
  },
  {
    id: "self-injury-banging-head",
    kind: "rate",
    title: "Self Injury/Banging Head",
    behaviorRole: "interfering",
    phase: "Intervention",
    description:
      "During a timed observation, tally each head-banging instance. Rate is reported as occurrences per minute.",
    teachingProcedure: {
      goal: "Reduce Phineas's head-banging to fewer than 1 occurrence per minute across a timed observation, prioritized as a safety-critical target.",
      rationale:
        "Head-banging carries immediate physical risk and is tracked by rate (not just count) so intensity/frequency changes are visible across observations of different lengths.",
      procedure:
        "Tally a new instance once forceful head contact has continued for at least 10 seconds — a single isolated bang that doesn't repeat or continue isn't tallied on its own. If intensity poses immediate risk of injury, prioritize safety (see Correction) over waiting to observe — data accuracy never overrides safety.",
      sd: "Review the BCBA's current hypothesis in the full behavior plan before running this card — antecedents vary and matter for intervention, even though this card only tracks rate.",
      measurement: {
        markCorrect:
          "Forceful head contact sustained for at least 10 seconds (onset) — count it as one instance regardless of how many individual bangs occur within that stretch, or within a following gap shorter than 60 continuous seconds.",
        markError:
          "A single forceful contact that doesn't repeat or continue for 10 seconds, or a resumption after a full 60-second gap with no head-banging has already closed the instance out (offset) — that's a new instance, not a continuation of the last one.",
      },
      correction:
        "Follow the safety plan's protective procedure immediately (protective equipment/blocking as trained) — do not wait for a natural pause to intervene. Log the instance once safe to do so.",
      materials:
        "Any protective equipment specified in the Safety Plan (see the Client Info tab's About Me section).",
      instructionalNotes:
        "Onset/offset thresholds: 10 continuous seconds before an instance counts, 60 continuous quiet seconds before it closes out — a recurrence within that 60-second window is still the same instance, not a new tally. Never delay the safety response to make this judgment call, though — under-count rather than wait.",
    },
  },
  {
    id: "tantruming",
    kind: "duration",
    title: "Tantruming",
    behaviorRole: "interfering",
    phase: "Intervention",
    description:
      "Track each tantrum instance separately. Start a new instance with the plus button; pause/resume the current instance with the play/pause button.",
    teachingProcedure: {
      goal: "Reduce the total duration of Phineas's tantrums to less than 2 cumulative minutes per session.",
      rationale:
        "Duration (not just count) captures both how often tantrums occur and how long they last — useful since intervention can shorten episodes even before it reduces their frequency.",
      procedure:
        "Start the timer with the plus button once crying, dropping, or refusal has continued for at least 10 seconds (onset) — don't start it for a brief flash of protest. Pause/resume through any lull shorter than 60 continuous seconds; only start a NEW instance if a full 60 seconds passes with no tantrum behavior (offset) and it resumes afterward.",
      sd: "Commonly follows a denied request, an ended preferred activity, or an unexpected transition.",
      measurement: {
        markCorrect:
          "Crying/distress/refusal sustained for at least 10 continuous seconds — the same instance keeps running through any gap shorter than 60 continuous seconds.",
        markError:
          "A protest that never reaches 10 continuous seconds, or a resumption after a full 60-second gap has already closed the instance out — that starts a new instance instead of extending the old one.",
      },
      correction:
        "Keep instructions minimal and avoid negotiating during the episode. Once he's calm for a sustained moment, redirect to the original expectation rather than dropping it.",
      instructionalNotes:
        "Onset/offset thresholds: 10 continuous seconds before starting the timer, 60 continuous quiet seconds before the instance is considered over. If a tantrum resumes within that 60-second window, keep the same instance running (pause/resume) instead of closing it out and starting a new one.",
    },
  },
  {
    id: "tolerates-sitting-social-group",
    kind: "duration",
    title: "Tolerates sitting in social group",
    phase: "Maintenance",
    description:
      "Track each interval the learner remains seated with the social group. Start a new instance when they rejoin.",
    minDurationSec: 60,
    teachingProcedure: {
      goal: "Increase the duration Phineas remains seated with the social group to a full 10-minute activity without leaving the seated area.",
      rationale:
        "Tolerating group seating is a prerequisite for participating in classroom circle time and other group instruction settings he'll encounter outside of 1:1 sessions.",
      procedure:
        "Start the timer when the group activity begins and he is seated. If he gets up and leaves the seated area, pause the timer; start a new instance once he rejoins and is seated again.",
      sd: 'The group activity starting, with a seat available and the group already gathered (e.g., "Let\'s sit down for circle time").',
      measurement: {
        markCorrect:
          "Remains within the designated seated area, even if shifting position or briefly standing and immediately re-sitting.",
        markError:
          "Fully leaves the seated area (stands and walks away) rather than staying within it.",
      },
      correction:
        "If he gets up, calmly guide him back to the seated area and represent the activity rather than ending it. Avoid making the return trip more engaging than the group activity itself.",
      materials:
        'Whatever the group activity requires (see the day\'s activity plan); a designated seat or mat to define "the seated area."',
      instructionalNotes:
        "Reinforcement should come from the group activity itself where possible (praise, a preferred song, a turn) rather than an unrelated reward, so sitting stays connected to the activity's own value.",
    },
  },
  {
    id: "washing-hands",
    kind: "task-analysis",
    title: "Washing hands",
    phase: "Probing",
    description:
      "Score each step as Independent (I), Prompted (P), or Error (E). Taught backward — the last step was mastered first, and training is now working back toward the first.",
    steps: [
      "Turn on water",
      "Wet hands",
      "Apply soap",
      "Scrub for 20 seconds",
      "Rinse hands",
      "Turn off water",
      "Dry hands",
    ],
    chainingDirection: "backward",
    // Mastery cascades backward from the last step — steps taught longest
    // ago (the end of the chain) are expected independent, while earlier
    // steps (not yet reached) still need the most support.
    stepPlan: [
      "Full Physical",
      "Full Physical",
      "Partial Physical",
      "Partial Physical",
      "Gestural",
      "Verbal",
      "Independent",
    ],
    teachingProcedure: {
      goal: "Phineas will complete the 7-step hand-washing sequence with no more than 1 prompted step, across 3 consecutive probes.",
      rationale:
        "Hand-washing is a daily-living skill needed for hygiene and increasing independence at school and home; task analysis lets us pinpoint exactly which step(s) still need support.",
      procedure:
        "Present each step in sequence, waiting 3-5 seconds for a response before scoring or prompting. Score each step Independent (I), Prompted (P), or Error (E) as you go, and move to the next step regardless of how the current one was scored.",
      sd: '"Wash your hands" at the sink, given once at the start of the sequence — no further verbal SD is given per step; each step\'s own natural cue (e.g., water now running) should occasion the next action.',
      measurement: {
        markCorrect: "Completes the step within the window with no prompt beyond the initial SD.",
        markError:
          "Does not attempt the step, or attempts it incorrectly, within the window with no prompt given in that moment (contrast with Prompted, used when help was given).",
      },
      correction:
        "For a Prompted score, use the least intrusive prompt that gets the step done (a gesture toward the soap, a verbal reminder, or physical guidance for a step like scrubbing) and move on to the next step — don't repeat the whole sequence from the start.",
      materials:
        "Accessible sink, soap, and a towel within reach; step stool if needed for sink height.",
      instructionalNotes:
        "Steps often regress in the same order they were mastered under stress/fatigue — if a normally-independent step slips to Prompted, note it rather than assuming it's a one-off.",
    },
  },
  {
    id: "brushing-teeth",
    kind: "task-analysis",
    title: "Brushing teeth",
    phase: "Intervention",
    description:
      "Score each step as Independent (I), Prompted (P), or Error (E). If prompted, record the least-to-most prompt level required. Taught forward — the first step was mastered first.",
    steps: [
      "Get toothbrush and toothpaste",
      "Apply toothpaste to brush",
      "Brush outer surfaces",
      "Brush inner surfaces",
      "Brush chewing surfaces",
      "Rinse mouth",
      "Rinse toothbrush",
    ],
    chainingDirection: "forward",
    // Mastery cascades forward from the first step — the opposite of
    // Washing hands, to demo both directions side by side.
    stepPlan: [
      "Independent",
      "Verbal",
      "Gestural",
      "Partial Physical",
      "Partial Physical",
      "Full Physical",
      "Full Physical",
    ],
    promptLevels: ["Verbal", "Gestural", "Modeling", "Partial Physical", "Full Physical"],
    teachingProcedure: {
      goal: "Phineas will complete the 7-step tooth-brushing sequence with no more than 1 prompted step, across 3 consecutive probes.",
      rationale:
        "Tooth-brushing is a daily-living self-care skill needed for oral hygiene and independence at home; task analysis lets us pinpoint exactly which step(s) still need support.",
      procedure:
        "Present each step in sequence, waiting 3-5 seconds for a response before scoring or prompting. Score each step Independent (I), Prompted (P), or Error (E); for a Prompted step, also record the least-to-most prompt level required (Verbal through Full Physical) before moving to the next step regardless of how the current one was scored.",
      sd: '"Brush your teeth" at the sink, given once at the start of the sequence — no further verbal SD is given per step; each step\'s own natural cue (e.g., toothpaste already on the brush) should occasion the next action.',
      measurement: {
        markCorrect: "Completes the step within the window with no prompt beyond the initial SD.",
        markError:
          "Does not attempt the step, or attempts it incorrectly, within the window with no prompt given in that moment (contrast with Prompted, used when help was given).",
      },
      correction:
        "For a Prompted score, select the least intrusive prompt level that gets the step done (Verbal through Full Physical) and move on to the next step — don't repeat the whole sequence from the start.",
      materials:
        "Toothbrush, toothpaste, and an accessible sink or cup; step stool if needed for sink height.",
      instructionalNotes:
        "Mastery is expected to cascade forward from the first step (the opposite order from Washing hands) — if an early, normally-independent step slips to Prompted, treat it as a real regression rather than noise.",
    },
  },
  {
    id: "overall-session-engagement",
    kind: "rating",
    title: "Overall session engagement",
    phase: "Intervention",
    description:
      "A holistic, end-of-session quality score capturing overall engagement and cooperation. Unlike the other cards, this is scored once — later interactions simply update the same score rather than adding new entries.",
    max: 5,
    levelDescriptions: [
      "Highly resistant; required significant redirection throughout the session.",
      "Engaged briefly; needed frequent prompts to reorient to tasks.",
      "Adequate engagement with occasional prompting.",
      "Consistently engaged with minimal prompting.",
      "Fully engaged and cooperative throughout the session.",
    ],
    teachingProcedure: {
      goal: "Track Phineas's overall session engagement each session so the team can spot trends across activities, staff, or phases, rather than relying on memory of how a session generally felt.",
      rationale:
        "A single holistic engagement score, tracked consistently over time, surfaces trends that trial-by-trial accuracy data can't on its own — e.g. engagement quietly declining across a specific activity or time of day even while accuracy holds steady.",
      procedure:
        "Score once, at the end of the session, based on your overall impression of Phineas's engagement and cooperation across the whole session — not tied to any single trial or activity. Updating the score later in the session simply overwrites the current score rather than adding a new entry.",
      // No SD, Correction, or Materials — a holistic end-of-session rating
      // has no single discriminative stimulus that occasions it, no single
      // incorrect response to correct, and nothing to gather beforehand,
      // the way a scored trial does. Overridden by the card's own level
      // descriptions at render time — this placeholder only exists to
      // satisfy the shared type.
      measurement: { scale: [] },
      instructionalNotes:
        "Score the session as a whole, not just how it ended — a strong finish after a rocky start shouldn't erase the rocky start, and vice versa.",
    },
  },
  {
    id: "readiness-to-learn",
    kind: "rating",
    title: "Readiness to learn",
    phase: "Intervention",
    description:
      "A quick end-of-session read on how available the learner was for instruction. Same single-score behavior as Overall session engagement — later interactions update this same score rather than adding new entries.",
    max: 3,
    levelDescriptions: [
      "Not ready — dysregulated or unresponsive to redirection for most of the session.",
      "Partially ready — needed regulation support before engaging productively.",
      "Fully ready — regulated and available for instruction from the start.",
    ],
    teachingProcedure: {
      goal: "Track Phineas's readiness to learn each session so the team can spot patterns (time of day, staff, preceding activities) that predict a harder start, rather than treating every rough session as unrelated.",
      rationale:
        "A learner who isn't regulated can't access instruction no matter how good the teaching procedure is — this score gives the team an at-a-glance signal for whether a low session total reflects the plan or the state the learner arrived in.",
      procedure:
        "Score once, at the end of the session, based on your overall impression of how available Phineas was for instruction — not tied to any single trial or activity. Updating the score later in the session simply overwrites the current score rather than adding a new entry.",
      // No SD, Correction, or Materials — a holistic end-of-session rating
      // has no single discriminative stimulus that occasions it, no single
      // incorrect response to correct, and nothing to gather beforehand,
      // the way a scored trial does. Overridden by the card's own level
      // descriptions at render time — this placeholder only exists to
      // satisfy the shared type.
      measurement: { scale: [] },
      instructionalNotes:
        'Rate what you observed, not what you hoped for — a generous "Fully ready" on a rough session makes the data less useful for spotting real patterns.',
    },
  },
  {
    id: "remains-dry",
    kind: "timestamp",
    title: "Remains dry for 1.5 Hrs",
    phase: "Intervention",
    description:
      "Score the current interval Dry if he was dry at the check, Wet/Soiled if there was an accident. The interval shown is locked to session time — you can only score whichever one is happening right now. Runs the whole session on a 30-minute check schedule.",
    intervalMin: 30,
    positiveLabel: "Dry",
    negativeLabel: "Wet/Soiled",
    teachingProcedure: {
      goal: "Phineas will remain dry through every 30-minute check across 3 consecutive sessions.",
      rationale:
        "Time-sampling at fixed intervals (rather than only logging accidents) gives a true dry/wet rate instead of just an accident count, since a session with no logged accident could still mean nobody checked.",
      procedure:
        "At each interval's check, ask him to tell you if he's dry or take him to the bathroom to check directly, then score that interval before moving on — the next interval starts automatically at the 30-minute mark regardless of when you scored the current one.",
      sd: "The interval boundary arriving (see the timeline's blue marker) — not a request from the learner.",
      measurement: {
        markCorrect: "Dry at the time of the check, for the entire interval being scored.",
        markError: "A wet/soiled accident occurred at any point during the interval being scored.",
      },
      correction:
        "For an accident, follow the standard bathroom/change routine calmly and without extended attention, then resume the schedule at the next interval — don't re-score the interval that already closed out.",
      materials: "Change of clothes, standard bathroom supplies.",
      instructionalNotes:
        "Only the current interval (locked to session time) can be scored — if a check is missed, that interval is simply left blank rather than back-filled once the next one has already started.",
    },
  },
];

// Data-submitted animation timing — TODO: surface in user settings.
const DATA_SUBMIT_STAGGER_MS = 90;
const DATA_SUBMIT_ENTER_DURATION_MS = 550;
const DATA_SUBMIT_EXIT_DURATION_MS = 550;

// How long into a session before the demo fires its one illustrative
// "goal changed" notification — long enough that it reads as something
// that happened DURING the session rather than an artifact of starting it,
// short enough that a live walkthrough doesn't have to wait long to show
// it off.
const GOAL_CHANGE_DEMO_DELAY_MS = 30_000;

/** Renders nothing — just fires one illustrative goal-change notification
 *  a fixed delay into each fresh session, so a live demo has something
 *  concrete and well-timed to point at (see NOTIFICATION_CATEGORIES'
 *  own comment on why this exists rather than firing at random). Mounted
 *  inside NotificationProvider so it can push; keyed on resetSignal so it
 *  fires once per genuinely new/continued session, not on every pause and
 *  resume in between. */
function GoalChangeDemoTrigger() {
  const { push } = useNotifications();
  const { status, resetSignal } = useSession();
  const firedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "running" || firedForRef.current === resetSignal) return;
    const id = window.setTimeout(() => {
      firedForRef.current = resetSignal;
      push({
        kind: "goal-change",
        title: 'Phase Change: "Giggles/laughs during therapist-led play" moved to Maintenance.',
        body: "Updated by Baljeet Tjinder",
        icon: "target",
        sourceRef: { type: "goal", id: "giggles-laughs" },
      });
    }, GOAL_CHANGE_DEMO_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [status, resetSignal, push]);
  return null;
}

/** Renders nothing — pushes the two lifecycle notifications the session
 *  states call for: confirming a join (state 2's "handoff without explicit
 *  requests"), and flagging a running session nobody's currently in (state
 *  4, "abandoned" — standing in for the half-hour text/email reminder to
 *  the last staff member, since there's no other simulated user here to
 *  actually receive it). Mounted alongside GoalChangeDemoTrigger, for the
 *  same reason: SessionContext sits above NotificationProvider and can't
 *  push directly (see that provider's own nesting in Index below). */
function SessionActivityTrigger() {
  const { push } = useNotifications();
  const { status, isSessionMine, startedById } = useSession();
  const joinedRef = useRef(false);

  useEffect(() => {
    const joinedSomeoneElses =
      status === "running" && isSessionMine && !!startedById && startedById !== CURRENT_STAFF_ID;
    if (joinedSomeoneElses && !joinedRef.current) {
      joinedRef.current = true;
      const starterName = staffName(startedById);
      push({
        kind: "announcement",
        title: `You joined ${starterName}'s session`,
        body: `${starterName} has been notified that you joined.`,
        icon: "megaphone",
        // Just a confirmation, not something to act on — fades on its own
        // (general notifications' own default auto-fade, see
        // NotificationContext's push()) rather than sitting there until
        // dismissed. ...and once it's gone, it's gone — not something worth
        // digging back up in the Notifications tab's own persistent history
        // later.
        excludeFromHistory: true,
      });
    } else if (!joinedSomeoneElses) {
      joinedRef.current = false;
    }
  }, [status, isSessionMine, startedById, push]);

  return null;
}

type Screen = "welcome" | "main";

// Same push/pop feel either direction: welcome exits left as main enters
// from the right (Get Started), and the exact reverse — main exits right,
// welcome re-enters from the left — going back. Both panels share this one
// duration/ease so they move in lockstep (constant 100%-of-viewport gap
// between them throughout), the same standard-ease constant NotificationBar
// already uses elsewhere for area transitions.
const SCREEN_SLIDE_MS = 450;
const SCREEN_SLIDE_EASE = NOTIFICATION_AREA_TRANSITION.ease;

function Index() {
  const [screen, setScreen] = useState<Screen>("welcome");
  // True only for the ~450ms the slide is actually animating. IndexInner
  // (and all its providers — session state, timers, sound-on-mount effects)
  // mounts exactly once and stays mounted regardless of which screen is
  // showing, so toggling back and forth never re-randomizes the session
  // simulator or replays the startup sound. At rest, the inactive screen is
  // just `display: none` (zero layout/scroll footprint, no risk to
  // StatusBar's sticky header or this file's own window.scrollTo/scrollBy
  // wiring below); mid-slide, both screens are briefly `position: fixed`
  // full-viewport layers (which — unlike a translated normal-flow element —
  // don't contribute scrollable overflow to any ancestor, so this never
  // needs an `overflow-x: hidden` wrapper that could interfere with sticky
  // positioning). Once settled, the "main" screen's own wrapper carries no
  // fixed/transform styling at all — identical to how `<main>` rendered
  // before this screen existed.
  const [transitioning, setTransitioning] = useState(false);
  // Set by WelcomeScreen's "Preview guided tour" escape hatch, consumed
  // (reset false) by TourProvider the instant it force-starts off it — see
  // that component's own comment. Plain state here, not a ref, since
  // setting it needs to be visible to IndexInner/TourProvider on the very
  // next render (the same one that starts the screen-slide).
  const [forceTourLaunch, setForceTourLaunch] = useState(false);
  // Same idea as forceTourLaunch, but for the "Did you know?" tip
  // rotation's own WelcomeScreen escape hatch — see TipContext's comment.
  const [forceTipLaunch, setForceTipLaunch] = useState(false);

  const goToMain = () => {
    setTransitioning(true);
    setScreen("main");
  };
  const goToWelcome = () => {
    setTransitioning(true);
    setScreen("welcome");
  };
  const launchTourFromWelcome = () => {
    setForceTourLaunch(true);
    goToMain();
  };
  const launchTipFromWelcome = () => {
    setForceTipLaunch(true);
    goToMain();
  };

  // Always fixed + stacked above everything else while it's the active (or
  // mid-transition) screen — not just during the transition the way `main`
  // is below. Unlike `<main>`, welcome has no window.scrollTo/scrollBy
  // wiring to preserve, so there's no reason to ever let it settle back
  // into plain document flow — and it needs to, since `main` (and anything
  // it portals — DataDetailsDrawer's pull tab, dialogs, etc.) stays mounted
  // underneath it the whole time. A settled `{}` here left main's own
  // fixed-positioned portals (all higher than plain in-flow content's
  // implicit stacking layer) showing through on top of it.
  // Rising edge (false -> true) is exactly "the welcome->main slide just
  // finished landing on main" — the precise, purpose-built signal
  // TourProvider auto-launches the guided tour off (see its own comment on
  // why this, not useInitialLayoutSettled, which tracks an unrelated
  // stability concern). `onAnimationComplete` below fires on BOTH slide
  // directions (including the header's back button), so this also needs
  // the `screen === "main"` check, not `!transitioning` alone.
  const mainSettled = screen === "main" && !transitioning;

  const welcomeStyle: React.CSSProperties =
    transitioning || screen === "welcome"
      ? { position: "fixed", inset: 0, zIndex: 200 }
      : { display: "none" };
  const mainStyle: React.CSSProperties = transitioning
    ? { position: "fixed", inset: 0 }
    : screen === "main"
      ? {}
      : { display: "none" };

  return (
    <>
      <motion.div
        style={welcomeStyle}
        initial={false}
        animate={{ x: screen === "welcome" ? "0%" : "-100%" }}
        transition={{ duration: SCREEN_SLIDE_MS / 1000, ease: SCREEN_SLIDE_EASE }}
      >
        <WelcomeScreen
          onGetStarted={goToMain}
          onLaunchTour={launchTourFromWelcome}
          onLaunchTip={launchTipFromWelcome}
        />
      </motion.div>

      <motion.div
        style={mainStyle}
        initial={false}
        animate={{ x: screen === "main" ? "0%" : "100%" }}
        transition={{ duration: SCREEN_SLIDE_MS / 1000, ease: SCREEN_SLIDE_EASE }}
        onAnimationComplete={() => setTransitioning(false)}
      >
        <SettingsProvider>
          <SessionProvider>
            <DataToolbarProvider>
              {/* Above the whole card list, so its store survives the per-card
                  remounts that MorphContent's display-mode crossfade causes
                  below it (see CardDataStore's own comment). */}
              <CardDataStoreProvider>
                {/* Outside the Schedule tab's own conditional render (which
                    mounts/unmounts ScheduleView on every tab switch) so
                    Phineas' Schedule's appointments survive leaving the tab —
                    ClientInfoPane's Related Service Times row reads them too,
                    and would otherwise flash back to the seed data every time
                    Schedule wasn't the active tab. */}
                <ScheduleProvider>
                  <IndexInner
                    onBack={goToWelcome}
                    mainSettled={mainSettled}
                    forceTourLaunch={forceTourLaunch}
                    onForceTourLaunchHandled={() => setForceTourLaunch(false)}
                    forceTipLaunch={forceTipLaunch}
                    onForceTipLaunchHandled={() => setForceTipLaunch(false)}
                  />
                </ScheduleProvider>
              </CardDataStoreProvider>
            </DataToolbarProvider>
          </SessionProvider>
        </SettingsProvider>
      </motion.div>
    </>
  );
}

const CARD_KINDS_IN_ORDER: CardKind[] = [
  "trial",
  "frequency",
  "rate",
  "duration",
  "task-analysis",
  "rating",
  "timestamp",
];

// Clinical progression order, not the cards' own declaration order — the
// filter popover's Phase chips should read left-to-right the way a plan
// actually moves through them. Any phase not in this list (typos, future
// additions) sorts after, alphabetically, rather than silently vanishing.
const PHASE_ORDER = ["Probing", "Baseline", "Intervention", "Maintenance"];

// Search-only label per kind — mirrors DataToolbar's own KIND_META labels
// (kept as a separate, plain-string copy here rather than importing that
// file's version, since that one's tied to its icon renderers) so
// searching "task analysis" or "percent correct" matches what the kind
// filter chips actually call it, not the internal "task-analysis"/"trial"
// slug.
const SEARCH_KIND_LABELS: Record<CardKind, string> = {
  trial: "Percent Correct",
  frequency: "Frequency",
  rate: "Rate",
  duration: "Duration",
  "task-analysis": "Task Analysis",
  rating: "Score",
  timestamp: "Timestamp",
};

const CUSTOM_CARDS_STORAGE_KEY = "aba-daba-custom-cards-v1";

// Cards created via Settings' "Add New Card" flow, persisted separately from
// BUILT_IN_CARDS above (which never changes) — same loaded-once-on-mount,
// saved-on-change idiom DataToolbarContext already uses for favorites/
// hidden/order, just for the card definitions themselves rather than
// presentation state layered on top of them.
function loadCustomCards(): CardConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardConfig[]) : [];
  } catch {
    return [];
  }
}

function getVisibleCards(
  cards: CardConfig[],
  order: string[],
  filters: DataToolbarFilters,
  searchQuery: string,
  favorites: Set<string>,
  hidden: Set<string>,
  hasData: Record<string, boolean>,
  completion: Record<string, boolean>,
  editMode: boolean,
): CardConfig[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const orderedIds =
    order.length > 0
      ? [
          ...order.filter((id) => byId.has(id)),
          ...cards.map((c) => c.id).filter((id) => !order.includes(id)),
        ]
      : cards.map((c) => c.id);
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((c): c is CardConfig => c !== undefined);

  const q = searchQuery.trim().toLowerCase();
  return ordered.filter((card) => {
    // Hidden cards mirror After Effects' shy layers: they stay visible while
    // editing (so there's a way to find and un-hide them) but otherwise only
    // show when the "Show hidden" filter is on.
    if (!editMode && hidden.has(card.id) && !filters.showHidden) return false;
    if (filters.favoritesOnly && !favorites.has(card.id)) return false;
    if (filters.kinds.size > 0 && !filters.kinds.has(card.kind)) return false;
    if (filters.phases.size > 0 && !filters.phases.has(card.phase)) return false;
    if (filters.dataFilter === "with-data" && !hasData[card.id]) return false;
    if (filters.dataFilter === "no-data" && hasData[card.id]) return false;
    if (filters.completionFilter === "reached" && !completion[card.id]) return false;
    if (filters.completionFilter === "incomplete" && completion[card.id]) return false;
    if (filters.behaviorFilter !== "both") {
      const role = card.behaviorRole ?? "target";
      if (role !== filters.behaviorFilter) return false;
    }
    // Beyond the title: phase, kind (by its display label, not the raw
    // "task-analysis" slug), description, and — for task-analysis cards —
    // each individual step. Searching "soap" finds the "Washing hands"
    // card via its "Apply soap" step even though the title itself never
    // says soap — another way to reach the same card besides the kind/
    // phase filter toggles above, not a replacement for them.
    if (q) {
      const haystack = [card.title, card.phase, SEARCH_KIND_LABELS[card.kind], card.description];
      if (card.kind === "task-analysis") haystack.push(...card.steps);
      if (!haystack.some((s) => s.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

// Same manual-order-then-append idiom as getVisibleCards' own ordering
// block above, applied for the bookmark bar's two lists — deliberately
// independent of the main toolbar's own `filters`/`searchQuery` state, so
// switching the bar's corner toggle never touches (or is touched by) what
// the main list is currently showing. Hidden cards are excluded outright
// (not gated behind a "show hidden" toggle of the bar's own) — same
// "hidden wins over favorited" precedent getVisibleCards already applies.
function getOrderedCards(
  cards: CardConfig[],
  order: string[],
  predicate: (c: CardConfig) => boolean,
): CardConfig[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const orderedIds =
    order.length > 0
      ? [
          ...order.filter((id) => byId.has(id)),
          ...cards.map((c) => c.id).filter((id) => !order.includes(id)),
        ]
      : cards.map((c) => c.id);
  return orderedIds
    .map((id) => byId.get(id))
    .filter((c): c is CardConfig => c !== undefined)
    .filter(predicate);
}

// Native `scrollIntoView({block: "center"})` centers an element against the
// full scroll container, with no way to bias that centering — it always
// splits the leftover space evenly above and below. Centering by hand here
// instead lets the clamp below keep a card taller than the container from
// having its own top (title) pushed up out of view.
function scrollActiveCardIntoView(el: HTMLElement, container: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const desiredCenterY = containerRect.top + container.clientHeight / 2;
  const currentCenterY = rect.top + rect.height / 2;
  const maxDelta = rect.top - containerRect.top;
  const delta = Math.min(currentCenterY - desiredCenterY, maxDelta);
  container.scrollBy({ top: delta, behavior: "smooth" });
}

// The default (setting off) counterpart to scrollActiveCardIntoView above —
// only the minimum nudge needed to bring a partially-hidden card fully on
// screen, not a forced recenter. A no-op if the card's already fully
// visible within the container.
function scrollCardFullyIntoView(el: HTMLElement, container: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const visibleTop = containerRect.top;
  const visibleBottom = containerRect.bottom;
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;
  // Taller than the room available in the container — no scroll amount can
  // satisfy both edges, so just lead with the top (matches how a browser's
  // own "nearest" falls back when the target doesn't fit either).
  if (rect.height > visibleBottom - visibleTop || rect.top < visibleTop) {
    container.scrollBy({ top: rect.top - visibleTop, behavior: "smooth" });
  } else if (rect.bottom > visibleBottom) {
    container.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
  }
}

const DISPLAY_MODE_GRID_CLASSES: Record<DisplayMode, string> = {
  // Tighter than card's gap-3 — a condensed list reads better with its rows
  // sitting close together rather than spaced like full cards.
  list: "grid-cols-1 gap-1",
  card: "grid-cols-1 sm:grid-cols-2 gap-3",
  // Quick-action tiles are deliberately mobile-first multi-column (unlike
  // list/card's single column on narrow viewports) — the whole point is
  // fitting several at once on a phone screen, not just at sm+.
  "grid-large": "grid-cols-2 gap-2",
  "grid-small": "grid-cols-3 gap-1.5",
};

function IndexInner({
  onBack,
  mainSettled,
  forceTourLaunch,
  onForceTourLaunchHandled,
  forceTipLaunch,
  onForceTipLaunchHandled,
}: {
  onBack: () => void;
  mainSettled: boolean;
  forceTourLaunch: boolean;
  onForceTourLaunchHandled: () => void;
  forceTipLaunch: boolean;
  onForceTipLaunchHandled: () => void;
}) {
  // See BUILT_IN_CARDS/loadCustomCards' own comments. Starts empty (not a
  // lazy useState(() => loadCustomCards())) so the client's first render
  // matches the server's — loading actually happens in the effect below,
  // same SSR-safe idiom DataToolbarContext uses for favorites/hidden/order.
  const [customCards, setCustomCards] = useState<CardConfig[]>([]);
  useEffect(() => {
    setCustomCards(loadCustomCards());
  }, []);
  // Guards the save effect below against writing back the empty initial
  // state on the very first render, before the load effect above has had a
  // chance to actually populate customCards — without this, every fresh
  // page load would silently wipe out anything persisted.
  const hasLoadedCustomCardsRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedCustomCardsRef.current) {
      hasLoadedCustomCardsRef.current = true;
      return;
    }
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(customCards));
  }, [customCards]);
  const cards = useMemo(() => [...BUILT_IN_CARDS, ...customCards], [customCards]);
  const addCard = useCallback((card: CardConfig) => {
    setCustomCards((prev) => [...prev, card]);
  }, []);

  const [activeId, setActiveId] = useState<string>(cards[0].id);
  // See the scroll-into-view effect's own comment below — flipped true just
  // before a bookmark-bar selection's own setActiveId, consumed by that
  // effect on its very next run.
  const suppressActiveScrollRef = useRef(false);
  const [tab, setTabState] = useState<StatusTab>("data");
  const [scheduleScrollId, setScheduleScrollId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Every drawer-open call site funnels through this one state var
  // regardless of which card/display mode triggered it, so this single
  // effect covers the "drawer slide" sound for all of them.
  useEffect(() => {
    if (drawerOpen) playSoundEffect("drawerSlide");
  }, [drawerOpen]);
  // Plays once on load — before any gesture exists, so stricter autoplay
  // policies are free to silently block it; that's an acceptable no-op
  // here, not an error (see playSoundEffect's own comment).
  useEffect(() => {
    playSoundEffect("startup");
  }, []);
  // Which of the drawer's two open widths is showing — lifted up here
  // (rather than left as DataDetailsDrawer's own local state) so it
  // survives a prev/next card switch, which remounts a fresh drawer
  // instance for the newly active card (see DataDetailsDrawer's own props
  // for the full explanation). Without this, dragging to full width and
  // then paging to the next card would snap the drawer back down to normal
  // width on every step.
  const [drawerWidthMode, setDrawerWidthMode] = useState<"normal" | "full">("normal");
  const { status, transitionStage, transitionKind } = useSession();
  // Paused counts as "active" too — a session still exists, it's just not
  // ticking. Gating this on "running" alone flashed the "Start session to
  // record data" banner and dimmed every card each time a session was
  // paused (only "idle" should read as no active session), which is what
  // was producing the tab/content-pane "bounce" on pause: the banner
  // sliding in and the cards dropping to half-opacity added an extra,
  // unrelated layout shift on top of the box's own expand animation.
  const sessionActive = status !== "idle";

  const stickyTop = useStickyTop();
  // The shared details drawer starts at stickyTop (the toolbar's own top)
  // so it slides out on top of the toolbar, not just the pane below it —
  // see DataDetailsDrawer. toolbarHeight is measured separately (rather
  // than measuring the toolbar's absolute position directly) since the
  // toolbar's own `top` can shift for reasons (status bar height changing)
  // that a resize observer on the toolbar itself wouldn't catch.
  const toolbarHeight = useElementHeight("[data-toolbar]");
  const { keepActiveCardCentered, tourHintsEnabled, tourCompleted, defaultTab } = useSettings();
  // Settings loads its persisted value asynchronously (see SettingsProvider),
  // so the very first render here still sees the pre-hydration default. Once
  // it lands, adopt it — but only until the user actually navigates away
  // from it themselves (a real click, a tour/tip step, "View Schedule",
  // etc. — every path already funnels through this one setTab), so picking
  // a new "default" mid-session doesn't yank an already-open session to a
  // different tab. Same idiom as DataToolbarProvider's own defaultDataView
  // adoption.
  const userChangedTabRef = useRef(false);
  useEffect(() => {
    if (!userChangedTabRef.current) setTabState(defaultTab);
  }, [defaultTab]);
  const setTab = useCallback((t: StatusTab) => {
    userChangedTabRef.current = true;
    setTabState(t);
  }, []);
  const {
    displayMode,
    setDisplayMode,
    editMode,
    setEditMode,
    searchQuery,
    filters,
    favorites,
    toggleFavorite,
    hidden,
    toggleHidden,
    order,
    setOrder,
    hasData,
    completion,
  } = useDataToolbar();
  // Rising edge is exactly "the tour is about to (or already did, via its
  // own forceLaunch) auto-launch" — see TipContext's own comment on why
  // this is threaded in as a single derived boolean rather than TipContext
  // reading TourContext directly.
  const tourWillAutoLaunch = forceTourLaunch || (tourHintsEnabled && !tourCompleted);

  const availableKinds = useMemo(
    () => CARD_KINDS_IN_ORDER.filter((k) => cards.some((c) => c.kind === k)),
    [cards],
  );
  const availablePhases = useMemo(() => {
    const present = new Set(cards.map((c) => c.phase));
    const known = PHASE_ORDER.filter((p) => present.has(p));
    const rest = Array.from(present)
      .filter((p) => !PHASE_ORDER.includes(p))
      .sort();
    return [...known, ...rest];
  }, [cards]);

  const visibleCards = useMemo(
    () =>
      getVisibleCards(
        cards,
        order,
        filters,
        searchQuery,
        favorites,
        hidden,
        hasData,
        completion,
        editMode,
      ),
    [cards, order, filters, searchQuery, favorites, hidden, hasData, completion, editMode],
  );

  // The bookmark bar's own two source lists — see getOrderedCards' own
  // comment on why these stay independent of the main toolbar's filters.
  const favoriteCards = useMemo(
    () => getOrderedCards(cards, order, (c) => favorites.has(c.id) && !hidden.has(c.id)),
    [cards, order, favorites, hidden],
  );
  const interferingCards = useMemo(
    () =>
      getOrderedCards(cards, order, (c) => c.behaviorRole === "interfering" && !hidden.has(c.id)),
    [cards, order, hidden],
  );
  // A card missing from this set is genuinely unmounted right now (filtered
  // out of the main list), not just scrolled off-screen — see
  // BookmarkChip's DurationChip for the one place this actually matters.
  const mountedIds = useMemo(() => new Set(visibleCards.map((c) => c.id)), [visibleCards]);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // The actual signal fed to DataDetailsDrawer's `open` (distinct from
  // `drawerOpen`, which drives the tile reflow in DataCardList) — for the
  // two grid modes, delayed until the reflow triggered by `drawerOpen` has
  // actually settled. Sequencing it this way means DataDetailsDrawer only
  // ever has to measure the target tile's position once (it's already at
  // its final spot by the time the drawer starts sliding), instead of
  // polling every frame to chase a still-moving target — that polling was
  // fighting the drawer's own spring for frames and reading as sluggish/
  // jerky. Card/list modes don't reflow on open, so there's nothing to wait
  // for there.
  const isGridDisplayMode = displayMode === "grid-large" || displayMode === "grid-small";
  const [drawerSlideOpen, setDrawerSlideOpen] = useState(false);
  const drawerSlideTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    window.clearTimeout(drawerSlideTimeoutRef.current ?? undefined);
    if (!drawerOpen) {
      setDrawerSlideOpen(false);
      return;
    }
    if (!isGridDisplayMode) {
      setDrawerSlideOpen(true);
      return;
    }
    drawerSlideTimeoutRef.current = window.setTimeout(
      () => {
        setDrawerSlideOpen(true);
        // The reflow just collapsed every tile into a single left column,
        // which can shift the active tile to a completely different row —
        // bring it back into view now that it's settled (respecting the same
        // centered-vs-gentle choice as the effect below), rather than leaving
        // it wherever the reflow happened to land it.
        const el = cardRefs.current.get(activeId);
        const container = dataContentRef.current;
        if (el && container) {
          if (keepActiveCardCentered) scrollActiveCardIntoView(el, container);
          else scrollCardFullyIntoView(el, container);
        }
      },
      CARD_MORPH_TRANSITION.duration * 1000 + 50,
    );
    return () => window.clearTimeout(drawerSlideTimeoutRef.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, isGridDisplayMode]);

  // Keep the active card centered whenever it's selected (opt-in — see the
  // Settings tab's "Keep active card centered" toggle) and, unconditionally,
  // whenever the display mode changes — switching from a single column to a
  // multi-column grid reflows every card's position, so without this the
  // active one can silently scroll off screen. With the setting off, still
  // gently nudge a partially-hidden active card fully into view (but never
  // force a full recenter) — becoming active shouldn't leave half of it
  // tucked behind the header or hanging off the bottom of the screen.
  // Shared by the effect below and by handleJumpFromBar, which can't rely
  // on the effect alone — see that function's own comment on why.
  const scrollActiveIntoView = (id: string) => {
    const el = cardRefs.current.get(id);
    const container = dataContentRef.current;
    if (!el || !container) return;
    if (keepActiveCardCentered) scrollActiveCardIntoView(el, container);
    else scrollCardFullyIntoView(el, container);
  };

  useEffect(() => {
    // Set by handleSelectFromBar right before its own setActiveId — a
    // bookmark-bar tap deliberately selects (highlights the chip and its
    // real card, syncs whichever drawer is open) without yanking the main
    // list's scroll position out from under whatever you were doing there;
    // that's the whole point of being able to work from the bar without
    // leaving your place in the list. Consumed once, so every OTHER
    // activeId change (an ordinary card tap, prev/next, "View Card") still
    // scrolls as before. The bar's own double-tap-to-jump does NOT rely on
    // this effect at all — see handleJumpFromBar.
    if (suppressActiveScrollRef.current) {
      suppressActiveScrollRef.current = false;
      return;
    }
    scrollActiveIntoView(activeId);
  }, [activeId, keepActiveCardCentered]);

  // The effect above doesn't actually cover a display-mode switch — its own
  // dependency array only watches activeId/keepActiveCardCentered, so a
  // pure mode change (same active card, same setting) never re-checks
  // visibility. The scroll-anchor effect below only stops the active card
  // from silently drifting mid-morph; it doesn't guarantee the reflowed
  // result lands anywhere visible. Delayed to match CARD_MORPH_TRANSITION
  // (same settle window used elsewhere, e.g. the drawer-slide effect above)
  // so this doesn't fight that anchor's own scroll compensation while it's
  // still running.
  useEffect(() => {
    const id = window.setTimeout(
      () => {
        const el = cardRefs.current.get(activeId);
        const container = dataContentRef.current;
        if (!el || !container) return;
        if (keepActiveCardCentered) scrollActiveCardIntoView(el, container);
        else scrollCardFullyIntoView(el, container);
      },
      CARD_MORPH_TRANSITION.duration * 1000 + 50,
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  // Anchors the active card's on-screen top position while the display mode
  // switches — cards above it are mid-flight through their own MorphContent
  // height animation, which would otherwise silently drift the active card
  // up/down underneath the user for the whole transition. This runs after
  // every render (no dependency array) so activeTopRef always holds the
  // active card's PREVIOUS position by the time a mode switch's own commit
  // fires — a `useLayoutEffect` scoped just to `[displayMode]` would still
  // measure the card AFTER that commit's own instant reflow already
  // happened, one frame too late to correct before paint. A short
  // requestAnimationFrame loop then keeps canceling further drift for the
  // rest of the morph's duration rather than only correcting once at the
  // end. Switching to a more condensed mode can shrink the page's total
  // height by more than the user's current scroll offset, so the browser
  // clamps scrollY on its own the instant that happens — fighting that
  // clamp frame-by-frame is what produced a worse jump than doing nothing,
  // so a temporary bottom padding pads the page out for the duration of the
  // transition, guaranteeing there's always room to scroll to hold the
  // anchor, then it's removed once the morph settles.
  // Suppresses each card wrapper's own `layout="position"` specifically
  // during a mode-switch's morph — that prop exists to smoothly reposition
  // cards when siblings are added/removed elsewhere (filtering, submit,
  // discard), but during a mode switch its own FLIP-based repositioning
  // fights the scroll anchor above, since both are independently trying to
  // keep the active card visually in the same spot — competing over the
  // same handful of frames produced a worse, jittery result than either
  // alone. Derived synchronously during render (not in an effect) so it
  // takes effect on the very same commit the mode switch itself lands on.
  const [prevModeForLayout, setPrevModeForLayout] = useState(displayMode);
  const [suppressCardLayout, setSuppressCardLayout] = useState(false);
  if (displayMode !== prevModeForLayout) {
    setPrevModeForLayout(displayMode);
    setSuppressCardLayout(true);
  }
  useEffect(() => {
    if (!suppressCardLayout) return;
    const t = setTimeout(
      () => setSuppressCardLayout(false),
      CARD_MORPH_TRANSITION.duration * 1000 + 50,
    );
    return () => clearTimeout(t);
  }, [suppressCardLayout]);

  const activeTopRef = useRef<number | null>(null);
  const prevDisplayModeRef = useRef(displayMode);
  const anchorRafRef = useRef(0);
  useLayoutEffect(() => {
    const el = cardRefs.current.get(activeId);
    const container = dataContentRef.current;
    if (!el || !container) return;
    const isModeSwitch = prevDisplayModeRef.current !== displayMode;
    prevDisplayModeRef.current = displayMode;

    if (isModeSwitch && activeTopRef.current !== null) {
      cancelAnimationFrame(anchorRafRef.current);
      // Guarantees the container has enough scroll slack to actually apply
      // scrollBy deltas mid-morph, before the reflowing content below has
      // grown to fill it on its own — padding on the scrolling element
      // itself counts toward its own scrollHeight, same as body padding
      // used to for the page when this scrolled at the window level.
      const prevPaddingBottom = container.style.paddingBottom;
      container.style.paddingBottom = `${container.clientHeight}px`;

      const initialDelta = el.getBoundingClientRect().top - activeTopRef.current;
      if (initialDelta !== 0) container.scrollBy(0, initialDelta);

      let anchorTop = el.getBoundingClientRect().top;
      const start = performance.now();
      const durationMs = CARD_MORPH_TRANSITION.duration * 1000 + 50;
      const tick = (now: number) => {
        const newTop = el.getBoundingClientRect().top;
        const delta = newTop - anchorTop;
        if (delta !== 0) container.scrollBy(0, delta);
        anchorTop = el.getBoundingClientRect().top;
        if (now - start < durationMs) {
          anchorRafRef.current = requestAnimationFrame(tick);
        } else {
          container.style.paddingBottom = prevPaddingBottom;
        }
      };
      anchorRafRef.current = requestAnimationFrame(tick);
    }

    activeTopRef.current = el.getBoundingClientRect().top;
  });
  useEffect(() => () => cancelAnimationFrame(anchorRafRef.current), []);

  // Which single-unit animation the card list should play, and a remount
  // key. Only start-new (fresh session) and discard (abandon in-progress
  // data) actually swap the list's content — resume/continue-previous just
  // un-fades the same cards (the `opacity-50` wrapper below, untouched by
  // any of this), and submit keeps its own separate, more elaborate
  // per-card staggered animation for now.
  const [cardsGen, setCardsGen] = useState(0);
  const [cardsAnimKind, setCardsAnimKind] = useState<"start-new" | "discard" | "submit">(
    "start-new",
  );

  // Stage 1 (old stuff exits) needs the card list to unmount the INSTANT
  // transitionKind is set (not one effect-tick later), so the exit and the
  // header dimming start together. `cardsHidden` stays true — keeping the
  // old key's conditional slot empty (its own slower exit animation keeps
  // playing via AnimatePresence regardless) — until the new cards actually
  // remount, which happens at a different moment per kind:
  //  - discard doesn't run the header's pill travel (the box stays open),
  //    so it remounts immediately once stage 2 commits.
  //  - start-new does run the pill travel, and resets the odometer to zero
  //    at that same instant — so its remount waits PILL_LAND_MS, until the
  //    clock has actually landed in the mini slot, instead of the new cards
  //    beating it there. See SessionContext's PILL_LAND_MS comment.
  // Both cases use React's "adjust state during render" pattern (comparing
  // against a ref of the previous value) for the instant parts, so there's
  // no one-tick lag or intermediate stale-content flash.
  const [cardsHidden, setCardsHidden] = useState(false);
  const prevKindForHideRef = useRef<TransitionKind>(null);
  if (transitionKind !== prevKindForHideRef.current) {
    prevKindForHideRef.current = transitionKind;
    if (transitionKind === "start-new" || transitionKind === "discard") {
      setCardsHidden(true);
    }
  }

  // A fresh session starting should read as "the pane was already at the
  // top," not as a scroll happening — a real session is meant to open on
  // its first card, not wherever the user happened to be scrolled to on
  // the idle/"Start New Session" screen. Instant (not smooth) and in a
  // layout effect (before paint) so nothing is visibly scrolling; this
  // also preempts a real, separate glitch: stage 1 hides the outgoing
  // cards immediately (see `cardsHidden` above) but the new ones don't
  // remount until PILL_LAND_MS later, so for that whole window the Data
  // tab's pane is briefly far shorter than the page the user was actually
  // scrolled against — if they were scrolled down, the browser's own
  // native scroll-clamping snaps them to whatever the new (shorter) max
  // happens to be the instant that content gap opens, a jump this makes
  // moot by already being at the top before it can occur.
  useLayoutEffect(() => {
    if (transitionKind === "start-new") {
      dataContentRef.current?.scrollTo(0, 0);
    }
  }, [transitionKind]);

  // Stage 2's own commit is itself transient — SessionContext resets
  // transitionStage/transitionKind back to 0/null well before start-new's
  // PILL_LAND_MS timeout can fire, so that reset must not be allowed to
  // cancel the pending timeout (a plain `useEffect` cleanup tied to these
  // deps would otherwise clearTimeout it the instant they revert). Guard
  // with a ref so the stage-2 entrance logic only runs once per transition,
  // and keep the timeout's clearTimeout in a separate, unmount-only effect.
  const cardEntranceTimeoutRef = useRef<number | null>(null);
  const stage2HandledRef = useRef(false);
  useEffect(() => {
    if (transitionStage === 2 && !stage2HandledRef.current) {
      stage2HandledRef.current = true;
      if (transitionKind === "discard") {
        // Wait for the old cards' own shrink-and-dissolve exit to actually
        // finish (CARD_SLIDE_EXIT_MS) instead of remounting the instant
        // stage 2 commits — discard reads as one set fully leaving before
        // the next arrives, not an overlapping relay like start-new's.
        cardEntranceTimeoutRef.current = window.setTimeout(() => {
          setCardsAnimKind("discard");
          setCardsGen((n) => n + 1);
          setCardsHidden(false);
          cardEntranceTimeoutRef.current = null;
        }, CARD_SLIDE_EXIT_MS);
      } else if (transitionKind === "start-new") {
        cardEntranceTimeoutRef.current = window.setTimeout(() => {
          setCardsAnimKind("start-new");
          setCardsGen((n) => n + 1);
          setCardsHidden(false);
          cardEntranceTimeoutRef.current = null;
        }, PILL_LAND_MS);
      }
    } else if (transitionStage !== 2) {
      stage2HandledRef.current = false;
    }
  }, [transitionStage, transitionKind]);

  useEffect(() => {
    return () => {
      if (cardEntranceTimeoutRef.current) window.clearTimeout(cardEntranceTimeoutRef.current);
    };
  }, []);

  // Submit doesn't go through the shared transition stages above (it's a
  // direct, unstaged action) — detected the same way as before, just guarded
  // against also matching discard's paused->idle transition.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    const justSubmitted = prev === "paused" && status === "idle" && transitionKind === null;
    if (!justSubmitted) return;
    const id = window.setTimeout(() => {
      setCardsAnimKind("submit");
      setCardsGen((n) => n + 1);
    }, NOTIFICATION_AREA_TRANSITION.duration * 1000);
    return () => window.clearTimeout(id);
  }, [status, transitionKind]);

  // Switching tabs is handled by the tab bar itself; tapping the tab
  // that's *already* active doesn't switch anything, so without this it
  // was a dead click. Scrolling back to the top instead gives it a
  // purpose — the same "get back to the start of this pane" shortcut a
  // long scroll down any tab's content can otherwise strand you without.
  const handleTabChange = (t: StatusTab) => {
    if (t === tab) {
      contentRefForTab[t].current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Captured synchronously here (not left to the outgoing pane's own
    // onScroll handler alone) so the save never races a switch that
    // follows a scroll within the same tick — onScroll still keeps this
    // fresh the rest of the time, this just guarantees it's never stale
    // at the one moment it actually matters.
    const outgoing = contentRefForTab[tab].current;
    if (outgoing) scrollPositionsRef.current[tab] = outgoing.scrollTop;
    setTab(t);
  };

  // Used by the end-session review's "Did Not Meet Minimums" rows and by
  // goal-change notifications' "View Card" — lands on the right card and
  // switches to the Data tab so it's actually visible. The card list stays
  // permanently mounted now (see the return below), so this is just a plain
  // state update on an already-settled list, not a fresh mount racing its
  // own Motion layout-measurement pass — no deferred wait needed.
  const handleNavigateToCard = (id: string) => {
    setActiveId(id);
    setTab("data");
  };

  // The bookmark bar's own single-tap selection (see BookmarkBar.tsx) —
  // shares activeId with the main list (so the real card highlights and
  // whichever drawer is open updates to match) but deliberately skips the
  // scroll-into-view effect that plain setActiveId would otherwise trigger,
  // since the whole point of scoring from the bar is not having to leave
  // your place in the list.
  const handleSelectFromBar = (id: string) => {
    suppressActiveScrollRef.current = true;
    setActiveId(id);
  };

  // The bar's own double-tap — the explicit "take me there" escape hatch,
  // as opposed to handleSelectFromBar's deliberately-not-scrolling tap.
  // Can't just call handleNavigateToCard and lean on the scroll-into-view
  // effect above: a real double-click/double-tap fires two ordinary click
  // events (and therefore two handleSelectFromBar calls, already setting
  // activeId to this same id) BEFORE the browser's own dblclick fires, so
  // by the time this runs, setActiveId(id) is a same-value no-op React
  // won't re-render for — the effect's activeId dependency never actually
  // changes, so it would never re-run and the jump would silently fail to
  // scroll. Calling scrollActiveIntoView directly sidesteps relying on a
  // state change to trigger it at all.
  const handleJumpFromBar = (id: string) => {
    handleNavigateToCard(id);
    scrollActiveIntoView(id);
  };

  // One scroll container per tab, not one shared pane — every tab's content
  // stays mounted permanently now (see the return below), each in its own
  // fixed-height, internally-scrolling <section>, toggled visible/hidden via
  // CSS rather than a conditional `{tab === "x" && ...}` mount/unmount. That
  // means each tab needs its own independent scrollTop (a shared single
  // scroll container couldn't remember "Data was scrolled to 400px, Schedule
  // was scrolled to 0" at the same time).
  const dataContentRef = useRef<HTMLElement>(null);
  const infoContentRef = useRef<HTMLElement>(null);
  const scheduleContentRef = useRef<HTMLElement>(null);
  const notificationsContentRef = useRef<HTMLElement>(null);
  const settingsContentRef = useRef<HTMLElement>(null);
  const contentRefForTab: Record<StatusTab, RefObject<HTMLElement | null>> = {
    data: dataContentRef,
    info: infoContentRef,
    schedule: scheduleContentRef,
    notifications: notificationsContentRef,
    settings: settingsContentRef,
  };
  // `display: none` on a hidden pane is SUPPOSED to preserve its scrollTop
  // for free (and does, in a plain DOM sandbox) — but the Data tab's own
  // Framer Motion `layout` projections (DataCardList's card wrappers)
  // re-measure their tree the instant that pane goes from display:none
  // back to visible, and that remeasurement pass was resetting scrollTop
  // to whatever it happened to read while the container was zero-sized.
  // Tracking + restoring it explicitly sidesteps trusting the browser (or
  // Motion) with it at all: every pane's own scroll position lands in this
  // ref via a plain onScroll handler below, and gets reapplied in a layout
  // effect keyed on `tab` — layout effects run in commit order, so this
  // one (declared, and therefore committed, after DataCardList's own)
  // reliably has the last word over whatever Motion's post-layout pass did
  // a moment earlier in the same commit.
  const scrollPositionsRef = useRef<Partial<Record<StatusTab, number>>>({});
  useLayoutEffect(() => {
    const el = contentRefForTab[tab].current;
    if (!el) return;
    const target = scrollPositionsRef.current[tab] ?? 0;
    el.scrollTop = target;
    // One synchronous set isn't enough to reliably win: the Data tab's own
    // Framer Motion layout projections (DataCardList's card wrappers)
    // re-measure their tree once the pane goes from display:none back to
    // visible, and that correction can land in a *later* effect or a
    // scheduled rAF of its own — after this one already ran. Re-asserting
    // for a couple more frames outlasts whatever pass that turns out to
    // be, the same "keep correcting for a short window" idea the display-
    // mode scroll anchor above already uses for an analogous race.
    let frame = 0;
    let raf = requestAnimationFrame(function reapply() {
      if (el.scrollTop !== target) el.scrollTop = target;
      frame++;
      if (frame < 8) raf = requestAnimationFrame(reapply);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleNotificationActivate = (n: { sourceRef?: { type: string; id: string } }) => {
    if (n.sourceRef?.type === "activity") {
      setTab("schedule");
      setScheduleScrollId(n.sourceRef.id);
    } else if (n.sourceRef?.type === "info") {
      setTab("info");
    } else if (n.sourceRef?.type === "goal") {
      handleNavigateToCard(n.sourceRef.id);
    } else {
      setTab("notifications");
    }
  };

  return (
    <TipProvider
      tab={tab}
      setTab={setTab}
      setDisplayMode={setDisplayMode}
      mainSettled={mainSettled}
      tourWillAutoLaunch={tourWillAutoLaunch}
      forceLaunch={forceTipLaunch}
      onForceLaunchHandled={onForceTipLaunchHandled}
    >
      <TourProvider
        tab={tab}
        setTab={setTab}
        hasAnyCards={visibleCards.length > 0}
        mainSettled={mainSettled}
        forceLaunch={forceTourLaunch}
        onForceLaunchHandled={onForceTourLaunchHandled}
      >
        <NotificationProvider onActivate={handleNotificationActivate}>
          <GoalChangeDemoTrigger />
          <SessionActivityTrigger />
          {/* App-shell layout: a content-sized header (shrink-0, ordinary CSS
          flow) above a fixed-height, internally-scrolling content pane —
          replacing the old whole-page-scrolls-with-a-sticky-header model.
          `h-svh` (not `h-dvh` or `h-screen`) is deliberate: `h-dvh` tracks
          mobile Safari's collapsing/expanding toolbar LIVE, which sounds
          like the right idea (use the full screen when the toolbar hides)
          but in practice means this whole shell's height — and therefore
          every scrollable pane's own client height, each one `flex-1`
          inside it — genuinely reflows in real time as the toolbar
          animates. Confirmed live on a real device: with an active
          (shadow-bearing) card at the bottom of a pane, that reflow reads
          as its shadow clipping and unclipping in step with the toolbar,
          worse the more animated content (e.g. live notification alerts)
          competes for the toolbar's attention — up to a PERMANENT clip with
          several alerts live, since the toolbar then never settles into
          its larger state at all. No amount of extra bottom padding fixes
          this, because the problem isn't insufficient room — it's that the
          room itself won't hold still. `h-svh` pins this shell to the
          SMALLEST the viewport can ever be (toolbar fully expanded) and
          never reflows again regardless of what the toolbar does — nominally
          trading away `dvh`'s reclaimed-space benefit (a strip of unused
          background briefly visible at the bottom while the toolbar is
          hidden), but that trade is actually free in practice: an earlier,
          separate fix (see the app's own animation-loop history) already
          keeps mobile Safari's toolbar permanently expanded, so `dvh` was
          never actually reclaiming anything to begin with — `svh` and `dvh`
          resolve to the same value here either way, just with `svh` not
          also reflowing on every phantom toolbar recalculation.

          overflow-x-CLIP, not hidden — same technique as the Data tab's own
          inner wrapper (see its comment below): this shell only ever needed
          to contain HORIZONTAL overshoot (the SINGLE_UNIT_VARIANTS
          slide-exit transitions, and any StatusBar-area content that
          animates sideways, e.g. NotificationBar's alerts) — `<section>`
          below already clips its own scroll axis independently (overflow-y
          non-visible forces its own overflow-x to auto too), so this was
          never load-bearing for THAT. It was never meant to clip
          vertically, but plain `overflow-hidden` clips both axes — and per
          the h-svh fix above having turned out NOT to be the actual fix for
          the shadow-clip bug (confirmed still reproducing on mobile Chrome,
          not just Safari, which rules out the toolbar-reflow theory
          entirely), this is one less non-visible ancestor sitting between
          the last card's own bleeding selected-state shadow and the
          document root. `clip` is the one non-visible value exempted from
          the "sibling axis forced to auto" rule, so overflow-y actually
          stays `visible` here. */}
          <main className="h-svh flex flex-col overflow-x-clip overflow-y-visible bg-background">
            <StatusBar
              activeTab={tab}
              onTabChange={handleTabChange}
              onBack={onBack}
              onNavigateToCard={handleNavigateToCard}
              dataToolbar={
                tab === "data" && (
                  <DataToolbar availableKinds={availableKinds} availablePhases={availablePhases}>
                    <AnimatePresence initial={false}>
                      {!sessionActive && (
                        <motion.div
                          key="start-session-banner"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            height: {
                              duration: DATA_BANNER_EXIT_MS / 1000,
                              ease: [0.4, 0, 0.2, 1],
                            },
                            opacity: { duration: 0.25 },
                          }}
                          className="overflow-hidden border-t border-stone-200/70"
                        >
                          <motion.div
                            initial={{ y: -16 }}
                            animate={{ y: 0 }}
                            exit={{ y: -16 }}
                            transition={{
                              duration: DATA_BANNER_EXIT_MS / 1000,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                            className="py-1.5 px-8 text-center"
                          >
                            <span className="text-sm text-muted-foreground">
                              Start session to record data.
                            </span>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <BookmarkBar
                      favoriteCards={favoriteCards}
                      interferingCards={interferingCards}
                      mountedIds={mountedIds}
                      activeId={activeId}
                      onSelectCard={handleSelectFromBar}
                      onJumpToCard={handleJumpFromBar}
                    />
                    {/* Same height+opacity slide as the "Start session" banner
                    above and the bookmark bar's own visibility toggle — the
                    bar itself already collapses out the instant editMode
                    turns on (see its own `visible` check), so this grows
                    into that same shelf slot right as it vacates it, reading
                    as one continuous swap rather than two unrelated
                    animations. No save/cancel: every edit-mode action
                    (reorder, hide, favorite) writes through immediately and
                    isn't something to commit or revert, so "Done" is the
                    only affordance this needs. */}
                    <AnimatePresence initial={false}>
                      {editMode && (
                        <motion.div
                          key="edit-mode-banner"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            height: {
                              duration: DATA_BANNER_EXIT_MS / 1000,
                              ease: [0.4, 0, 0.2, 1],
                            },
                            opacity: { duration: 0.25 },
                          }}
                          className="overflow-hidden border-t border-blue-200/70 bg-blue-50/70"
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-2 max-w-3xl mx-auto">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-blue-800">Edit mode</p>
                              <p className="text-xs text-blue-800/70">
                                Drag cards to reorder them, or use the icons on each to hide it or
                                mark it a favorite.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditMode(false)}
                              className="btn-bevel shrink-0 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                            >
                              Done
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </DataToolbar>
                )
              }
            />

            {/* Every tab's own pane stays permanently mounted — visibility is
            just a `hidden` class toggle, not a `{tab === "x" && ...}`
            conditional render. Switching tabs used to fully unmount
            whichever one you left (losing its scroll position, its filter/
            collapsed-row state, and replaying every AnimatePresence child's
            entrance animation as if it were brand new) and force a fresh
            mount of whichever one you switched to. `display: none` on a
            hidden pane already preserves its own scrollTop for free — no
            extra bookkeeping needed to "remember where you left off." Each
            pane gets its own scroll container (rather than one shared one)
            for exactly that reason: a single shared scrollTop can't
            remember five independent positions at once. */}
            {/* w-full alongside max-w-5xl/mx-auto on every one of these five
            sections — without it, `mx-auto`'s auto margins make a FLEX ITEM
            (this is a `flex-1` child of `<main>`'s own `flex flex-col`) act
            as `align-self: center` on the cross axis instead of stretching
            to fill it, so the section sizes to its own shrink-to-fit content
            width instead of the viewport. List/Card content (and most of
            the other tabs') happens to be wide enough on its own to mask
            that, but the grid display modes' own `grid-cols-N` tracks are
            `minmax(0, 1fr)` — genuinely free to shrink to 0 — which
            collapsed the whole section (and every card in it) down to a few
            px with nothing forcing it wide. `w-full` restores the intended
            stretch-then-cap-at-max-w behavior regardless of what's inside. */}
            {/* pb-16: room for the last card's own selected-state shadow
            (`shadow-[0_10px_30px_-4px_...]` bleeds ~36px past its box) to
            render within this pane's own scrollable content instead of
            getting clipped flush against the bottom. `<main>` above is
            `h-svh` specifically so this pane's client height — and
            therefore where that clip boundary actually sits — stays fixed
            regardless of mobile Safari's toolbar (see `<main>`'s own
            comment); this padding no longer needs to also chase that. */}
            <section
              ref={dataContentRef}
              onScroll={(e) => {
                scrollPositionsRef.current.data = e.currentTarget.scrollTop;
              }}
              className={cn(
                "flex-1 w-full overflow-y-auto px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 -mt-px pt-0",
                tab !== "data" && "hidden",
              )}
            >
              {/* -mx-5 fully cancels the section's own px-5, so THIS div's
              own edge — the overflow-x-clip boundary below — sits flush
              with the viewport instead of 20px in from it. The inner
              width-transition wrapper then reapplies px-3 on its own, so
              the cards themselves still land 12px from the viewport edge —
              the same as the gap-3 between them — but that 12px now sits
              INSIDE the clip boundary rather than exactly ON it. A single
              -mx-3 net offset would have put the clip edge and the card's
              own edge at the same spot, giving each card's box-shadow zero
              room to fade before getting clipped — a hard-edged crop
              instead of a soft one (the bug this split fixes). The two
              quick-action grids get a touch less top margin than list/card
              — their own tiles already sit close under the toolbar with
              little breathing room built into the tile itself, so the
              fuller list/card margin read as an oversized gap there. */}
              {/* overflow-x-hidden: SINGLE_UNIT_VARIANTS' start-new/discard exit
              slides the whole card grid a full extra width off to the
              side — without this, that briefly inflates the document's
              scrollable width, which some mobile browsers respond to by
              rescaling the visual viewport for an instant. Needs `relative`
              too: popLayout makes that exiting grid `position: absolute`
              against its nearest positioned ancestor, and overflow-hidden
              only clips paint on an element that's also the containing
              block. Without `relative` here, that ancestor search skips
              right past this div (still `static`) and the exit keeps
              inflating scrollWidth even though nothing is visibly seen
              sticking out. overflow-x-CLIP, not hidden: per the CSS
              overflow spec, pairing `hidden` (or `auto`/`scroll`) on one
              axis with `visible` on the other forces that "visible" axis
              to `auto` too — silently clipping every card's own drop
              shadow top/bottom, which needs to paint outside this box.
              `clip` is the one non-`visible` value exempted from that
              forcing rule, so overflow-y actually stays `visible` here —
              while still suppressing the exit slide's scrollWidth
              inflation just as well as `hidden` did. */}
              <div
                className={cn(
                  "relative flex flex-col items-center -mx-5 overflow-x-clip overflow-y-visible",
                  isGridDisplayMode ? "pt-4" : "pt-5",
                )}
              >
                <div
                  className={cn(
                    "px-3 transition-[opacity,width] duration-300",
                    !sessionActive && "opacity-50",
                    // Card mode's own cards are dense enough (button labels,
                    // wrapped text) that squeezing them into a narrower column
                    // reads badly at phone widths, so that mode compresses the
                    // container itself down to 55% — left-anchored, sm+ only —
                    // so the still-full-size cards and the open drawer stay
                    // visible side by side instead of the drawer covering them
                    // entirely. List rows and both quick-action grids don't need
                    // that: a list row is already compact and reads fine
                    // truncated under a half-width overlay, and a grid tile's
                    // size IS its grid track's width (unlike a card, which has a
                    // fixed intrinsic size regardless of its track), so shrinking
                    // the container here would shrink every tile with it — those
                    // two instead keep this container at full width and let the
                    // drawer just overlay on top (see DataDetailsDrawer's own
                    // ~half-viewport default width), with the grids' own tiles
                    // separately stacking into the left column the drawer
                    // doesn't cover (see gridClasses/the per-card `gridColumn`
                    // override below).
                    drawerOpen && displayMode === "card"
                      ? "w-full sm:w-[55%] sm:self-start"
                      : "w-full",
                  )}
                >
                  {/* Each card's own wrapper carries `layout` (see DataCardList)
                  so switching card/list/grid morphs every box from one
                  size/shape to the other in place, rather than either
                  snapping instantly or crossfading the whole list as one
                  flat unit — that requires the wrapper to persist across
                  the switch, which an outer keyed remount here would break. */}
                  <DataCardList
                    cardsGen={cardsGen}
                    cardsAnimKind={cardsAnimKind}
                    transitionHidden={cardsHidden}
                    visibleCards={visibleCards}
                    activeId={activeId}
                    setActiveId={setActiveId}
                    cardRefs={cardRefs}
                    editMode={editMode}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    hidden={hidden}
                    toggleHidden={toggleHidden}
                    order={order}
                    setOrder={setOrder}
                    displayMode={displayMode}
                    suppressCardLayout={suppressCardLayout}
                    drawerOpen={drawerOpen}
                    drawerSlideOpen={drawerSlideOpen}
                    onDrawerOpenChange={setDrawerOpen}
                    drawerWidthMode={drawerWidthMode}
                    onDrawerWidthModeChange={setDrawerWidthMode}
                    stickyTop={stickyTop}
                    toolbarHeight={toolbarHeight}
                    tab={tab}
                  />
                </div>
              </div>
            </section>

            <section
              ref={infoContentRef}
              onScroll={(e) => {
                scrollPositionsRef.current.info = e.currentTarget.scrollTop;
              }}
              className={cn(
                "flex-1 w-full overflow-y-auto px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 pt-0",
                tab !== "info" && "hidden",
              )}
            >
              <ClientInfoPane
                onViewSchedule={() => setTab("schedule")}
                contentRef={infoContentRef}
              />
            </section>

            {/* No top padding on the scroll container itself (see the other
            four sections' own pt-0) — ScheduleView's own sticky toggles bar
            sticks to this section's padding box, and top padding on a
            sticky element's scrolling ancestor doesn't get covered by it
            once stuck: scrolled-past content stays visible through that
            padding gap above the bar. The equivalent visual gap now lives
            on ScheduleView's own inner wrapper instead (plain margin-top
            territory, well below where the sticky bar attaches). */}
            <section
              ref={scheduleContentRef}
              onScroll={(e) => {
                scrollPositionsRef.current.schedule = e.currentTarget.scrollTop;
              }}
              className={cn(
                "flex-1 w-full overflow-y-auto px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 pt-0",
                tab !== "schedule" && "hidden",
              )}
            >
              <ScheduleView
                scrollTargetId={scheduleScrollId}
                onScrolledToTarget={() => setScheduleScrollId(null)}
                contentRef={scheduleContentRef}
              />
            </section>

            <section
              ref={notificationsContentRef}
              onScroll={(e) => {
                scrollPositionsRef.current.notifications = e.currentTarget.scrollTop;
              }}
              className={cn(
                "flex-1 w-full overflow-y-auto px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 pt-0",
                tab !== "notifications" && "hidden",
              )}
            >
              <NotificationsPane contentRef={notificationsContentRef} />
            </section>

            <section
              ref={settingsContentRef}
              onScroll={(e) => {
                scrollPositionsRef.current.settings = e.currentTarget.scrollTop;
              }}
              className={cn(
                "flex-1 w-full overflow-y-auto px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 pt-0",
                tab !== "settings" && "hidden",
              )}
            >
              <SettingsPane contentRef={settingsContentRef} cards={cards} onAddCard={addCard} />
            </section>
          </main>
        </NotificationProvider>
        <TourOverlay />
      </TourProvider>
      <TipOverlay />
    </TipProvider>
  );
}

function renderCard(
  card: CardConfig,
  displayMode: DisplayMode,
  common: {
    id: string;
    isActive: boolean;
    onActivate: () => void;
    detailsOpen: boolean;
    onDetailsOpenChange: (open: boolean) => void;
    onOpenDetails: () => void;
    stickyTop: number;
    toolbarHeight: number;
    reorderEditing: boolean;
    favorited: boolean;
    onToggleFavorite: () => void;
    cardHidden: boolean;
    onToggleHidden: () => void;
    dragControls?: DragControls;
    /** Set for the two quick-action grid modes — swaps each card's own
     *  full-size markup for a compact aspect-square tile rendering the
     *  same underlying state, rather than mounting a separate component
     *  (which would lose that state on every mode switch). */
    tileDensity?: "large" | "small";
    /** Set for the list display mode — same reasoning as tileDensity: each
     *  card kind renders its own DataListRow (with its own kind-specific
     *  floating action buttons) from the same component instance, rather
     *  than a separate generic component that has no access to that state. */
    listMode?: boolean;
    teachingProcedure?: TeachingProcedure;
    /** Skip to the previous/next card in display order without closing the
     *  drawer — see DataDetailsDrawer's own props for the full explanation. */
    onPrevCard?: () => void;
    onNextCard?: () => void;
    slideFrom?: "left" | "right" | null;
    widthMode?: "normal" | "full";
    onWidthModeChange?: (mode: "normal" | "full") => void;
  },
): React.ReactNode {
  switch (card.kind) {
    case "trial":
      return (
        <TrialCard
          title={card.title}
          phase={card.phase}
          dataType="Percent Correct"
          description={card.description}
          minTrials={card.minTrials}
          maxTrials={card.maxTrials}
          noResponse={card.noResponse}
          promptLevels={card.promptLevels}
          {...common}
        />
      );
    case "frequency":
      return (
        <FrequencyCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minCount={card.minCount}
          behaviorRole={card.behaviorRole}
          {...common}
        />
      );
    case "rate":
      return (
        <RateCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minDurationSec={card.minDurationSec}
          locked={card.locked}
          {...common}
        />
      );
    case "duration":
      return (
        <DurationCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minDurationSec={card.minDurationSec}
          behaviorRole={card.behaviorRole}
          {...common}
        />
      );
    case "task-analysis":
      return (
        <TaskAnalysisCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          steps={card.steps}
          chainingDirection={card.chainingDirection}
          stepPlan={card.stepPlan}
          promptLevels={card.promptLevels}
          {...common}
        />
      );
    case "rating":
      return (
        <RatingCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          min={card.min}
          max={card.max}
          levelDescriptions={card.levelDescriptions}
          {...common}
        />
      );
    case "timestamp":
      return (
        <TimestampCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          intervalMin={card.intervalMin}
          intervalCount={card.intervalCount}
          defaultWindowHours={card.defaultWindowHours}
          positiveLabel={card.positiveLabel}
          negativeLabel={card.negativeLabel}
          locked={card.locked}
          {...common}
        />
      );
  }
}

// The card list's own slide is deliberately SLOWER than CARD_EXIT_MS (stage
// 1's dwell, which is when the new cards' remount actually fires — see
// IndexInner). That gap is what makes the two overlap: the old cards are
// still most of the way through sliding out (not gone yet) when the new
// ones start sliding in, so it reads as one continuous relay — "one set
// leaving as the other enters" — instead of "exit, dead pause, enter."
const CARD_SLIDE_EXIT_MS = 560;
const CARD_SLIDE_ENTER_MS = 560;

// Shared by every per-card wrapper's `layout="position"` animation (see
// DataCardList) — smoothly translates a card to its new spot when siblings
// are added/removed (filtering, submit, discard), using the same eased-
// duration feel as the rest of the app's non-spring transitions. Restricted
// to "position" (translate only, never scale) because the actual box-size
// change between card/list/grid is handled separately by MorphContent's own
// real height animation below — layering a scale-based FLIP on top of that
// would double-animate the resize and reintroduce content distortion.
const CARD_MORPH_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

// Expands/collapses a card's box to its new mode's natural height and
// crossfades its content — deliberately NOT a transform-scale (Motion's
// `layout` FLIP technique), because that scales the whole subtree including
// descendants Motion isn't tracking (a fresh card/list/grid render is a
// completely different DOM tree), which visibly stretched text and warped
// border-radius into an ellipse before easing back to normal. Measuring the
// real content height and animating the wrapper's `height` (clipped via
// overflow: hidden) instead means the content never gets scaled — only
// revealed or clipped — so it always renders at its true, undistorted size.
function MorphContent({
  displayMode,
  children,
}: {
  displayMode: DisplayMode;
  children: React.ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const isFirstMeasure = useRef(true);

  // isTransitioning: true only during an active mode switch — drives the
  // eased-vs-snap choice in `transition` below and how long the
  // ResizeObserver effect debounces its remeasurement. A regular
  // (non-layout) effect, not a render-time adjustment: `animate` below
  // never targets the literal string "auto" past the first measurement
  // (see below), so there's no "auto" DOM value whose resolution could
  // race the same commit that swaps in the new mode's content — a render-
  // time flip isn't needed to dodge that, and the extra render it costs
  // isn't worth paying for nothing.
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevDisplayModeRef = useRef(displayMode);
  useEffect(() => {
    if (prevDisplayModeRef.current === displayMode) return;
    prevDisplayModeRef.current = displayMode;
    setIsTransitioning(true);
    const id = window.setTimeout(
      () => setIsTransitioning(false),
      CARD_MORPH_TRANSITION.duration * 1000 + 50,
    );
    return () => window.clearTimeout(id);
  }, [displayMode]);

  // overflow:hidden only while a mode switch is actually mid-flight — not a
  // permanent property of this wrapper. Left on all the time, it clips the
  // wrapper to the exact measured `scrollHeight` of its content, which
  // (correctly, per spec) never includes a child's own box-shadow — so an
  // active card's selected-state shadow got hard-clipped right at its own
  // bottom edge instead of fading out naturally, reading as a flat gray
  // smudge with a sharp corner where the fade should have continued (this
  // is also why in-place growth below never gets clipped either, even
  // briefly — the same shadow disappears for however long that clip lasts,
  // and a twirl-down happens far more often than a mode switch). Only
  // clipping during the brief crossfade (where it's genuinely needed, to
  // hide the old/new content pair briefly overlapping) and lifting it once
  // settled lets any static shadow bleed past the box normally at rest.
  //
  // `height` always tracks the measured scrollHeight — for a mode switch
  // AND for a resize a card triggers on its own (CardShell's own
  // expandedView twirl-down, a trial's row growing, a frequency counter
  // growing). What differs is the `transition` used to reach it (below):
  // eased over CARD_MORPH_TRANSITION while isTransitioning (a mode switch,
  // where two genuinely different DOM subtrees need to visibly morph
  // between two sizes), or duration:0 otherwise. Zero-duration matters for
  // in-place growth specifically — those already have their own real-time
  // answer for "how tall am I right now" (CardShell's own CSS
  // grid-template-rows reveal), so this wrapper just needs to snap to
  // match every measured frame, not layer a second, separately-eased
  // animation on top with its own debounce lag. A debounced, eased copy
  // chasing the real height on its own delayed timeline is what let
  // already-grown content bleed past this not-yet-caught-up wrapper into
  // the next sibling, painting UNDER that sibling's own opaque card
  // background (a first attempt at clipping this wrapper to fix that
  // instead traded it for a worse bug: this plain, unrounded wrapper
  // became the visible bottom edge for however long the clip lasted,
  // squaring off the card's own rounded corners and border every time it
  // grew — and a later attempt at clipping just during that settling
  // window fixed that but broke the shadow, see above). What's left is a
  // single frame or two of ResizeObserver's own reporting cycle where
  // fast-growing content can bleed a few pixels into the next sibling
  // before this wrapper catches up — real, but small enough (verified
  // ~20px for one frame, versus the original's ~80px for 300+ms) that it
  // reads as an imperceptible flicker rather than the visible "content
  // sliding out from underneath" bug this exists to fix. Only debouncing
  // while isTransitioning keeps the mode-switch settling protected from
  // re-triggering its eased animation off content jitter (fonts, images) —
  // a duration:0 snap has no animation to re-trigger, so growth updates
  // commit immediately, every frame.
  const measureDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const commit = () => setHeight(el.scrollHeight);
    const measure = () => {
      if (!isTransitioning) {
        commit();
        return;
      }
      if (measureDebounceRef.current !== null) window.clearTimeout(measureDebounceRef.current);
      measureDebounceRef.current = window.setTimeout(commit, 60);
    };
    commit();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      if (measureDebounceRef.current !== null) window.clearTimeout(measureDebounceRef.current);
      ro.disconnect();
    };
  }, [displayMode, isTransitioning]);

  useEffect(() => {
    isFirstMeasure.current = false;
  }, []);

  return (
    <motion.div
      className="w-full"
      style={{ overflow: isTransitioning ? "hidden" : "visible" }}
      animate={{ height: height ?? "auto" }}
      // The very first measurement (initial mount) snaps instantly — there's
      // no prior state to visually transition from, and animating "auto" to
      // itself would otherwise be a no-op anyway. Every later mode switch
      // gets the real eased transition; in-place growth always snaps (see
      // the ResizeObserver comment above).
      transition={
        isFirstMeasure.current || !isTransitioning ? { duration: 0 } : CARD_MORPH_TRANSITION
      }
    >
      <div className="relative w-full">
        {/* popLayout (not "wait") lets the new mode's content mount
            immediately instead of waiting for the old content's exit to
            finish first — mode="wait" left a blank gap between them.
            Setting position: absolute directly in `exit` applies instantly
            rather than animating, pulling the old content out of flow the
            moment it starts fading instead of waiting on that. The height
            measurement below is taken from THIS entering node specifically
            (not the shared parent above) — measuring the parent would also
            pick up the exiting sibling's own footprint for however long it
            takes AnimatePresence's own effects to actually apply that
            position: absolute, which runs on a separate cycle from this
            component's own layout effect and isn't guaranteed to have
            settled first; the entering node's own scrollHeight is
            unaffected by the exiting sibling regardless of that timing. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={displayMode}
            ref={measureRef}
            className="w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, position: "absolute", top: 0, left: 0 }}
            transition={{ duration: 0.12 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Single-unit variants for start-new/discard — the WHOLE list moves as one
// element (not per-card), which is both simpler and much cheaper than
// animating each card individually: only one Motion component is tracked
// during the transition instead of seven.
const SINGLE_UNIT_VARIANTS = {
  "start-new": {
    initial: { x: "-100%" },
    animate: { x: 0, transition: { duration: CARD_SLIDE_ENTER_MS / 1000, ease: [0, 0, 0.2, 1] } },
    exit: { x: "100%", transition: { duration: CARD_SLIDE_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] } },
  },
  discard: {
    initial: { x: "100%", opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: CARD_SLIDE_ENTER_MS / 1000, ease: [0, 0, 0.2, 1] },
    },
    // Shrinks and dissolves in place — unlike start-new's slide, this exit
    // has fully finished (see CARD_SLIDE_EXIT_MS delay in IndexInner) before
    // the fresh set enters, so discard reads as "gone, then a new one
    // arrives" rather than an overlapping relay.
    exit: {
      opacity: 0,
      scale: 0.7,
      transition: { duration: CARD_SLIDE_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] },
    },
  },
} as const;

// Memoized so a resume/pause transition — which re-renders IndexInner via
// `status`/`transitionKind` but leaves every prop below unchanged — doesn't
// cascade a re-render through all five data cards (each a fairly heavy
// subtree, e.g. TrialCard's keypads). That cascade was landing as a ~90ms
// main-thread task right at click time, stalling the collapse animation.
const DataCardList = memo(function DataCardList({
  cardsGen,
  cardsAnimKind,
  transitionHidden = false,
  visibleCards,
  activeId,
  setActiveId,
  cardRefs,
  editMode,
  favorites,
  toggleFavorite,
  hidden,
  toggleHidden,
  setOrder,
  displayMode,
  suppressCardLayout,
  drawerOpen,
  drawerSlideOpen,
  onDrawerOpenChange,
  drawerWidthMode,
  onDrawerWidthModeChange,
  stickyTop,
  toolbarHeight,
  tab,
}: {
  cardsGen: number;
  cardsAnimKind: "start-new" | "discard" | "submit";
  /** True during stages 1-2 of a start-new/discard transition — the old
   * list plays its exit (this flipping true is what triggers it, since
   * AnimatePresence here tracks its child's presence) and nothing renders
   * until the fresh list mounts for stage 3. */
  transitionHidden?: boolean;
  visibleCards: CardConfig[];
  activeId: string;
  setActiveId: (id: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  editMode: boolean;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  hidden: Set<string>;
  toggleHidden: (id: string) => void;
  order: string[];
  setOrder: (ids: string[]) => void;
  displayMode: DisplayMode;
  suppressCardLayout: boolean;
  /** Drives the tile reflow (see `stackToLeftColumn` below) the instant the
   *  user asks to open the drawer. */
  drawerOpen: boolean;
  /** The drawer's own actual slide-open signal — lags `drawerOpen` in grid
   *  modes until the reflow it triggers has settled (see IndexInner). */
  drawerSlideOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  /** Lifted the same way `drawerOpen` is — see DataDetailsDrawer's own
   *  `widthMode` prop for why this can't just live as the drawer's own
   *  local state. */
  drawerWidthMode: "normal" | "full";
  onDrawerWidthModeChange: (mode: "normal" | "full") => void;
  stickyTop: number;
  toolbarHeight: number;
  /** Gates `isActive`/`detailsOpen` below on the Data tab actually being the
   *  visible one, not just which card is remembered as active — see
   *  `renderOne`'s own comment on why. */
  tab: StatusTab;
}) {
  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  // Which side the newly-active card's drawer content should slide in
  // from — set only by the prev/next arrows themselves (see goToPrevCard/
  // goToNextCard below) and cleared by every OTHER path that also changes
  // activeId (a direct card click, or its own details button), so a plain
  // "select a different card" never replays a stale slide from an earlier
  // nav click.
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);
  const activeIdx = visibleCards.findIndex((c) => c.id === activeId);
  const hasMultipleCards = visibleCards.length > 1;
  // Wraps around at either end rather than clamping — with the arrows
  // always live once there's more than one card, disabling them right at
  // the ends would be the only time they ever go inert, which reads as
  // broken more than as a boundary.
  const prevCard = hasMultipleCards
    ? visibleCards[(activeIdx - 1 + visibleCards.length) % visibleCards.length]
    : undefined;
  const nextCard = hasMultipleCards
    ? visibleCards[(activeIdx + 1) % visibleCards.length]
    : undefined;
  const goToPrevCard = prevCard
    ? () => {
        setSlideFrom("left");
        setActiveId(prevCard.id);
      }
    : undefined;
  const goToNextCard = nextCard
    ? () => {
        setSlideFrom("right");
        setActiveId(nextCard.id);
      }
    : undefined;

  // Card mode's own template collapses to one column when the drawer opens
  // (see IndexInner) — safe there since a card's own max-w-md already caps
  // its size regardless of its grid track's width, so the template change
  // doesn't resize anything, just reduces how many fit per row. The two
  // quick-action grids deliberately do NOT get the same treatment: a tile's
  // size IS its grid track's width, so collapsing to grid-cols-1 would
  // stretch every tile to fill the whole row instead of leaving them their
  // normal size. Their own template stays exactly as it is — see the
  // per-card `gridColumn` override below, which pins each one into column 1
  // of that unchanged template instead.
  const gridClasses =
    drawerOpen && displayMode === "card"
      ? "grid-cols-1 gap-3"
      : DISPLAY_MODE_GRID_CLASSES[displayMode];
  // Only the two quick-action grids need the per-card column pin above —
  // list is already single-column and card's own template change already
  // achieves the same "one per row" result without it.
  const stackToLeftColumn =
    drawerOpen && (displayMode === "grid-large" || displayMode === "grid-small");

  const renderOne = (card: CardConfig, dragControls?: DragControls) =>
    renderCard(card, displayMode, {
      id: card.id,
      // Gated on `tab === "data"`, not just `card.id === activeId` — every
      // tab's own pane stays permanently mounted (see the comment on the
      // `<section>`s below), but CardShell/MiniTileShell/DataListRow's own
      // `{isActive && <DataDetailsDrawer .../>}` portals its `fixed`-
      // positioned panel and pull tab straight to `document.body` (see that
      // component's own comment on why), completely bypassing the `hidden`
      // class that hides everything else about an inactive tab. Without this,
      // `activeId` staying set while browsing Schedule/Notifications/Settings
      // left the last-active card's drawer handle (and, if it was open, the
      // whole panel) floating on top of whatever tab was actually showing.
      isActive: card.id === activeId && tab === "data",
      onActivate: () => {
        setSlideFrom(null);
        setActiveId(card.id);
      },
      detailsOpen: card.id === activeId && tab === "data" && drawerSlideOpen,
      onDetailsOpenChange: onDrawerOpenChange,
      onOpenDetails: () => {
        // Activating a card that wasn't already active mounts a FRESH
        // DataDetailsDrawer instance for it (see CardShell/MiniTileShell/
        // DataListRow's own `{isActive && <DataDetailsDrawer .../>}`) —
        // setting `open` true in that same tick means its very first commit
        // is already-open, and Motion's `initial={false}` treats that first
        // commit as the resting state rather than something to animate from,
        // so the panel pops open instead of sliding out. Deferring the open
        // flag one frame lets that fresh instance actually mount (and paint)
        // closed first, so the slide-open plays as a normal, already-mounted
        // prop change — the same way toggling the drawer's own pull tab
        // (which never remounts) already animates correctly.
        setSlideFrom(null);
        setActiveId(card.id);
        requestAnimationFrame(() => onDrawerOpenChange(true));
      },
      stickyTop,
      toolbarHeight,
      widthMode: drawerWidthMode,
      onWidthModeChange: onDrawerWidthModeChange,
      reorderEditing: editMode,
      favorited: favorites.has(card.id),
      onToggleFavorite: () => toggleFavorite(card.id),
      cardHidden: hidden.has(card.id),
      onToggleHidden: () => toggleHidden(card.id),
      dragControls,
      tileDensity:
        displayMode === "grid-large" ? "large" : displayMode === "grid-small" ? "small" : undefined,
      listMode: displayMode === "list",
      teachingProcedure: card.teachingProcedure,
      // Only wired for the card that's actually active — the newly-active
      // card's own fresh drawer instance is the only one that will ever
      // read slideFrom (see its own comment above).
      onPrevCard: card.id === activeId ? goToPrevCard : undefined,
      onNextCard: card.id === activeId ? goToNextCard : undefined,
      slideFrom: card.id === activeId ? slideFrom : null,
    });

  // Edit mode is its own render path — drag-to-reorder (via Motion's
  // Reorder) plus per-card favorite/hide affordances (now rendered right in
  // each card's own header, see CardEditControls) don't need to coordinate
  // with the session-lifecycle animations below, since editing and a
  // start-new/discard/submit transition don't realistically overlap.
  if (editMode) {
    return (
      <Reorder.Group
        axis="y"
        values={visibleCards.map((c) => c.id)}
        onReorder={setOrder}
        className={cn("grid w-full", gridClasses)}
      >
        {visibleCards.map((card, index) => (
          <EditableCardItem
            key={card.id}
            card={card}
            isFirst={index === 0}
            isHidden={hidden.has(card.id)}
            setCardRef={setCardRef}
            renderOne={renderOne}
            displayMode={displayMode}
            suppressCardLayout={suppressCardLayout}
            stackToLeftColumn={stackToLeftColumn}
          />
        ))}
      </Reorder.Group>
    );
  }

  if (cardsAnimKind === "submit") {
    // Submit keeps its own separate, more elaborate per-card staggered
    // animation — untouched, and deliberately allowed to cost more.
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={cardsGen}
          className={cn("grid w-full", gridClasses)}
          initial="enter"
          animate="center"
          exit="exit"
          variants={{
            enter: {},
            center: { transition: { staggerChildren: 0 } },
            exit: { transition: { staggerChildren: DATA_SUBMIT_STAGGER_MS / 1000 } },
          }}
        >
          {visibleCards.map((card) => (
            <motion.div
              key={card.id}
              layout="position"
              ref={setCardRef(card.id)}
              data-tour={card.id === visibleCards[0]?.id ? "first-card" : undefined}
              className="w-full flex justify-center"
              style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
              variants={{
                enter: { opacity: 0, x: -40 },
                center: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: DATA_SUBMIT_ENTER_DURATION_MS / 1000 },
                },
                exit: {
                  opacity: 0,
                  x: 80,
                  transition: { duration: DATA_SUBMIT_EXIT_DURATION_MS / 1000 },
                },
              }}
              transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
            >
              <MorphContent displayMode={displayMode}>{renderOne(card)}</MorphContent>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!transitionHidden && (
        <motion.div
          key={cardsGen}
          className={cn("grid w-full", gridClasses)}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={SINGLE_UNIT_VARIANTS[cardsAnimKind]}
        >
          {visibleCards.map((card) => (
            <motion.div
              key={card.id}
              layout="position"
              transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
              ref={setCardRef(card.id)}
              data-tour={card.id === visibleCards[0]?.id ? "first-card" : undefined}
              className="w-full flex justify-center"
              style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
            >
              <MorphContent displayMode={displayMode}>{renderOne(card)}</MorphContent>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// A real component (not just an inline callback in DataCardList's .map)
// because `useDragControls` must be called consistently on every render —
// the number of visible cards changes as filters/search narrow the list, so
// calling it directly inside the loop would violate the rules of hooks.
function EditableCardItem({
  card,
  isFirst,
  isHidden,
  setCardRef,
  renderOne,
  displayMode,
  suppressCardLayout,
  stackToLeftColumn,
}: {
  card: CardConfig;
  isFirst: boolean;
  isHidden: boolean;
  setCardRef: (id: string) => (el: HTMLElement | null) => void;
  renderOne: (card: CardConfig, dragControls?: DragControls) => React.ReactNode;
  displayMode: DisplayMode;
  suppressCardLayout: boolean;
  stackToLeftColumn: boolean;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={card.id}
      layout="position"
      transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
      ref={setCardRef(card.id)}
      data-tour={isFirst ? "first-card" : undefined}
      dragListener={false}
      dragControls={dragControls}
      className={cn("w-full flex justify-center", isHidden && "opacity-40")}
      style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
    >
      <MorphContent displayMode={displayMode}>{renderOne(card, dragControls)}</MorphContent>
    </Reorder.Item>
  );
}
