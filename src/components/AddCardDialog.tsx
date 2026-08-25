import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATA_TYPE_INFO, PHASE_INFO } from "@/lib/dataTypeInfo";
import { PHASE_ICONS } from "@/lib/phaseIcons";
import { PROMPT_LEVEL_ICONS } from "@/lib/promptLevels";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import { ROUNDED_STAR_PATH } from "./RatingCard";
import { TimeKeypad } from "./TimeKeypad";
import { TimeOfDayKeypad, formatTimeOfDay } from "./TimeOfDayKeypad";
import { formatCompactTime } from "./DurationCard";
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
  "checklist",
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
  type:
    | "text"
    | "number"
    | "switch"
    | "promptLevels"
    | "steps"
    | "chainingDirection"
    | "ranking"
    | "checklistItems"
    | "checkpointMode"
    | "checkpoints";
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
      helpText: "Hard cap on trials shown. It's also the completion threshold when set.",
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
      helpText: "A reduction goal. Zero instances counts as complete data, not missing data.",
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
      helpText: "A reduction goal. Zero duration counts as complete data, not missing data.",
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
    {
      key: "levelDescriptions",
      label: "Rankings",
      type: "ranking",
      required: true,
      helpText: "One entry per star, low to high. That's the number of stars shown.",
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
    {
      key: "checkpointMode",
      label: "Checkpoint scheduling",
      type: "checkpointMode",
      helpText:
        "Time of Day checkpoints below fire a real alert (with a scoreable popup) at that clock time. Interval checkpoints are authored but not yet wired up — the card still runs on the fixed interval above in that case.",
    },
    {
      key: "checkpoints",
      label: "Checkpoints",
      type: "checkpoints",
      helpText:
        "Optional named checkpoints. In Time of Day mode, each one alerts independently when its time arrives — use Alert text below to set what the notification says.",
    },
  ],
  checklist: [
    {
      key: "items",
      label: "Items",
      type: "checklistItems",
      required: true,
      helpText: "One entry per item, in order. Description is optional, shown in expanded view.",
    },
  ],
};

/** Slide+fade variants for the two-step wizard body. `direction` (passed in
 *  as the `custom` prop) picks which side each step enters/exits from, so
 *  "Next" and "Back" animate as mirror images of each other rather than
 *  both always sliding the same way. */
const STEP_VARIANTS = {
  enter: (direction: 1 | -1) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({ x: direction > 0 ? "-100%" : "100%", opacity: 0 }),
};
const STEP_TRANSITION = { duration: 0.25, ease: "easeInOut" as const };

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
      if (f.type === "steps" || f.type === "ranking") {
        const rows = (content[f.key] as string[] | undefined) ?? [];
        return rows.some((s) => !isBlank(s));
      }
      if (f.type === "checklistItems") {
        const rows = (content[f.key] as { label: string; description: string }[] | undefined) ?? [];
        return rows.some((r) => !isBlank(r.label));
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
    case "rating": {
      const levelDescriptions = ((content.levelDescriptions as string[] | undefined) ?? []).filter(
        (s) => !isBlank(s),
      );
      return {
        id,
        kind,
        title,
        phase,
        description,
        behaviorRole,
        max: levelDescriptions.length,
        levelDescriptions,
      };
    }
    case "timestamp": {
      const checkpointMode = content.checkpointMode === "timeOfDay" ? "timeOfDay" : "interval";
      const rawCheckpoints =
        (content.checkpoints as
          { time: number | string; label: string; alertText?: string }[] | undefined) ?? [];
      const checkpoints = rawCheckpoints
        .filter((c) => !isBlank(c.label))
        .map((c) => ({
          // Normalized to a plain display string regardless of mode (H:MM:SS
          // elapsed, or "h:mma" clock time) — Interval mode doesn't consume
          // this yet (see the field's own helpText), so there's no reason to
          // carry two different raw shapes (ms vs "HH:MM") past this point.
          time:
            checkpointMode === "timeOfDay"
              ? formatTimeOfDay(typeof c.time === "string" ? c.time : "")
              : formatCompactTime(typeof c.time === "number" ? c.time : 0),
          label: c.label.trim(),
          alertText: isBlank(c.alertText) ? undefined : c.alertText!.trim(),
        }));
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
        checkpointMode: checkpoints.length ? checkpointMode : undefined,
        checkpoints: checkpoints.length ? checkpoints : undefined,
      };
    }
    case "checklist": {
      const rawItems =
        (content.items as { label: string; description: string }[] | undefined) ?? [];
      const items = rawItems
        .filter((r) => !isBlank(r.label))
        .map((r) => ({
          label: r.label.trim(),
          description: isBlank(r.description) ? undefined : r.description.trim(),
        }));
      return {
        id,
        kind,
        title,
        phase,
        description,
        items,
      };
    }
  }
}

