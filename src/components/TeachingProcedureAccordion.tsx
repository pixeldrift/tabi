import { useState } from "react";
import {
  AlignLeft,
  Target,
  Brain,
  ClipboardList,
  ArrowRight,
  Ruler,
  HandHelping,
  Package,
  Lightbulb,
  Check,
  X,
  Plus,
  Minus,
  Video,
  Play,
} from "lucide-react";
import { AccordionRow } from "./AccordionRow";
import { ROUNDED_STAR_PATH } from "./RatingCard";
import type { CardKind } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export interface TeachingProcedure {
  goal: string;
  rationale: string;
  procedure: string;
  /** Omit entirely (not "None"/"Not applicable") for a card with nothing
   *  meaningful to say here — a holistic, once-per-session rating has no
   *  single discriminative stimulus that occasions it the way a discrete
   *  trial does, so the row itself doesn't apply, not just its answer. */
  sd?: string;
  /** Most kinds score a binary correct/error distinction; rating cards
   *  instead have a multi-point scale — one row per level rather than a
   *  fixed positive/negative pair. */
  measurement:
    | { markCorrect: string; markError: string }
    | { scale: { value: number; description: string }[] };
  /** Omit entirely, same reasoning as `sd` — a subjective end-of-session
   *  rating has no single incorrect response to correct the way a scored
   *  trial does. */
  correction?: string;
  /** Omit entirely (not "None") when there's nothing to actually gather or
   *  prepare — most behavior-tracking cards are a plain tally or timed
   *  observation with no dedicated materials, so the row would otherwise
   *  just repeat "None" across most cards in the set for no benefit. Keep
   *  it wherever a tech genuinely needs to source or set up something
   *  specific beforehand. */
  materials?: string;
  instructionalNotes: string;
}

