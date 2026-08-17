import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DATA_TYPE_INFO, PHASE_INFO } from "@/lib/dataTypeInfo";
import { PROMPT_LEVEL_ICONS } from "@/lib/promptLevels";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type { CardKind } from "./DataToolbarContext";
import type { CardConfig } from "@/routes/index";

const KIND_ORDER: CardKind[] = [
  "trial",
  "frequency",
  "rate",
  "duration",
  "task-analysis",
  "rating",
  "timestamp",
];

// Same order PROMPT_LEVEL_ICONS declares them in (least to most intrusive) —
// Object.keys preserves insertion order, so this stays in sync with that
// module without a second list to maintain.
const PROMPT_LEVEL_NAMES = Object.keys(PROMPT_LEVEL_ICONS);
const KNOWN_PHASES = Object.keys(PHASE_INFO);

/** One row of a kind's own field set (CARD-TYPES.md §5) as data, not JSX —
 *  the "template" a single SchemaField renderer below walks, so adding or
 *  adjusting a kind's fields never means writing a new block of markup.
 *  Deliberately excludes: the two "TEMPORARY test hook" `locked` fields
 *  (Rate/Timestamp), `stepPlan` (Task Analysis's per-step expected-mastery
 *  plan), and `levelDescriptions` (Rating — already has a working generic
 *  placeholder fallback) — see docs/CARD-TYPES.md §6 for why. */
interface FieldSchema {
  /** Matches the CardConfig field name directly, so submission is a
   *  straight fold over the schema instead of per-kind assembly code. */
  key: string;
  label: string;
  type: "text" | "number" | "switch" | "promptLevels" | "steps" | "chainingDirection";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

const KIND_FIELD_SCHEMAS: Record<CardKind, FieldSchema[]> = {
  trial: [
    {
      key: "minTrials",
      label: "Minimum trials",
      type: "number",
      helpText: "Completion threshold when no maximum is set below.",
    },
    {
      key: "maxTrials",
      label: "Maximum trials",
      type: "number",
      helpText: "Hard cap on trials shown — also the completion threshold when set.",
    },
    {
      key: "noResponse",
      label: 'Allow "No Response"',
      type: "switch",
      helpText: "Adds a third, neutral option between Error and Correct.",
    },
    {
      key: "promptLevels",
      label: "Prompt levels",
      type: "promptLevels",
      helpText: "When set, Error opens a picker for these levels instead of a plain toggle.",
    },
  ],
  frequency: [
    {
      key: "minCount",
      label: "Minimum count",
      type: "number",
      required: true,
      helpText: "Completion threshold.",
    },
    {
      key: "behaviorRole",
      label: "Interfering behavior",
      type: "switch",
      helpText: "A reduction goal — zero instances counts as complete data, not missing data.",
    },
  ],
  rate: [
    {
      key: "minDurationSec",
      label: "Minimum duration (seconds)",
      type: "number",
      helpText: 'Required observation window before this is "complete."',
    },
  ],
  duration: [
    {
      key: "minDurationSec",
      label: "Minimum duration (seconds)",
      type: "number",
      helpText: 'Required cumulative duration before this is "complete."',
    },
    {
      key: "behaviorRole",
      label: "Interfering behavior",
      type: "switch",
      helpText: "A reduction goal — zero duration counts as complete data, not missing data.",
    },
  ],
  "task-analysis": [
    {
      key: "steps",
      label: "Steps",
      type: "steps",
      required: true,
      helpText: "One entry per step in the chain, in order.",
    },
    { key: "chainingDirection", label: "Chaining direction", type: "chainingDirection" },
    {
      key: "promptLevels",
      label: "Prompt levels",
      type: "promptLevels",
      helpText: 'Applied to the "Prompted" button instead of "Error."',
    },
  ],
  rating: [
    { key: "min", label: "Minimum score", type: "number", placeholder: "0" },
    {
      key: "max",
      label: "Maximum score",
      type: "number",
      required: true,
      helpText: "Also the number of stars shown.",
    },
  ],
  timestamp: [
    { key: "intervalMin", label: "Interval length (minutes)", type: "number", required: true },
    {
      key: "intervalCount",
      label: "Total intervals",
      type: "number",
      helpText: "Omit for an open-ended card that keeps showing new intervals all session.",
    },
    {
      key: "defaultWindowHours",
      label: "Default window (hours)",
      type: "number",
      placeholder: "4",
    },
    { key: "positiveLabel", label: "Positive label", type: "text", placeholder: "Correct" },
    { key: "negativeLabel", label: "Negative label", type: "text", placeholder: "Incorrect" },
  ],
};

type Content = Record<string, unknown>;

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "card";
}

