import type { ReactNode } from "react";
import { createElement } from "react";
import { Star } from "lucide-react";
import { PercentCorrectIcon } from "@/components/icons/PercentCorrectIcon";
import { FrequencyIcon } from "@/components/icons/FrequencyIcon";
import { RateIcon } from "@/components/icons/RateIcon";
import { DurationIcon } from "@/components/icons/DurationIcon";
import { TaskAnalysisIcon } from "@/components/icons/TaskAnalysisIcon";
import { TimestampIcon } from "@/components/icons/TimestampIcon";
import type { CardKind } from "@/components/DataToolbarContext";

export interface DataTypeInfo {
  label: string;
  icon: ReactNode;
  /** Placeholder copy explaining what the data type measures and roughly
   *  how it's logged — shown in the drawer's "Data type" info modal (see
   *  DrawerQuickFacts) alongside a stand-in tutorial video slot. */
  description: string;
}

/** One entry per CardKind — reused by DrawerQuickFacts' "Data type" info
 *  modal. Icons are duplicated here (rather than imported from
 *  DataToolbar's own KIND_META) since that map isn't exported and only
 *  covers the toolbar's own filter-icon use case, not descriptive copy. */
export const DATA_TYPE_INFO: Record<CardKind, DataTypeInfo> = {
  trial: {
    label: "Percent Correct",
    icon: createElement(PercentCorrectIcon),
    description:
      "Tracks correct vs. incorrect responses across a set of discrete trials, then reports the percentage answered correctly. Best for skills with a clear right or wrong answer — matching, labeling, answering a question — where each trial is logged as it happens.",
  },
  frequency: {
    label: "Frequency",
    icon: createElement(FrequencyIcon),
    description:
      "Counts how many times a behavior occurs during an observation period. Best for behaviors with a clear, quick start and end — like hand-raising or a vocal outburst — where what matters is simply how often it happens.",
  },
  rate: {
    label: "Rate",
    icon: createElement(RateIcon),
    description:
      "Counts occurrences the same way Frequency does, but divides by the length of the observation to produce a rate (count per minute or hour) — so sessions of different lengths can still be compared fairly.",
  },
  duration: {
    label: "Duration",
    icon: createElement(DurationIcon),
    description:
      "Times how long a behavior lasts, from start to finish, using a built-in stopwatch per instance. Best for behaviors that persist over a stretch of time — like a tantrum or staying on-task — rather than ones that happen instantly.",
  },
  "task-analysis": {
    label: "Task Analysis",
    icon: createElement(TaskAnalysisIcon),
    description:
      "Breaks a multi-step skill — like handwashing or a morning routine — into its individual steps, then tracks each step's own level of independence (prompted vs. independent). Useful for measuring progress on complex, chained skills one step at a time.",
  },
  rating: {
    label: "Score",
    icon: createElement(Star, { fill: "currentColor", strokeWidth: 0 }),
    description:
      "Captures a subjective rating on a fixed scale for something that isn't a simple count — like how engaged or ready to learn a client seemed during a session.",
  },
  timestamp: {
    label: "Timestamp",
    icon: createElement(TimestampIcon),
    description:
      "Logs the specific time a behavior occurred, without measuring how long it lasted or how many times it happened — useful for spotting patterns tied to time of day.",
  },
};

export interface PhaseInfo {
  description: string;
}

/** Placeholder copy for the phases this app ships with (see PHASE_ICONS) —
 *  an unrecognized custom phase just shows the plain phase name with no
 *  extra explanation rather than needing this map kept exhaustively in
 *  sync. */
export const PHASE_INFO: Record<string, PhaseInfo> = {
  Baseline: {
    description:
      "Data collected before any teaching or behavior plan begins, so later progress has something to be measured against.",
  },
  Intervention: {
    description:
      "Data collected while a specific teaching strategy or behavior plan is actively being used.",
  },
  Probing: {
    description:
      "A quick, occasional check on a skill without ongoing teaching — used to see whether a skill has generalized or is being retained without regular practice.",
  },
  Maintenance: {
    description:
      "Data collected after a skill has been mastered, to confirm it's holding up over time without regular teaching.",
  },
};
