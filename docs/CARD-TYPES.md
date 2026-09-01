# Card Type Definitions

Reverse-engineered field spec for every data-card "kind" (the WordPress
custom-post-type equivalent here), covering every field that's currently
either persisted config (`CardConfig`), computed at runtime for the data
toolbar, or surfaced in the details drawer. Originally written as the
reference to build "Add New Card" (goal/behavior) creation against — that
form now exists (§9) — this doc still serves as the canonical field spec
for every kind, and as the checklist for adding a new one.

Not code. No file paths beyond what's needed to trace a field back to its
source — this is a content/data-model spec, not an implementation plan.

## 1. The 10 kinds

The discriminant is called `kind`, not `type` (the app already uses `type`
for other things). One card is always exactly one kind, chosen once — there
is no evidence anywhere of a kind changing after creation, and the field
sets are different enough per kind (see §4) that switching kind on an
existing card would mean discarding most of its config. Treat kind as
fixed-at-creation, same as a WordPress post type.

| `kind` slug | Full name (info modal) | Short (cards/filters) | Icon | One-line description shown in its own info modal |
|---|---|---|---|---|
| `trial` | Percent Correct | Percent | `PercentCorrectIcon` | Tracks correct vs. incorrect responses across a set of discrete trials, then reports the percentage answered correctly. Best for skills with a clear right or wrong answer. |
| `frequency` | Frequency | Frequency | `FrequencyIcon` | Counts how many times a behavior occurs during an observation period. Best for behaviors with a clear, quick start and end. |
| `rate` | Rate | Rate | `RateIcon` | Counts occurrences the same way Frequency does, but divides by the length of the observation to produce a rate (count per hour), so sessions of different lengths stay comparable. |
| `duration` | Duration | Duration | `DurationIcon` | Times how long a behavior lasts, from start to finish, using a built-in stopwatch per instance. |
| `task-analysis` | Task Analysis | Task | `TaskAnalysisIcon` | Breaks a multi-step skill into its individual steps, then tracks each step's own level of independence. |
| `rating` | Score | Score | `Star` (filled, lucide) | Captures a subjective rating on a fixed scale for something that isn't a simple count. |
| `interval` | Interval | Interval | `IntervalIcon` | Checks in at fixed time intervals (or scheduled times of day) and marks whether the target behavior is or isn't occurring at each check, rather than counting or timing it directly — useful for spotting time-of-day patterns. |
| `checklist` | Checklist | Checklist | `ChecklistIcon` | A fixed list of items to check off as applicable, rather than tallied or timed. Best for a set of indicators observed over a session where each one either applies or doesn't. |
| `timestamp` | Timestamp | Timestamp | `Stamp` (lucide) | Logs the exact date and time something happened — a simple, ongoing record of moments, not a count, duration, or interval check. |
| `product` | Permanent Work Product | Product | `ProductIcon` | Collects photos of a tangible work sample a client produced (a completed worksheet, a drawing), rather than a count, duration, or rating. |

Each row's two name columns, icon, and full description live in
`DATA_TYPE_INFO` (`src/lib/dataTypeInfo.ts`) as `label` (full name), `icon`,
and `description`; the short column is that same entry's `shortLabel`. A
card's own header, its List/Grid row, and the toolbar's kind-filter chips
all show `shortLabel` — the full `label` only ever appears as the "Data
type" info modal's own title (opened by tapping that short label) and in
AddCardDialog's kind-picker step, where there's room and a reason to spell
it out. Most kinds have nowhere shorter to go (a single word), so the two
columns above are identical for everything except Percent Correct, Task
Analysis, and Permanent Work Product. A creation form's kind-picker step
should reuse `label` + `icon` + `description` directly — it's already
written and already the thing a tech sees when they tap "what is this?" on
an existing card.

## 2. Fields common to every kind

