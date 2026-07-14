import { useState } from "react";
import { AccordionRow } from "./AccordionRow";
import type { CardKind } from "./DataToolbarContext";

export interface TeachingProcedure {
  goal: string;
  rationale: string;
  procedure: string;
  sd: string;
  measurement: {
    markCorrect: string;
    markError: string;
  };
  correction: string;
  materials: string;
  instructionalNotes: string;
}

const ROW_IDS = [
  "goal",
  "rationale",
  "procedure",
  "sd",
  "measurement",
  "correction",
  "materials",
  "notes",
] as const;

// The two measurement fields always describe the same underlying "counts /
// doesn't count" distinction, but each card kind scores it with different
// buttons — label the row after whichever one the card actually shows, so
// the instructions never say "correct" when the button says "Independent".
const MEASUREMENT_LABELS: Record<CardKind, { positive: string; negative: string }> = {
  trial: { positive: "Mark Correct if", negative: "Mark Error if" },
  "task-analysis": { positive: "Mark Independent if", negative: "Mark Error if" },
  frequency: { positive: "Counts as an instance if", negative: "Does not count if" },
  rate: { positive: "Counts as an instance if", negative: "Does not count if" },
  duration: { positive: "Counts as the same instance if", negative: "Does not count if" },
  rating: { positive: "Mark Correct if", negative: "Mark Error if" },
};

// Procedure and Measurement are what staff actually reach for mid-session —
// default those open, leave the rest (context you'd check once, not per
// trial) tucked away like About Me's rows.
const DEFAULT_EXPANDED = new Set<string>(["procedure", "measurement"]);

/** Per-card teaching-procedure reference, shown in a data card's details
 *  drawer — same flat twirldown-row pattern as About Me, so a tech running
 *  a session can jump straight to just the row they need (usually
 *  Procedure or Measurement) instead of scrolling a wall of text. */
export function TeachingProcedureAccordion({
  data,
  kind,
}: {
  data: TeachingProcedure;
  kind: CardKind;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(ROW_IDS.filter((id) => !DEFAULT_EXPANDED.has(id))),
  );
  const measurementLabels = MEASUREMENT_LABELS[kind];

  const toggleRow = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden text-sm">
      <AccordionRow
        id="goal"
        emoji="🎯"
        label="Goal"
        collapsed={collapsedIds.has("goal")}
        onToggle={toggleRow}
      >
        {data.goal}
      </AccordionRow>
      <AccordionRow
        id="rationale"
        emoji="💭"
        label="Rationale"
        collapsed={collapsedIds.has("rationale")}
        onToggle={toggleRow}
      >
        {data.rationale}
      </AccordionRow>
      <AccordionRow
        id="procedure"
        emoji="📝"
        label="Procedure"
        collapsed={collapsedIds.has("procedure")}
        onToggle={toggleRow}
      >
        {data.procedure}
      </AccordionRow>
      <AccordionRow
        id="sd"
        emoji="👉"
        label="SD"
        collapsed={collapsedIds.has("sd")}
        onToggle={toggleRow}
      >
        {data.sd}
      </AccordionRow>
      <AccordionRow
        id="measurement"
        emoji="📏"
        label="Measurement"
        collapsed={collapsedIds.has("measurement")}
        onToggle={toggleRow}
      >
        {/* Correct/error live together under one twirl rather than each
            getting its own — you almost always want both at once when
            checking how to score something, not one at a time. */}
        <div className="space-y-2">
          <p>
            <span className="font-semibold">✅ {measurementLabels.positive}: </span>
            {data.measurement.markCorrect}
          </p>
          <p>
            <span className="font-semibold">❌ {measurementLabels.negative}: </span>
            {data.measurement.markError}
          </p>
        </div>
      </AccordionRow>
      <AccordionRow
        id="correction"
        emoji="🤲"
        label="Correction"
        collapsed={collapsedIds.has("correction")}
        onToggle={toggleRow}
      >
        {data.correction}
      </AccordionRow>
      <AccordionRow
        id="materials"
        emoji="📦"
        label="Materials"
        collapsed={collapsedIds.has("materials")}
        onToggle={toggleRow}
      >
        {data.materials}
      </AccordionRow>
      <AccordionRow
        id="notes"
        emoji="💡"
        label="Instructional Notes"
        collapsed={collapsedIds.has("notes")}
        onToggle={toggleRow}
      >
        {data.instructionalNotes}
      </AccordionRow>
    </div>
  );
}