/** One control per field `type` — the generic renderer every kind's field
 *  list shares, so a kind's own section below is just a `.map()` over its
 *  schema rather than seven near-identical blocks of markup. */
function SchemaField({
  field,
  value,
  onChange,
  content,
}: {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  /** The kind's whole live form-content bag, not just this field's own
   *  value — only "checkpoints" actually reads it (it needs its sibling
   *  "checkpointMode" field to know which keypad each row's time box
   *  should open), but every field type takes it uniformly rather than
   *  special-casing that one field's own call site. */
  content: Content;
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
      {field.type === "ranking" && (
        <RankingListField
          levels={(value as string[] | undefined) ?? [""]}
          onChange={(levels) => onChange(levels)}
        />
      )}
      {field.type === "checklistItems" && (
        <ChecklistItemsField
          items={
            (value as { label: string; description: string }[] | undefined) ?? [
              { label: "", description: "" },
            ]
          }
          onChange={(items) => onChange(items)}
        />
      )}
      {field.type === "checkpointMode" && (
        <div className="mt-1.5 flex items-center gap-1 rounded-full border border-border bg-stone-100/60 p-1 w-fit">
          {(
            [
              { key: "interval", label: "Interval" },
              { key: "timeOfDay", label: "Time of Day" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={(value ?? "interval") === opt.key}
              className={cn(
                "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                (value ?? "interval") === opt.key
                  ? "btn-bevel bg-blue-500 text-white"
                  : "text-stone-500 hover:text-stone-800",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {field.type === "checkpoints" && (
        <CheckpointItemsField
          mode={content.checkpointMode === "timeOfDay" ? "timeOfDay" : "interval"}
          items={
            (value as
              { time: number | string; label: string; alertText?: string }[] | undefined) ?? [
              { time: "", label: "" },
            ]
          }
          onChange={(items) => onChange(items)}
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

const RANKING_STAR_SIZE = 28;

/** A fixed-size version of the card interface's own numbered star (see
 *  RatingCard's RatingStar) — every row here is a "filled/selected" star by
 *  definition (it's being authored, not picked), so none of that
 *  component's per-size alignment math or tap/select animation applies. */
function RankingStar({ value }: { value: number }) {
  return (
    <span
      className="relative shrink-0 grid place-items-center"
      style={{ width: RANKING_STAR_SIZE, height: RANKING_STAR_SIZE }}
    >
      <svg
        viewBox="0 0 24 24"
        width={RANKING_STAR_SIZE}
        height={RANKING_STAR_SIZE}
        className="fill-blue-500 stroke-blue-600"
      >
        <path
          d={ROUNDED_STAR_PATH}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xs font-bold text-white tabular-nums">
        {value}
      </span>
    </span>
  );
}

/** A textarea that grows to fit its own content instead of scrolling
 *  internally — resized on every value change (typing, but also an
 *  external reset) rather than only on input events, so it's correct even
 *  when `value` changes from outside (e.g. removing an earlier row shifts
 *  every row's own text up through this same component instance). */
function AutoGrowTextarea({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className="flex w-full resize-none overflow-hidden rounded-2xl border border-input bg-white px-3 py-2 text-sm shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)] transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}

function RankingListField({
  levels,
  onChange,
}: {
  levels: string[];
  onChange: (levels: string[]) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {levels.map((level, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <div className="mt-1">
            <RankingStar value={i + 1} />
          </div>
          <AutoGrowTextarea
            value={level}
            placeholder={`Describe what a score of ${i + 1} looks like.`}
            onChange={(v) => {
              const next = [...levels];
              next[i] = v;
              onChange(next);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(levels.length > 1 ? levels.filter((_, j) => j !== i) : [""])}
            aria-label={`Remove ranking ${i + 1}`}
            className="shrink-0 grid place-items-center size-7 rounded-full text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-colors mt-0.5"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...levels, ""])}
        className="-ml-2 self-start text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add ranking
      </Button>
    </div>
  );
}

function ChecklistItemsField({
  items,
  onChange,
}: {
  items: { label: string; description: string }[];
  onChange: (items: { label: string; description: string }[]) => void;
}) {
  const empty = { label: "", description: "" };
  return (
    <div className="mt-1.5 flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-2 grid place-items-center size-6 rounded-[5px] border-2 border-stone-300 bg-white shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <Input
              value={item.label}
              placeholder={`Item ${i + 1} label`}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
            />
            <AutoGrowTextarea
              value={item.description}
              placeholder="Description shown in expanded view (optional)"
              onChange={(v) => {
                const next = [...items];
                next[i] = { ...next[i], description: v };
                onChange(next);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [empty])}
            aria-label={`Remove item ${i + 1}`}
            className="shrink-0 mt-1 grid place-items-center size-7 rounded-full text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...items, empty])}
        className="-ml-2 self-start text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add item
      </Button>
    </div>
  );
}

/** A checkpoint's own time box — opens TimeKeypad (elapsed h:mm:ss) in
 *  "interval" mode or TimeOfDayKeypad (12h, a.m./p.m.) in "timeOfDay" mode,
 *  same render-prop trigger pattern both keypads already share. Each mode
 *  keeps its own native value shape (ms for interval, 24h "HH:MM" string for
 *  time of day) rather than a shared representation — the row only ever
 *  reads/writes whichever shape matches the currently selected mode, and
 *  switching modes doesn't attempt to convert a row's already-entered value
 *  from one shape to the other. */
function TimeBoxButton({
  mode,
  value,
  onChange,
}: {
  mode: "interval" | "timeOfDay";
  value: number | string | undefined;
  onChange: (value: number | string) => void;
}) {
  if (mode === "timeOfDay") {
    const hhmm = typeof value === "string" ? value : "";
    return (
      <TimeOfDayKeypad value={hhmm} onChange={onChange}>
        {({ open }) => (
          <button
            type="button"
            onClick={open}
            className="h-10 w-[4.5rem] shrink-0 rounded-lg border border-input bg-white text-sm font-medium tabular-nums text-foreground shadow-[inset_0_2px_5px_rgba(0,0,0,0.12)] transition-colors hover:bg-stone-50"
          >
            {hhmm ? formatTimeOfDay(hhmm) : "--:--"}
          </button>
        )}
      </TimeOfDayKeypad>
    );
  }
  const ms = typeof value === "number" ? value : 0;
  return (
    <TimeKeypad valueMs={ms} onReplace={onChange} onAdd={onChange}>
      {({ open }) => (
        <button
          type="button"
          onClick={open}
          className="h-10 w-[4.5rem] shrink-0 rounded-lg border border-input bg-white text-sm font-medium tabular-nums text-foreground shadow-[inset_0_2px_5px_rgba(0,0,0,0.12)] transition-colors hover:bg-stone-50"
        >
          {formatCompactTime(ms)}
        </button>
      )}
    </TimeKeypad>
  );
}

function CheckpointItemsField({
  mode,
  items,
  onChange,
}: {
  mode: "interval" | "timeOfDay";
  items: { time: number | string; label: string; alertText?: string }[];
  onChange: (items: { time: number | string; label: string; alertText?: string }[]) => void;
}) {
  const empty = { time: mode === "timeOfDay" ? "" : 0, label: "", alertText: "" };
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {items.map((item, i) => (
        // Bordered per-checkpoint, not just a bare row — once Time of Day
        // mode adds a second (Alert text) line below the time/label row,
        // nothing else visually ties that second line back to the
        // checkpoint it belongs to.
        <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-2">
          <div className="flex items-center gap-1.5">
            <TimeBoxButton
              mode={mode}
              value={item.time}
              onChange={(time) => {
                const next = [...items];
                next[i] = { ...next[i], time };
                onChange(next);
              }}
            />
            <Input
              value={item.label}
              placeholder={`Checkpoint ${i + 1} label`}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [empty])}
              aria-label={`Remove checkpoint ${i + 1}`}
              className="shrink-0 grid place-items-center size-7 rounded-full text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {/* Only meaningful once this checkpoint actually fires a real
              alert (Time of Day mode) — Interval mode's checkpoints aren't
              wired up to anything yet, so a text field with no visible
              effect would just read as broken. */}
          {mode === "timeOfDay" && (
            <Input
              value={item.alertText ?? ""}
              placeholder="Alert text (defaults to “Check {label}”)"
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], alertText: e.target.value };
                onChange(next);
              }}
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...items, empty])}
        className="-ml-2 self-start text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add checkpoint
      </Button>
    </div>
  );
}

/** Wraps a step's scrollable content with a persistently visible scrollbar
 *  (pushed to the panel's true right edge — the padding that keeps the text
 *  readable lives on an inner wrapper, not on the scrolling element itself,
 *  so the native scrollbar isn't inset by it) plus top/bottom fade overlays
 *  that appear only while there's actually more content in that direction —
 *  tracked via scroll position rather than shown unconditionally, so the
 *  fade reads as "more below" instead of a fixed decorative vignette. */
function ScrollFade({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 1);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  return (
    <div className="relative h-full">
      <div
        ref={ref}
        onScroll={update}
        className="h-full overflow-y-auto visible-scrollbar pl-6 pr-2"
      >
        <div className="py-4">{children}</div>
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent transition-opacity duration-150",
          canScrollUp ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent transition-opacity duration-150",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      />
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
  const [step, setStep] = useState<"kind" | "details">("kind");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [kind, setKind] = useState<CardKind | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<Content>({});

  const reset = () => {
    setStep("kind");
    setDirection(1);
    setKind(null);
    setTitle("");
    setPhase("");
    setDescription("");
    setContent({});
  };

  const goToDetails = () => {
    if (!kind) return;
    setDirection(1);
    setStep("details");
  };

  const goBackToKind = () => {
    setDirection(-1);
    setStep("kind");
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
        <DialogHeader className="text-left sm:text-left shrink-0 border-b border-border pb-4">
          <DialogTitle>Add New Card</DialogTitle>
          <DialogDescription className="text-left">
            Define a new goal or behavior for the treatment plan. It'll show up in the Data tab
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-0 overflow-hidden -mx-6">
          <AnimatePresence initial={false} custom={direction}>
            {step === "kind" ? (
              <motion.div
                key="kind"
                custom={direction}
                variants={STEP_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={STEP_TRANSITION}
                className="absolute inset-0"
              >
                <ScrollFade>
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
                            "flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-colors",
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
                </ScrollFade>
              </motion.div>
            ) : (
              kind && (
                <motion.div
                  key="details"
                  custom={direction}
                  variants={STEP_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={STEP_TRANSITION}
                  className="absolute inset-0"
                >
                  <ScrollFade>
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 grid place-items-center size-8 rounded-full bg-blue-500 text-white [&>svg]:size-4">
                          {DATA_TYPE_INFO[kind].icon}
                        </span>
                        <span className="text-sm font-semibold">{DATA_TYPE_INFO[kind].label}</span>
                      </div>

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
                          <Select value={phase} onValueChange={setPhase}>
                            <SelectTrigger id="new-card-phase" className="mt-1.5">
                              <SelectValue placeholder="Select phase to start in" />
                            </SelectTrigger>
                            <SelectContent>
                              {KNOWN_PHASES.map((p) => {
                                const PhaseIcon = PHASE_ICONS[p];
                                return (
                                  <SelectItem key={p} value={p}>
                                    <span className="flex items-center gap-2">
                                      {PhaseIcon && <PhaseIcon className="size-3.5" />}
                                      {p}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label htmlFor="new-card-description" className="text-sm font-medium">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <p className="text-xs text-muted-foreground/80 mt-0.5 mb-1.5">
                            Short "what to tally/score" instruction. It's shown in the card's own
                            details drawer.
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
                            content={content}
                          />
                        ))}
                      </div>
                    </div>
                  </ScrollFade>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4 flex-col gap-2 sm:flex-col sm:space-x-0 items-stretch">
          {step === "kind" ? (
            <>
              <Button
                type="button"
                onClick={goToDetails}
                disabled={kind === null}
                className="btn-bevel rounded-full bg-blue-500 hover:bg-blue-600 text-white w-full"
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!isValid}
                className="btn-bevel rounded-full bg-blue-500 hover:bg-blue-600 text-white w-full"
              >
                Create Card
              </Button>
              <Button type="button" variant="ghost" onClick={goBackToKind} className="w-full">
                Back
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
