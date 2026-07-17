import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  Reorder,
  useDragControls,
  type DragControls,
} from "motion/react";
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
  type TransitionKind,
} from "@/components/SessionContext";
import { SettingsProvider, useSettings } from "@/components/SettingsContext";
import { ScheduleProvider } from "@/components/ScheduleContext";
import { SettingsPane } from "@/components/SettingsPane";
import { StatusBar, type StatusTab } from "@/components/StatusBar";
import { NotificationProvider } from "@/components/NotificationContext";
import { NOTIFICATION_AREA_TRANSITION, NotificationsPane } from "@/components/NotificationBar";
import { useStickyTop } from "@/hooks/use-sticky-top";
import { useElementHeight } from "@/hooks/use-element-height";
import { useInitialLayoutSettled } from "@/hooks/use-initial-layout-settle";
import { DataToolbar } from "@/components/DataToolbar";
import {
  DataToolbarProvider,
  useDataToolbar,
  type CardKind,
  type DataToolbarFilters,
  type DisplayMode,
} from "@/components/DataToolbarContext";
import { CardDataStoreProvider } from "@/components/CardDataStore";
import type { TeachingProcedure } from "@/components/TeachingProcedureAccordion";
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
type CardConfig = {
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

const cards: CardConfig[] = [
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
      materials:
        "None — this target is embedded in naturally occurring transitions throughout the day.",
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
      materials:
        "Whatever the chosen play activity calls for (see the day's activity plan) — no dedicated materials for the tally itself.",
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
      materials: "Stopwatch or the session timer; no other materials.",
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
      materials:
        "None specific to this card, but keep breakable/valuable items out of easy reach during high-risk activities.",
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
      materials: "None.",
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
      sd: "None — this is a holistic end-of-session judgment call, not a response to a specific instruction.",
      // Overridden by the card's own level descriptions at render time —
      // this placeholder only exists to satisfy the shared type.
      measurement: { scale: [] },
      correction:
        "Not applicable — there's nothing to correct on a score; a consistently low score across sessions is a cue to loop in the BCBA about antecedent strategies, not something to fix in the moment.",
      materials: "None.",
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
    // TEMPORARY — unlocked so elapsed time can be typed in directly to test
    // the timeline at arbitrary points; revert to locked (or omit) once done.
    locked: false,
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

// Duration for the "Start session to record data" banner's own exit below.
const DATA_BANNER_EXIT_MS = 400;

function Index() {
  return (
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
              <IndexInner />
            </ScheduleProvider>
          </CardDataStoreProvider>
        </DataToolbarProvider>
      </SessionProvider>
    </SettingsProvider>
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

function getVisibleCards(
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
    if (q && !card.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

// Native `scrollIntoView({block: "center"})` centers an element against the
// FULL viewport, with no notion of the sticky status bar + data toolbar
// (and, when idle, the "Start session" banner inside it) covering the top
// of it — headerHeight px are visually spoken for whether or not the
// browser knows it. That's the gap: idle and running headers are different
// heights, so a naive center leaves the card's own top/title tucked behind
// the sticky header in whichever state has the taller one. Centering
// within the space actually left below the header fixes both, and the
// clamp keeps a card taller than that space from having its own top
// (title) pushed up out of view in the process.
function scrollActiveCardIntoView(el: HTMLElement, headerHeight: number) {
  const rect = el.getBoundingClientRect();
  const availableHeight = window.innerHeight - headerHeight;
  const desiredCenterY = headerHeight + availableHeight / 2;
  const currentCenterY = rect.top + rect.height / 2;
  const maxDelta = rect.top - headerHeight;
  const delta = Math.min(currentCenterY - desiredCenterY, maxDelta);
  window.scrollBy({ top: delta, behavior: "smooth" });
}

// The default (setting off) counterpart to scrollActiveCardIntoView above —
// same headerHeight-aware math (native `scrollIntoView({block:"nearest"})`
// has the identical blind spot to `"center"`: it doesn't know the sticky
// header is eating into the true visible area), but only the minimum nudge
// needed to bring a partially-hidden card fully on screen, not a forced
// recenter. A no-op if the card's already fully visible.
function scrollCardFullyIntoView(el: HTMLElement, headerHeight: number) {
  const rect = el.getBoundingClientRect();
  const visibleTop = headerHeight;
  const visibleBottom = window.innerHeight;
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;
  // Taller than the room available below the header — no scroll amount can
  // satisfy both edges, so just lead with the top (matches how a browser's
  // own "nearest" falls back when the target doesn't fit either).
  if (rect.height > visibleBottom - visibleTop || rect.top < visibleTop) {
    window.scrollBy({ top: rect.top - visibleTop, behavior: "smooth" });
  } else if (rect.bottom > visibleBottom) {
    window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
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

function IndexInner() {
  const [activeId, setActiveId] = useState<string>(cards[0].id);
  const [tab, setTab] = useState<StatusTab>("data");
  const [scheduleScrollId, setScheduleScrollId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Which of the drawer's two open widths is showing — lifted up here
  // (rather than left as DataDetailsDrawer's own local state) so it
  // survives a prev/next card switch, which remounts a fresh drawer
  // instance for the newly active card (see DataDetailsDrawer's own props
  // for the full explanation). Without this, dragging to full width and
  // then paging to the next card would snap the drawer back down to normal
  // width on every step.
  const [drawerWidthMode, setDrawerWidthMode] = useState<"normal" | "full">("normal");
  const { status, transitionStage, transitionKind, headerReflowActive } = useSession();
  // Paused counts as "active" too — a session still exists, it's just not
  // ticking. Gating this on "running" alone flashed the "Start session to
  // record data" banner and dimmed every card each time a session was
  // paused (only "idle" should read as no active session), which is what
  // was producing the tab/content-pane "bounce" on pause: the banner
  // sliding in and the cards dropping to half-opacity added an extra,
  // unrelated layout shift on top of the box's own expand animation.
  const sessionActive = status !== "idle";

  // Motion's `layout="position"` snapshots this pane's rect once per React
  // render and commits to it as the FLIP's final target — it has no idea
  // the snapshot it just took is itself mid-flight, still being pushed by
  // the header box's own real (non-`layout`) height `animate()` a beat
  // later. A render that lands after the box's target has logically
  // updated but before its real height has actually finished tweening
  // hands Motion a target that's already (visually) the fully-collapsed
  // position, so it commits and finishes the pane's FLIP well before the
  // box (and the tab bar and toolbar riding directly on its real height,
  // needing no FLIP at all) actually gets there — the pane visibly arrives
  // early. Turning `layout` off for exactly the window the header's real
  // height is changing sidesteps this: with no FLIP running, the pane just
  // follows native reflow like any other block, which can't ever be out of
  // step with what's really above it. `headerReflowActive` (SessionContext)
  // is that window, computed centrally rather than mirrored piecemeal into
  // this component — the box's own collapse/expand, the dwell before it
  // starts (during which the tab nav's own `isRunning`-derived margin
  // already changes), and the mini-session slot's own real height animation
  // growing/shrinking inside the tab nav, all folded into one signal so
  // this pane, the tab nav, and the toolbar riding on it can never drift
  // apart reading it. Also covers a plain, unstaged `pause()` click, which
  // never touches transitionStage/transitionKind at all.
  // `layout="position"` comes back the instant the header's real reflow is
  // done, for the discrete-jump cases (tab switches, notification changes)
  // it's actually meant for.
  const suppressPaneLayout = headerReflowActive;
  // See use-initial-layout-settle's own comment — StatusBar's demo-only
  // "Previous Session" row grows its box a beat after mount, which this
  // pane (tracked in the same "session-bar" LayoutGroup) would otherwise
  // animate away from on every fresh page load.
  const initialLayoutSettled = useInitialLayoutSettled();

  const stickyTop = useStickyTop();
  // The shared details drawer starts at stickyTop (the toolbar's own top)
  // so it slides out on top of the toolbar, not just the pane below it —
  // see DataDetailsDrawer. toolbarHeight is measured separately (rather
  // than measuring the toolbar's absolute position directly) since the
  // toolbar's own `top` can shift for reasons (status bar height changing)
  // that a resize observer on the toolbar itself wouldn't catch.
  const toolbarHeight = useElementHeight("[data-toolbar]");
  const { keepActiveCardCentered } = useSettings();
  const {
    displayMode,
    editMode,
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

  const availableKinds = useMemo(
    () => CARD_KINDS_IN_ORDER.filter((k) => cards.some((c) => c.kind === k)),
    [],
  );
  const availablePhases = useMemo(() => {
    const present = new Set(cards.map((c) => c.phase));
    const known = PHASE_ORDER.filter((p) => present.has(p));
    const rest = Array.from(present)
      .filter((p) => !PHASE_ORDER.includes(p))
      .sort();
    return [...known, ...rest];
  }, []);

  const visibleCards = useMemo(
    () =>
      getVisibleCards(
        order,
        filters,
        searchQuery,
        favorites,
        hidden,
        hasData,
        completion,
        editMode,
      ),
    [order, filters, searchQuery, favorites, hidden, hasData, completion, editMode],
  );

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
        if (el) {
          if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
          else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
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
  useEffect(() => {
    const el = cardRefs.current.get(activeId);
    if (!el) return;
    if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
    else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!el) return;
        if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
        else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
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
    if (!el) return;
    const isModeSwitch = prevDisplayModeRef.current !== displayMode;
    prevDisplayModeRef.current = displayMode;

    if (isModeSwitch && activeTopRef.current !== null) {
      cancelAnimationFrame(anchorRafRef.current);
      const body = document.body;
      const prevPaddingBottom = body.style.paddingBottom;
      body.style.paddingBottom = `${window.innerHeight}px`;

      const initialDelta = el.getBoundingClientRect().top - activeTopRef.current;
      if (initialDelta !== 0) window.scrollBy(0, initialDelta);

      let anchorTop = el.getBoundingClientRect().top;
      const start = performance.now();
      const durationMs = CARD_MORPH_TRANSITION.duration * 1000 + 50;
      const tick = (now: number) => {
        const newTop = el.getBoundingClientRect().top;
        const delta = newTop - anchorTop;
        if (delta !== 0) window.scrollBy(0, delta);
        anchorTop = el.getBoundingClientRect().top;
        if (now - start < durationMs) {
          anchorRafRef.current = requestAnimationFrame(tick);
        } else {
          body.style.paddingBottom = prevPaddingBottom;
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

  // A session starting (fresh or continued) should read as "the pane was
  // already at the top," not as a scroll happening — a real session is
  // meant to open on its first card, not wherever the user happened to be
  // scrolled to on the idle/"Start New Session" screen. Instant (not
  // smooth) and in a layout effect (before paint) so nothing is visibly
  // scrolling; this also preempts a real, separate glitch: stage 1 hides
  // the outgoing cards immediately (see `cardsHidden` above) but the new
  // ones don't remount until PILL_LAND_MS later, so for that whole window
  // the Data tab's pane is briefly far shorter than the page the user was
  // actually scrolled against — if they were scrolled down, the browser's
  // own native scroll-clamping snaps them to whatever the new (shorter) max
  // happens to be the instant that content gap opens, a jump this makes
  // moot by already being at the top before it can occur.
  useLayoutEffect(() => {
    if (transitionKind === "start-new" || transitionKind === "start-previous") {
      window.scrollTo(0, 0);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setTab(t);
  };

  const handleNotificationActivate = (n: { sourceRef?: { type: string; id: string } }) => {
    if (n.sourceRef?.type === "activity") {
      setTab("schedule");
      setScheduleScrollId(n.sourceRef.id);
    } else if (n.sourceRef?.type === "info") {
      setTab("info");
    } else {
      setTab("notifications");
    }
  };

  return (
    <NotificationProvider onActivate={handleNotificationActivate}>
      <main className="min-h-screen bg-background">
        {/* Shared across StatusBar's tab nav and this section's panel so their
          `layout="position"` FLIPs are batched into one coordinated motion
          instead of two independent trees that can drift a frame apart —
          see LayoutGroup's docs on coordinating layout detection across
          separate components. */}
        <LayoutGroup id="session-bar">
          <StatusBar
            activeTab={tab}
            onTabChange={handleTabChange}
            suppressNavLayout={suppressCardLayout}
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
                          height: { duration: DATA_BANNER_EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] },
                          opacity: { duration: 0.25 },
                        }}
                        className="overflow-hidden border-t border-stone-200/70"
                      >
                        <motion.div
                          initial={{ y: -16 }}
                          animate={{ y: 0 }}
                          exit={{ y: -16 }}
                          transition={{ duration: DATA_BANNER_EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
                          className="py-1.5 px-8 text-center"
                        >
                          <span className="text-sm text-muted-foreground">
                            Start session to record data.
                          </span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </DataToolbar>
              )
            }
          />

          <motion.section
            // `layout="position"` stays on unconditionally (never toggled to
            // `false`) — see StatusBar's own nav for why: toggling the prop
            // itself makes Motion re-initialize its projection right as it
            // re-enables, catching the tail of whatever moved while it was
            // off and animating THAT with the full transition, which reads
            // as its own separate, out-of-sync bounce. Zeroing just the
            // duration (`suppressPaneLayout`/`initialLayoutSettled`) keeps
            // measurement continuous instead.
            layout="position"
            transition={{
              layout:
                suppressPaneLayout || !initialLayoutSettled ? { duration: 0 } : NOTIFICATION_AREA_TRANSITION,
            }}
            className={cn(
              "px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200",
              // Only the Data tab has a toolbar directly above this pane, with
              // its own border-b — -mt-px there merges the two lines into one
              // instead of a visible double line. Every other tab sits directly
              // below the (sticky, higher-stacked) tabs row itself, so pulling
              // the border under it here instead erased it completely across
              // the whole width — not just blended under the active tab the way
              // its own -bottom-px overlay (see StatusBar) is meant to.
              tab === "data" && "-mt-px",
              tab === "schedule" ? "pt-2" : tab === "data" ? "pt-0" : "pt-5",
            )}
          >
            {tab === "data" && (
              <>
                {/* -mx-2 cancels 8px of the section's px-5, so the cards sit 12px
              from the viewport edge — the same as the gap-3 between them,
              instead of the wider 20px inherited from the shared tab padding.
              The two quick-action grids get a touch less top margin than
              list/card — their own tiles already sit close under the
              toolbar with little breathing room built into the tile itself,
              so the fuller list/card margin read as an oversized gap there. */}
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
                    "relative flex flex-col items-center -mx-2 overflow-x-clip overflow-y-visible",
                    isGridDisplayMode ? "pt-4" : "pt-5",
                  )}
                >
                  <div
                    className={cn(
                      "transition-[opacity,width] duration-300",
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
                    />
                  </div>
                </div>
              </>
            )}

            {tab === "info" && <ClientInfoPane onViewSchedule={() => setTab("schedule")} />}
            {tab === "schedule" && (
              <ScheduleView
                scrollTargetId={scheduleScrollId}
                onScrolledToTarget={() => setScheduleScrollId(null)}
              />
            )}
            {tab === "notifications" && <NotificationsPane />}
            {tab === "settings" && <SettingsPane />}
          </motion.section>
        </LayoutGroup>
      </main>
    </NotificationProvider>
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

  // overflow:hidden only while a mode switch is actually mid-flight — not a
  // permanent property of this wrapper. Left on all the time, it clips the
  // wrapper to the exact measured `scrollHeight` of its content, which
  // (correctly, per spec) never includes a child's own box-shadow — so an
  // active card's selected-state shadow got hard-clipped right at its own
  // bottom edge instead of fading out naturally, reading as a flat gray
  // smudge with a sharp corner where the fade should have continued. Only
  // clipping during the brief crossfade (where it's genuinely needed, to
  // hide the old/new content pair briefly overlapping) and lifting it once
  // settled lets any static shadow bleed past the box normally at rest.
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

  // ResizeObserver instead of the more obvious "measure scrollHeight in a
  // useLayoutEffect keyed on displayMode, animate to it, then transitionEnd
  // back to auto" — that trick doesn't hold up here. AnimatePresence's own
  // `exit` (below) pulls the OLD content out of flow via position:absolute
  // the INSTANT the key changes, not animated, so this wrapper's "auto"
  // height can already reflow to match the ENTERING content alone before a
  // same-pass layout effect ever runs — collapsing the animation's start
  // and end to the same number, so it snaps instead of morphing. A regular
  // (non-layout) effect here, by contrast, naturally fires AFTER that
  // paint — so `height` state still holds the OLD value through that first
  // paint, and only advances to the new measurement afterward, which is
  // exactly the two genuinely-different, two-separately-painted values
  // Motion needs to interpolate between. Same ResizeObserver-based pattern
  // StatusBar's own boxNaturalHeight/miniSlotHeight already use, for the
  // identical reason ("Motion's own auto height resolution wasn't
  // reliable") — and it doubles as the ongoing remeasure this wrapper needs
  // for any later in-place content growth (a trial's row expanding, a
  // frequency counter growing), which the old transitionEnd approach had to
  // hand off to "auto" for since it had no other way to keep tracking it.
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayMode]);

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
      // gets the real eased transition.
      transition={isFirstMeasure.current ? { duration: 0 } : CARD_MORPH_TRANSITION}
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
      isActive: card.id === activeId,
      onActivate: () => {
        setSlideFrom(null);
        setActiveId(card.id);
      },
      detailsOpen: card.id === activeId && drawerSlideOpen,
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
        {visibleCards.map((card) => (
          <EditableCardItem
            key={card.id}
            card={card}
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
  isHidden,
  setCardRef,
  renderOne,
  displayMode,
  suppressCardLayout,
  stackToLeftColumn,
}: {
  card: CardConfig;
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
      dragListener={false}
      dragControls={dragControls}
      className={cn("w-full flex justify-center", isHidden && "opacity-40")}
      style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
    >
      <MorphContent displayMode={displayMode}>{renderOne(card, dragControls)}</MorphContent>
    </Reorder.Item>
  );
}