const ROW_IDS = [
  "video",
  "description",
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
  interval: { positive: "Mark Correct if", negative: "Mark Incorrect if" },
  checklist: { positive: "Check off if", negative: "Leave unchecked if" },
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
  description,
  data,
  kind,
  measurementLabelOverride,
}: {
  /** Short "what to tally/score" instruction for this target — its own row,
   *  directly before Goal, collapsed by default like the rest. Independent
   *  of `data`: a card can have a description with no full teaching
   *  procedure (e.g. a single end-of-session rating), in which case this is
   *  the only row the table renders. */
  description?: string;
  data?: TeachingProcedure;
  kind: CardKind;
  /** Overrides the kind's default positive/negative row labels — for a card
   *  whose own scoring buttons use bespoke wording (e.g. an Interval card
   *  scoring "Dry"/"Wet/Soiled" instead of the generic "Correct"/
   *  "Incorrect") so the drawer's Measurement row always names the exact
   *  button it's describing. */
  measurementLabelOverride?: { positive: string; negative: string };
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(ROW_IDS.filter((id) => !DEFAULT_EXPANDED.has(id))),
  );
  const measurementLabels = measurementLabelOverride ?? MEASUREMENT_LABELS[kind];
  // Frequency/Rate are plain tallies — the badge below should read as the
  // exact +/- button the instructions refer to, not a generic correct/error
  // checkmark, since there's no "response" being scored, just a count.
  const isTally = kind === "frequency" || kind === "rate";

  const toggleRow = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-stone-100 rounded-xl border border-border bg-white overflow-hidden text-sm">
      <AccordionRow
        id="video"
        icon={<Video className="size-3.5" />}
        label="Video"
        collapsed={collapsedIds.has("video")}
        onToggle={toggleRow}
      >
        {/* Same static placeholder as DrawerInfoModal's own tutorial-clip
            slot (16:9, black, centered play glyph) — not a real source, just
            standing in for a future short demonstration clip until one
            actually exists. */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
          role="img"
          aria-label="Tutorial video placeholder"
        >
          <span className="absolute inset-0 grid place-items-center">
            <Play className="size-10 text-blue-500" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      </AccordionRow>
      {description && (
        <AccordionRow
          id="description"
          icon={<AlignLeft className="size-3.5" />}
          label="Description"
          collapsed={collapsedIds.has("description")}
          onToggle={toggleRow}
        >
          {description}
        </AccordionRow>
      )}
      {data && (
        <>
          <AccordionRow
            id="goal"
            icon={<Target className="size-3.5" />}
            label="Goal"
            collapsed={collapsedIds.has("goal")}
            onToggle={toggleRow}
          >
            {data.goal}
          </AccordionRow>
          <AccordionRow
            id="rationale"
            icon={<Brain className="size-3.5" />}
            label="Rationale"
            collapsed={collapsedIds.has("rationale")}
            onToggle={toggleRow}
          >
            {data.rationale}
          </AccordionRow>
          <AccordionRow
            id="procedure"
            icon={<ClipboardList className="size-3.5" />}
            label="Procedure"
            collapsed={collapsedIds.has("procedure")}
            onToggle={toggleRow}
          >
            {data.procedure}
          </AccordionRow>
          {data.sd && (
            <AccordionRow
              id="sd"
              icon={<ArrowRight className="size-3.5" />}
              label="SD"
              collapsed={collapsedIds.has("sd")}
              onToggle={toggleRow}
            >
              {data.sd}
            </AccordionRow>
          )}
          <AccordionRow
            id="measurement"
            icon={<Ruler className="size-3.5" />}
            label="Measurement"
            collapsed={collapsedIds.has("measurement")}
            onToggle={toggleRow}
          >
            {/* Correct/error live together under one twirl rather than each
            getting its own — you almost always want both at once when
            checking how to score something, not one at a time. Each badge
            below is a small copy of the actual scoring button it refers to
            (same Check/X glyph, same green/red circle), not a generic
            checkmark/cross, so the instructions visually point at the exact
            button they describe. Rating cards score a multi-point scale
            instead of a binary correct/error, so they get one row per
            level (same badge + bold-label + description shape, just
            repeated) rather than the fixed positive/negative pair. */}
            <div className="space-y-2">
              {"scale" in data.measurement ? (
                data.measurement.scale.map((level) => (
                  <p key={level.value} className="flex gap-1.5">
                    <ScaleStarBadge value={level.value} />
                    <span>{level.description}</span>
                  </p>
                ))
              ) : (
                <>
                  <p className="flex gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 mt-0.5 grid place-items-center size-4 rounded-full",
                        isTally
                          ? "bg-blue-500 text-white"
                          : "border-[1.5px] border-green-300 bg-green-50 text-green-700",
                      )}
                    >
                      {isTally ? (
                        <Plus className="size-2.5" strokeWidth={3} />
                      ) : (
                        <Check className="size-2.5" strokeWidth={3} />
                      )}
                    </span>
                    <span>
                      <span className="font-semibold">{measurementLabels.positive}: </span>
                      {data.measurement.markCorrect}
                    </span>
                  </p>
                  <p className="flex gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 mt-0.5 grid place-items-center size-4 rounded-full border-[1.5px]",
                        isTally
                          ? "border-border bg-white text-foreground/70"
                          : "border-red-300 bg-red-50 text-red-700",
                      )}
                    >
                      {isTally ? (
                        <Minus className="size-2.5" strokeWidth={3} />
                      ) : (
                        <X className="size-2.5" strokeWidth={3} />
                      )}
                    </span>
                    <span>
                      <span className="font-semibold">{measurementLabels.negative}: </span>
                      {data.measurement.markError}
                    </span>
                  </p>
                </>
              )}
            </div>
          </AccordionRow>
          {data.correction && (
            <AccordionRow
              id="correction"
              icon={<HandHelping className="size-3.5" />}
              label="Correction"
              collapsed={collapsedIds.has("correction")}
              onToggle={toggleRow}
            >
              {data.correction}
            </AccordionRow>
          )}
          {data.materials && (
            <AccordionRow
              id="materials"
              icon={<Package className="size-3.5" />}
              label="Materials"
              collapsed={collapsedIds.has("materials")}
              onToggle={toggleRow}
            >
              {data.materials}
            </AccordionRow>
          )}
          <AccordionRow
            id="notes"
            icon={<Lightbulb className="size-3.5" />}
            label="Instructional Notes"
            collapsed={collapsedIds.has("notes")}
            onToggle={toggleRow}
          >
            {data.instructionalNotes}
          </AccordionRow>
        </>
      )}
    </div>
  );
}

// A plain (non-interactive) copy of RatingCard's own star-with-a-number-
// inside look, for describing what each level of a rating scale means —
// this is reference text, not a picker, so unlike RatingCard's ascending-
// size row every level reads at the same fixed size here.
function ScaleStarBadge({ value }: { value: number }) {
  return (
    <span aria-hidden className="relative shrink-0 mt-0.5 size-5 grid place-items-center">
      <svg viewBox="0 0 24 24" className="absolute inset-0 fill-blue-100 stroke-blue-300">
        <path d={ROUNDED_STAR_PATH} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      <span className="relative text-[10px] font-bold text-blue-700 tabular-nums leading-none">
        {value}
      </span>
    </span>
  );
}
