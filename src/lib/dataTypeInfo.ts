import type { ReactNode } from "react";
import { createElement } from "react";
import { Star, Stamp } from "lucide-react";
import { PercentCorrectIcon } from "@/components/icons/PercentCorrectIcon";
import { FrequencyIcon } from "@/components/icons/FrequencyIcon";
import { RateIcon } from "@/components/icons/RateIcon";
import { DurationIcon } from "@/components/icons/DurationIcon";
import { TaskAnalysisIcon } from "@/components/icons/TaskAnalysisIcon";
import { IntervalIcon } from "@/components/icons/IntervalIcon";
import { ChecklistIcon } from "@/components/icons/ChecklistIcon";
import { ProductIcon } from "@/components/icons/ProductIcon";
import type { CardKind } from "@/components/DataToolbarContext";

export interface DataTypeInfo {
  /** Full descriptive name — the info modal's own title (see
   *  DataTypeInfoLabel/DrawerInfoModal) and the "pick a data type" grid in
   *  AddCardDialog, where there's room and a reason to spell it out. */
  label: string;
  /** Short, card-facing name — what a card's own header, list row, and
   *  filter chip actually show. Identical to `label` for most kinds (a
   *  single word has nowhere shorter to go); only spelled-out multi-word
   *  names (Percent Correct, Task Analysis, Permanent Work Product) have a
   *  genuinely shorter form. */
  shortLabel: string;
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
    shortLabel: "Percent",
    icon: createElement(PercentCorrectIcon),
    description:
      "Tracks correct vs. incorrect responses across a set of discrete trials, then reports the percentage answered correctly. Best for skills with a clear right or wrong answer, such as matching, labeling, or answering a question. Each trial is logged as it happens.",
  },
  frequency: {
    label: "Frequency",
    shortLabel: "Frequency",
    icon: createElement(FrequencyIcon),
    description:
      "Counts how many times a behavior occurs during an observation period. Best for behaviors with a clear, quick start and end, like hand-raising or a vocal outburst. What matters is simply how often it happens.",
  },
  rate: {
    label: "Rate",
    shortLabel: "Rate",
    icon: createElement(RateIcon),
    description:
      "Counts occurrences the same way Frequency does, but divides by the length of the observation to produce a rate, such as count per minute or hour. This lets sessions of different lengths still be compared fairly.",
  },
  duration: {
    label: "Duration",
    shortLabel: "Duration",
    icon: createElement(DurationIcon),
    description:
      "Times how long a behavior lasts, from start to finish, using a built-in stopwatch per instance. Best for behaviors that persist over a stretch of time, like a tantrum or staying on-task, rather than ones that happen instantly.",
  },
  "task-analysis": {
    label: "Task Analysis",
    shortLabel: "Task",
    icon: createElement(TaskAnalysisIcon),
    description:
      "Breaks a multi-step skill, like handwashing or a morning routine, into its individual steps, then tracks each step's own level of independence (prompted vs. independent). Useful for measuring progress on complex, chained skills one step at a time.",
  },
  rating: {
    label: "Score",
    shortLabel: "Score",
    icon: createElement(Star, { strokeWidth: 2 }),
    description:
      "Captures a subjective rating on a fixed scale for something that isn't a simple count. Good for things like how engaged or ready to learn a client seemed during a session.",
  },
  interval: {
    label: "Interval",
    shortLabel: "Interval",
    icon: createElement(IntervalIcon),
    description:
      "Checks in at fixed time intervals (or scheduled times of day) and marks whether the target behavior is or isn't occurring at each check, rather than counting or timing it directly. Good for spotting patterns tied to time.",
  },
  checklist: {
    label: "Checklist",
    shortLabel: "Checklist",
    icon: createElement(ChecklistIcon),
    description:
      "A fixed list of items to check off as applicable, rather than tallied or timed. Best for a set of indicators observed over the course of a session, like signs of rapport, where each one either applies or doesn't and there's no count or duration to track.",
  },
  timestamp: {
    label: "Timestamp",
    shortLabel: "Timestamp",
    icon: createElement(Stamp),
    description:
      "Logs the exact date and time something happened — a simple, ongoing record of moments, not a count, duration, or interval check.",
  },
  product: {
    label: "Permanent Work Product",
    shortLabel: "Product",
    icon: createElement(ProductIcon),
    description:
      "Collects photos of a tangible work sample a client produced, like a completed worksheet or drawing, rather than a count, duration, or rating. Good for keeping visual evidence of permanent products alongside the rest of a session's data.",
  },
};

export interface PhaseInfo {
  description: string;
}

/** Placeholder copy for the phases this app ships with (see PHASE_ICONS) —
 *  an unrecognized custom phase just shows the plain phase name with no
 *  extra explanation rather than needing this map kept exhaustively in
 *  sync. */
// Ordered to match the typical progression of an ABA treatment plan —
// Baseline and Probing establish where a client starts, Intervention
// actively teaches, Fading backs supports off, and Maintenance checks the
// result holds — rather than alphabetically or by whenever each was added.
export const PHASE_INFO: Record<string, PhaseInfo> = {
  Baseline: {
    description:
      "A behavior is currently in the standard stages of normal activity for that client. This is the starting point before any teaching or behavior plan begins, so later progress has something to be measured against.",
  },
  Probing: {
    description:
      "Investigating a client's abilities to establish what the baseline is. A quick, occasional check on a skill without ongoing teaching.",
  },
  Intervention: {
    description:
      "Trying to make a change in a behavior through targeted techniques. A specific teaching strategy or behavior plan is actively being used.",
  },
  Fading: {
    description:
      "Trying to reduce the need for intervention and reinforcement to make the behavior automatic and independent.",
  },
  Maintenance: {
    description:
      "A behavior has been successfully modified, but is still reinforced occasionally to make sure that it remains permanent.",
  },
};