/** Appends a numeric suffix until the id doesn't collide with an existing
 *  card — titles aren't required to be unique, ids are. */
function uniqueId(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

/** Whether every `required` field in a kind's schema has a real value —
 *  gates the submit button. `steps` needs at least one non-blank row;
 *  every other required type just needs a defined value. */
function kindContentValid(kind: CardKind, content: Content): boolean {
  return KIND_FIELD_SCHEMAS[kind]
    .filter((f) => f.required)
    .every((f) => {
      if (f.type === "steps") {
        const steps = (content[f.key] as string[] | undefined) ?? [];
        return steps.some((s) => !isBlank(s));
      }
      return content[f.key] !== undefined && content[f.key] !== "";
    });
}

/** Folds the form's flat `content` bag into the exact CardConfig shape for
 *  the picked kind — the one place that knows which schema key lands on
 *  which discriminated-union field. */
function buildCardConfig(
  id: string,
  kind: CardKind,
  title: string,
  phase: string,
  description: string,
  content: Content,
): CardConfig {
  const behaviorRole: "interfering" | undefined = content.behaviorRole ? "interfering" : undefined;
  const promptLevels = (content.promptLevels as string[] | undefined)?.filter((l) => !isBlank(l));
  const num = (key: string) =>
    typeof content[key] === "number" ? (content[key] as number) : undefined;
  const str = (key: string) => (isBlank(content[key]) ? undefined : (content[key] as string));

  switch (kind) {
    case "trial":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        minTrials: num("minTrials"),
        maxTrials: num("maxTrials"),
        noResponse: Boolean(content.noResponse) || undefined,
        promptLevels: promptLevels?.length ? promptLevels : undefined,
      };
    case "frequency":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        minCount: num("minCount") ?? 0,
      };
    case "rate":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        minDurationSec: num("minDurationSec"),
      };
    case "duration":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        minDurationSec: num("minDurationSec"),
      };
    case "task-analysis": {
      const steps = ((content.steps as string[] | undefined) ?? []).filter((s) => !isBlank(s));
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        steps,
        chainingDirection: content.chainingDirection === "backward" ? "backward" : undefined,
        promptLevels: promptLevels?.length ? promptLevels : undefined,
      };
    }
    case "rating":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        min: num("min"),
        max: num("max") ?? 5,
      };
    case "timestamp":
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        intervalMin: num("intervalMin") ?? 30,
        intervalCount: num("intervalCount"),
        defaultWindowHours: num("defaultWindowHours"),
        positiveLabel: str("positiveLabel"),
        negativeLabel: str("negativeLabel"),
      };
  }
}

/** One control per field `type` — the generic renderer every kind's field
 *  list shares, so a kind's own section below is just a `.map()` over its
 *  schema rather than seven near-identical blocks of markup. */
function SchemaField({
  field,
  value,
  onChange,
}: {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "switch") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="text-sm font-medium">{field.label}</label>
          {field.helpText && (
            <p className="text-xs text-muted-foreground/80 mt-0.5">{field.helpText}</p>
          )}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} className="shrink-0" />
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>
      {field.helpText && (
        <p className="text-xs text-muted-foreground/80 mt-0.5 mb-1.5">{field.helpText}</p>
      )}
      {field.type === "text" && (
        <Input
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(field.helpText ? "" : "mt-1.5")}
        />
      )}
      {field.type === "number" && (
        <Input
          type="number"
          value={value === undefined ? "" : (value as number)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className={cn(field.helpText ? "" : "mt-1.5")}
        />
      )}
      {field.type === "promptLevels" && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {PROMPT_LEVEL_NAMES.map((level) => {
            const selected = ((value as string[] | undefined) ?? []).includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  const current = (value as string[] | undefined) ?? [];
                  onChange(selected ? current.filter((l) => l !== level) : [...current, level]);
                }}
                aria-pressed={selected}
                className={cn(
                  "h-8 rounded-full border-2 px-3 text-xs font-medium transition-colors",
                  selected
                    ? "btn-bevel bg-amber-500 border-amber-600 text-white"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
                )}
              >
                {level}
              </button>
            );
          })}
        </div>
      )}
      {field.type === "chainingDirection" && (
        <div className="mt-1.5 flex items-center gap-1 rounded-full border border-border bg-stone-100/60 p-1 w-fit">
          {(["forward", "backward"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => onChange(dir)}
              aria-pressed={(value ?? "forward") === dir}
              className={cn(
                "h-8 rounded-full px-4 text-sm font-medium capitalize transition-colors",
                (value ?? "forward") === dir
                  ? "btn-bevel bg-blue-500 text-white"
                  : "text-stone-500 hover:text-stone-800",
              )}
            >
              {dir}
            </button>
          ))}
        </div>
      )}
      {field.type === "steps" && (
        <StepListField
          steps={(value as string[] | undefined) ?? [""]}
          onChange={(steps) => onChange(steps)}
        />
      )}
    </div>
  );
}