Pulled straight off `CardConfig`'s shared intersection
(`src/routes/index.tsx`) plus the pieces every card component independently
re-declares (`title`, `phase`, `description`) even though they aren't
factored onto a shared type today:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Stable identity for drag-reorder, favoriting, hiding, and active-card tracking. Not shown to the user; a creation form should slugify the title (or generate one) rather than ask for it. |
| `kind` | one of the 10 slugs | yes | Fixed at creation — see §1. |
| `title` | `string` | yes | The goal/behavior name. |
| `phase` | `string` | yes | Free text, not an enum — but the app ships with 6 recognized values that get an explanatory info-modal, same mechanism as §1's data-type modal (see table below); anything else just shows the plain string with no extra icon/copy. A creation form should offer those 6 as suggestions/defaults, not hard-restrict input to them. |
| `description` | `string` | yes | Short "what to tally/score" instruction — shown as its own row in the details drawer, always visible even on a card with no full `teachingProcedure` filled in yet. |
| `behaviorRole` | `"interfering"` \| omitted | no | Marks a reduction goal (something you want to see *less* of) instead of the default acquisition goal. Drives the "target vs. interfering" toolbar filter for every kind, but **only `frequency` and `duration` cards currently read it for anything else** — see §6 gap. |
| `teachingProcedure` | `TeachingProcedure` object \| omitted | no | See §3. Optional — a card can have just a `description` and nothing else if the full procedure isn't authored yet. |

### Recognized phases

Same "known vocabulary, custom values degrade gracefully" pattern as
prompt levels (§7) — these live in `PHASE_INFO`/`PHASE_ICONS`
(`src/lib/phaseIcons.ts`, `src/lib/dataTypeInfo.ts`), ordered to match a
typical treatment plan's actual progression rather than alphabetically:

| Phase | Icon | Meaning |
|---|---|---|
| Baseline | `BaselineIcon` | Standard, untaught activity level — the starting point later progress is measured against. |
| Probing | `ProbingIcon` | A quick, occasional check on a skill to establish where baseline is, without ongoing teaching. |
| Intervention | `InterventionIcon` | A specific teaching strategy or behavior plan is actively being used. |
| Fading | `FadingIcon` | Backing off intervention/reinforcement supports to make the behavior automatic and independent. |
| Maintenance | `MaintenanceIcon` | The behavior has been successfully modified but is still checked/reinforced occasionally to confirm it holds. |
| Mastered | `GraduationCap` (lucide) | Full criteria met and held independently — active teaching and tracking are done; distinct from Maintenance's occasional check-ins. |

### Not part of `CardConfig` — tracked separately, keyed by `id`

These are real per-card state a creation form doesn't need to ask about,
but should know exist so "delete/rename a card" doesn't orphan them:

- **`favorited`** — `Set<string>` of card ids, persisted to
  `localStorage` under the toolbar's own storage key.
- **`cardHidden`** — same shape, same key, separate set.
- **display order** — persisted list of ids; a card not present in it
  falls back to its position in the source `cards` array.
- **all recorded session data** (trial results, tallies, elapsed time,
  scored steps, ratings, etc.) — lives in the card-data store, keyed by
  `id ?? title`. Renaming a card without a stable `id` would silently
  disconnect it from its own history.

## 3. The shared "Teaching Procedure" object

One object shape, reused by all 10 kinds, rendered as a twirldown accordion
in the details drawer (`TeachingProcedureAccordion`):

| Field | Type | Required | Omit entirely when... |
|---|---|---|---|
| `goal` | `string` | yes | — |
| `rationale` | `string` | yes | — |
| `procedure` | `string` | yes | — |
| `sd` | `string` | no | The card has no single discriminative stimulus that occasions it — e.g. a holistic once-per-session rating. |
| `measurement` | see below | yes | — |
| `correction` | `string` | no | There's no single "incorrect response" to correct — same reasoning as `sd` (ratings, mostly). |
| `materials` | `string` | no | Nothing needs to be sourced/set up beforehand — most tally/timed-observation cards. |
| `instructionalNotes` | `string` | yes | — |

`measurement` is itself one of two shapes, and which one applies is
entirely determined by kind — a creation form doesn't ask the user to pick:

- **Binary** — `{ markCorrect: string; markError: string }` — every kind
  except `rating`.
- **Scale** — `{ scale: { value: number; description: string }[] }` — one
  entry per point on the rating's own `min`–`max` range, so it's derived
  from the card's own `levelDescriptions` (§5.6), not authored separately.

The accordion's positive/negative row *labels* (not the content) also vary
by kind, to match whatever the card's own buttons actually say:

| kind | Positive label | Negative label |
|---|---|---|
| `trial` | Mark Correct if | Mark Error if |
| `task-analysis` | Mark Independent if | Mark Error if |
| `frequency` | Counts as an instance if | Does not count if |
| `rate` | Counts as an instance if | Does not count if |
| `duration` | Counts as the same instance if | Does not count if |
| `rating` | Mark Correct if | Mark Error if |
| `interval` | Mark Correct if (overridden per-card, see §5.7) | Mark Incorrect if (ditto) |
| `checklist` | Check off if | Leave unchecked if |
| `timestamp` | Log this if | Don't log if |
| `product` | Add a photo if | Skip if |

One more accordion row exists (**Video**) but isn't backed by a real field
yet — it's a static 16:9 placeholder with a play glyph, standing in for a
future tutorial clip. Worth a `videoUrl?: string` slot in the eventual type
even though nothing reads it today.

## 4. Data status: the "clean/dirty" contract

Every card kind calls one shared hook, `useReportCardStatus(id, hasData,
isComplete, { title, kind, value, unit })`
(`src/components/DataToolbarContext.tsx`). This is what feeds the toolbar's
data/completion filters and the pre-submission review screen — **every
kind computes its own `hasData`/`isComplete` independently**; there's no
shared formula, because "has this been touched" and "has this met its own
minimum" mean something different per kind. A creation form needs to know
which config fields feed into that formula per kind, since that's what
`minTrials`/`minCount`/`min`/etc. are *for* — they're not just display
copy, they're the completion threshold.

| kind | `hasData` (dirty) | `isComplete` (clean/done) | `value` / `unit` shown |
|---|---|---|---|
| `trial` | at least one trial scored | scored count ≥ target (`maxTrials` if set, else `minTrials`) | percent correct once ready, else `"N/target"` / `"Trials"` |
| `task-analysis` | any step, any instance, scored | every step of the current instance scored | `independent/steps.length` / `"Independent"` |
| `frequency` | count > 0, OR (interfering + any elapsed session time) | count ≥ `minCount`, OR the interfering zero-case above | count / `"Total Count"` |
| `rate` | count > 0 OR elapsed > 0 (the clock itself counts as data) | elapsed ≥ `minDurationSec` if set, else count > 0 or elapsed > 0 | count / rate-per-minute |
| `duration` | total ms > 0, OR (interfering, no min, any elapsed session time) | total sec ≥ `minDurationSec` if set, else total ms > 0 or the interfering zero-case | formatted total time / `"Total Time"` |
| `rating` | rating > 0 | same as `hasData` — a rating is binary "picked or not" | rating / `"out of {max}"` |
| `interval` | any interval scored | scored count === total interval count | `scored/total` / `"Intervals Marked"` |
| `checklist` | any item checked | same as `hasData` — no minimum, every item is independently optional | `checked/items.length` / `"Checked"` |
| `timestamp` | any entry logged | same as `hasData` — a bare log has no minimum to fall short of | entry count / `"Entry"`/`"Entries"` |
| `product` | any photo logged | same as `hasData` — no minimum, one photo already counts as a data point | photo count / `"Photo"`/`"Photos"` |

The recurring **"interfering + no minimum ⇒ zero already counts as
complete"** pattern (frequency, duration) exists because a reduction goal's
whole point is *fewer* instances — a session that ran with genuinely zero
occurrences is a complete, meaningful data point, not missing data.
`behaviorRole` is what should gate whether a creation form even offers a
minimum field, or defaults it to "no minimum" — see §6.

## 5. Per-kind unique fields

Everything below is on top of §2's common fields. "Component prop" names
are given because they're occasionally spelled differently than the
`CardConfig` field feeding them (e.g. `stepPlan`'s item type) — a creation
form's output shape should match `CardConfig`, the component prop names are
just here to confirm nothing gets lost in translation.

### 5.1 `trial` (Percent Correct)

| Field | Type | Required | Behavior |
|---|---|---|---|
| `minTrials` | `number` | no | Completion threshold when `maxTrials` is unset. |
| `maxTrials` | `number` | no | Hard cap on trials shown/scoreable; also the completion threshold when set. Either can be omitted alone — "No Min"/"No Max" both render. |
| `noResponse` | `boolean` | no | Adds a third, neutral "No Response" button between Error and Correct. |
| `promptLevels` | `string[]` | no | When set, Error becomes a popover picker for these levels instead of a plain toggle (see §7 for the shared prompt-level vocabulary). |

Drawer quick facts: Minimum, Maximum, Correct (the live percentage).

### 5.2 `frequency`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `minCount` | `number` | yes (per `CardConfig`, though the component itself treats it as optional) | Completion threshold. |

Drawer quick facts: Minimum count, Tally (live count).

### 5.3 `rate`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `minDurationSec` | `number` | no | Required observation window before it's "complete." Omit for interfering behaviors — every instance counts regardless of window length. |
| `locked` | `boolean` | no | **Temporary test hook** — when false, unlocks manual elapsed-time entry instead of following the session clock. Shouldn't be a real creation-form field; flag for removal or promotion to a real feature. |

Drawer quick facts: Minimum (if set), Count, Period (elapsed time).

### 5.4 `duration`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `minDurationSec` | `number` | no | Same semantics as Rate's. Omit for interfering behaviors. |

Drawer quick facts: Minimum (if set), Instances, Total Time.

### 5.5 `task-analysis`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `steps` | `string[]` | yes | One entry per step in the chain. This is the whole point of the kind — a creation form needs a repeatable step-list input, not a single text field. |
| `chainingDirection` | `"forward"` \| `"backward"` | no (defaults to forward) | Forward teaches step 1 first; backward teaches the last step first. Purely which end mastery is expected to cascade from — doesn't change how scoring works. |
| `stepPlan` | array of (prompt-level name \| `"Independent"` \| `null`), same length as `steps` | no | Per-step *expected* mastery level from the chaining plan — informational only, shown as a small badge next to each step, independent of what actually gets scored during a session. |
| `promptLevels` | `string[]` | no | Same picker mechanic as Trial's, applied to the "Prompted" button instead of "Error." |

Also worth noting: steps are individually searchable (see §8) — a step
list isn't just display content, it feeds the global card search.

Drawer quick facts: Chaining (direction), Instances (how many separate runs
through the steps have been started), Steps (count), Scored (`n/steps`),
Independent (`n/steps`).

### 5.6 `rating` (Score)

| Field | Type | Required | Behavior |
|---|---|---|---|
| `min` | `number` | no (defaults to 0) | Inclusive low end. 0 means "unrated," lights no stars. |
| `max` | `number` | yes | Inclusive high end — also literally the number of stars rendered. |
| `levelDescriptions` | `string[]` | no | One line per star (`max - min` entries) describing what that score looks like in practice. Falls back to a generic placeholder per level if omitted. Feeds `measurement.scale` in the teaching-procedure accordion (§3) directly — not authored twice. |

Drawer quick facts: Range (`min–max`), Current score.

Structurally the odd one out: no running trial/tally list, just one
overwritable value per session. `hasData`/`isComplete` collapse to the same
condition (§4) because there's nothing partial about picking a rating.

### 5.7 `interval`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `intervalMin` | `number` | yes | Length of each scored interval, in minutes (e.g. 30, 60). |
| `samplingType` | `"whole"` \| `"partial"` \| `"momentary"` | no (defaults to "whole") | Which of the three standard ABA interval-recording methods this card follows (Whole Interval Recording, Partial Interval Recording, Momentary Time Sampling) — purely presentational (corner label, icon, timeline indicator via `IntervalWholeIcon`/`IntervalPartialIcon`/`IntervalMomentaryIcon`); scoring is Correct/Incorrect either way regardless of which one's picked. |
| `intervalCount` | `number` | no | Total intervals across the whole observation window. Omit for an open-ended card that just keeps showing new intervals for as long as the session runs. |
| `defaultWindowHours` | `number` | no (defaults to 4) | Only relevant when `intervalCount` is omitted — how many hours' worth of intervals to show by default. |
| `positiveLabel` | `string` | no (defaults to "Correct") | Overrides the button + measurement-row label for the positive outcome — e.g. "Dry" instead of "Correct" for a toileting check. |
| `negativeLabel` | `string` | no (defaults to "Incorrect") | Same, for the negative outcome — e.g. "Wet/Soiled." |
| `locked` | `boolean` | no | **Same temporary test hook as Rate's** — unlocks manual elapsed-time entry. Same flag-for-removal note applies. |
| `checkpointMode` | `"interval"` \| `"timeOfDay"` | no | Whether `checkpoints` below are pinned to elapsed time or to a real clock time. Only `"timeOfDay"` is actually consumed today — each of its checkpoints fires a genuine wall-clock alert with its own scoreable popup; `"interval"` checkpoints are authored but the card still just runs on the fixed `intervalMin` above. |
| `checkpoints` | `{ time: string; label: string; alertText?: string }[]` | no | Named checkpoints, each with an already-formatted display time (`"1:23:45"` elapsed, or `"2:30p"` clock time, matching `checkpointMode`). `alertText` is the notification's title when it fires — falls back to a generic "Check {label}" when omitted. |

Drawer quick facts: Interval (length), Scored (`n/total`).

### 5.8 `checklist`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `items` | `{ label: string; description?: string }[]` | yes | One entry per checklist item, in display order. `description` is a secondary line revealed under its item only in the card's own expanded view — omit it for an item with nothing more to say than its own label. |

No minimum/maximum field exists for this kind, deliberately — every item is
independently optional (§4), so there's nothing to threshold against the
way `minTrials`/`minCount`/etc. do for other kinds.

Also worth noting: item labels are individually searchable (see §8), same
as Task Analysis's steps.

Drawer quick facts: Items (count), Checked (`n/items.length`).

### 5.9 `timestamp`

No kind-specific fields — a Timestamp card is a bare, append-only log.
Title/phase/description (§2) are all it needs; every logged entry is just
an epoch-ms timestamp, editable in place via the same time-of-day keypad
used elsewhere in the app.

Drawer quick facts: Entries (count).

### 5.10 `product` (Permanent Work Product)

No kind-specific fields either — same bare-log shape as Timestamp, just
logging photos (as base64 data URLs) instead of moments. Each logged entry
is `{ id, dataUrl, loggedAt }`. Session-only, like every other kind's
recorded data (§2's "not part of `CardConfig`" note) — never written to
`localStorage`, so there's no quota concern from storing full images this
way.

Drawer quick facts: Photos (count).

## 6. Known gaps — still unresolved

AddCardDialog (§9) shipped without resolving any of these; still worth
fixing before leaning on the form more heavily, or before a new kind makes
one of them harder to ignore.

- **`behaviorRole` is declared on every `CardConfig` variant but only
  `frequency` and `duration` actually wire it into their component** (it's
  what drives the "zero already counts as complete" rule in §4). A creation
  form offering "interfering behavior" as a toggle for, say, a Trial card
  would set a field that only affects search/filtering, not that card's own
  completion logic — worth deciding whether to (a) restrict the toggle to
  Frequency/Duration only, or (b) actually wire the other 8 kinds up to
  respect it the same way.
- **`locked` is a "TEMPORARY test hook"** on both Rate and Interval,
  by its own code comment — decide whether it graduates into a real,
  documented feature (manual time entry) or gets dropped before the
  creation form has to explain it to a user (today it doesn't expose the
  field at all, sidestepping the question rather than answering it).
- **`phase` and `promptLevels`/prompt-level names are both "free string
  with a known vocabulary that gracefully degrades"** everywhere else in
  the app (an unrecognized phase or level just shows the plain string with
  no icon/copy) — but AddCardDialog itself hard-restricts both to their
  known set (a `<Select>` of just the 6 phases, §2; a fixed multi-toggle of
  just the 5 prompt levels, §7), with no way to type a custom one in either
  case. Worth reconciling: either loosen the form to a suggest-or-type
  input for both, matching the rest of the app's own stated philosophy, or
  decide these should actually be closed sets going forward and update
  this doc's own claim that they're free text.
- **`dataType`/`dataTypeLabel` (each card component's own header/list-row
  text) is still hardcoded per kind at each component's own call sites**,
  not read from `CardConfig` or `DATA_TYPE_INFO` anywhere, despite
  `TrialCardProps` technically accepting an override. `DATA_TYPE_INFO` (§1)
  is the canonical short/full pair now, but nothing enforces that a given
  component's hardcoded string actually matches its own `shortLabel` — a
  future kind's card component should just import and use it directly
  rather than re-typing it, and the existing 9 could be migrated the same
  way whenever someone's touching one anyway. Not a per-card field either
  way — kind alone determines it (§1's table).
- **No `videoUrl` field exists yet**, even though the details-drawer
  accordion already reserves a row for it (§3) — currently always the
  static placeholder clip.
- **`title`/`phase`/`description` are re-declared per card component
  instead of factored onto one shared base type** in the current code —
  not a blocker for a creation form (the effective shape is identical
  everywhere), just a note that the "shared fields" in §2 are true in
  practice, not enforced by a single shared TypeScript interface today.

## 7. Cross-kind shared vocabulary: prompt levels

Both `trial.promptLevels` and `task-analysis.promptLevels` (and
`task-analysis.stepPlan`'s per-step expected level) draw from the same
five-level least-to-most prompting hierarchy, each with its own icon:
**Verbal, Gestural, Modeling, Partial Physical, Full Physical**. Same
"known vocabulary, custom values degrade gracefully (no icon, plain text)"
pattern as phases in principle (§2) — though as §6 notes, AddCardDialog's
actual prompt-level picker hard-restricts to this exact list today rather
than treating it as suggestions.

## 8. What's searchable

The global card search (`getVisibleCards` in `src/routes/index.tsx`)
matches against: `title`, `phase`, the kind's full display name (§1's
`label` column, not the raw slug or its own `shortLabel` — so typing "task
analysis" or "percent correct" still finds a card even though its own chip
just says "Task" or "Percent"), and `description` — plus, per-kind, each
individual **Task Analysis** step string and each individual **Checklist**
item label. Nothing else (no teaching-procedure fields, no drawer stats, no
Product photo captions — there aren't any) is searched today. Worth keeping
in mind if a creation form's step-list/item-list input needs to communicate
"these are individually findable later."

## 9. Card creation — built

The creation flow this doc used to sketch as a "suggested next step" now
exists: `AddCardDialog.tsx` (Settings → BCBA Tools → "+ Add New Card"),
following exactly the shape §1-§5 already implied — pick a `kind` (fixed
afterward), fill in §2's common fields with `phase` as a suggest-from-a-
list text input, fill in that kind's own §5 fields via a generic
`SchemaField` renderer driven by a per-kind `KIND_FIELD_SCHEMAS` list, then
`buildCardConfig` assembles the final `CardConfig` object. It does not yet
collect a full `teachingProcedure` (§3) — a card made this way ships with
just `title`/`phase`/`description` and no rationale/procedure/SD/etc. until
someone adds those by hand — and §6's open questions (`behaviorRole`
wiring, `locked`'s fate) remain genuinely open, not resolved by the form
shipping.

**Adding a new `kind` end-to-end today** means touching every one of these
(TypeScript's exhaustiveness checking on the `CardKind`-keyed maps/switches
is what catches a missed spot, so there's no separate registry to consult):

1. `CardKind` union — `src/components/DataToolbarContext.tsx`
2. `CardConfig`'s new variant, `CARD_KINDS_IN_ORDER`, `SEARCH_KIND_LABELS`,
   and the `renderCard` switch (+ import) — `src/routes/index.tsx`
3. `DATA_TYPE_INFO` entry (§1) — `src/lib/dataTypeInfo.ts`
4. `KIND_META` entry — `src/components/DataToolbar.tsx`
5. An icon registered in `iconRegistry.tsx`'s "Data type icons" group
   (custom SVG via `custom()`, or a stock lucide icon via `lucide()` — see
   Timestamp's `Stamp` and Score's `Star` for that precedent)
6. `MEASUREMENT_LABELS` entry (§3's table) —
   `src/components/TeachingProcedureAccordion.tsx`
7. A `case` + small chip component in `BookmarkChip.tsx`, which needs the
   new kind's own card file to export a `useXChip`/`ListXButton` pair first
8. `KIND_ORDER`, `KIND_FIELD_SCHEMAS`, and a `buildCardConfig` case —
   `AddCardDialog.tsx`
9. The actual `<Kind>Card.tsx` component itself (standard/tile/list render
   modes, `CardEditAndDrawerProps`, `useCardState`-backed data) — everything
   above just wires it in.