function StepListField({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
            {i + 1}
          </span>
          <Input
            value={step}
            placeholder={`Step ${i + 1}`}
            onChange={(e) => {
              const next = [...steps];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(steps.length > 1 ? steps.filter((_, j) => j !== i) : [""])}
            aria-label={`Remove step ${i + 1}`}
            className="shrink-0 grid place-items-center size-7 rounded-full text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...steps, ""])}
        className="-ml-2 self-start text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add step
      </Button>
    </div>
  );
}

export function AddCardDialog({
  open,
  onOpenChange,
  existingIds,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every id already in use — a fresh one is slugified from the title and
   *  de-duplicated against this set before the card is created. */
  existingIds: Set<string>;
  onCreate: (card: CardConfig) => void;
}) {
  const [kind, setKind] = useState<CardKind | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<Content>({});

  const reset = () => {
    setKind(null);
    setTitle("");
    setPhase("");
    setDescription("");
    setContent({});
  };

  const isValid =
    kind !== null &&
    !isBlank(title) &&
    !isBlank(phase) &&
    !isBlank(description) &&
    kindContentValid(kind, content);

  const handleCreate = () => {
    if (!kind || !isValid) return;
    const id = uniqueId(slugify(title), existingIds);
    const card = buildCardConfig(id, kind, title.trim(), phase.trim(), description.trim(), content);
    onCreate(card);
    playSoundEffect("success");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg h-[calc(100dvh-4rem)] flex flex-col gap-0 overflow-hidden rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border pb-4">
          <DialogTitle>Add New Card</DialogTitle>
          <DialogDescription>
            Define a new goal or behavior for the treatment plan. It'll show up in the Data tab
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6 mt-4 pb-1">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Data type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {KIND_ORDER.map((k) => {
                const info = DATA_TYPE_INFO[k];
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setKind(k);
                      setContent({});
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border-2 p-2.5 text-left transition-colors",
                      selected
                        ? "border-blue-400 bg-blue-50"
                        : "border-border bg-white hover:bg-stone-50",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 grid place-items-center size-7 rounded-full [&>svg]:size-3.5",
                        selected ? "bg-blue-500 text-white" : "bg-stone-100 text-stone-500",
                      )}
                    >
                      {info.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {info.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {kind && (
              <p className="text-xs text-muted-foreground/80 mt-2">
                {DATA_TYPE_INFO[kind].description}
              </p>
            )}
          </div>

          {kind && (
            <>
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground -mb-2">
                  Basics
                </h3>
                <div>
                  <label htmlFor="new-card-title" className="text-sm font-medium">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="new-card-title"
                    className="mt-1.5"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Requests preferred item"
                  />
                </div>
                <div>
                  <label htmlFor="new-card-phase" className="text-sm font-medium">
                    Phase <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="new-card-phase"
                    className="mt-1.5"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    placeholder="e.g. Baseline"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {KNOWN_PHASES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPhase(p)}
                        className={cn(
                          "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                          phase === p
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-border text-muted-foreground hover:bg-stone-50",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="new-card-description" className="text-sm font-medium">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 mb-1.5">
                    Short "what to tally/score" instruction — shown in the card's own details
                    drawer.
                  </p>
                  <textarea
                    id="new-card-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-2xl border border-input bg-white px-3 py-2 text-sm shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)] transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    placeholder="Score correct if…"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground -mb-2">
                  {DATA_TYPE_INFO[kind].label} details
                </h3>
                {KIND_FIELD_SCHEMAS[kind].map((field) => (
                  <SchemaField
                    key={field.key}
                    field={field}
                    value={content[field.key]}
                    onChange={(v) => setContent((prev) => ({ ...prev, [field.key]: v }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4 flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!isValid}
            className="btn-bevel rounded-full bg-blue-500 hover:bg-blue-600 text-white w-full"
          >
            Create Card
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
