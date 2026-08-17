# Card Type Definitions

Reverse-engineered field spec for every data-card "kind" (the WordPress
custom-post-type equivalent here), covering every field that's currently
either persisted config (`CardConfig`), computed at runtime for the data
toolbar, or surfaced in the details drawer. This is the reference to build
"Add New Card" (goal/behavior) creation against — everything below already
exists and is wired up somewhere in the app; this doc just collects it in
one place and flags the gaps a creation form will need to resolve.

Not code. No file paths beyond what's needed to trace a field back to its
source — this is a content/data-model spec, not an implementation plan.

## 1. The 7 kinds

The discriminant is called `kind`, not `type` (the app already uses `type`
for other things). One card is always exactly one kind, chosen once — there
is no evidence anywhere of a kind changing after creation, and the field
sets are different enough per kind (see §4) that switching kind on an
existing card would mean discarding most of its config. Treat kind as
fixed-at-creation, same as a WordPress post type.

| `kind` slug | Display label | Icon | One-line description shown in its own info modal |
|---|---|---|---|
| `trial` | Percent Correct | `PercentCorrectIcon` | Tracks correct vs. incorrect responses across a set of discrete trials, then reports the percentage answered correctly. Best for skills with a clear right or wrong answer. |
| `frequency` | Frequency | `FrequencyIcon` | Counts how many times a behavior occurs during an observation period. Best for behaviors with a clear, quick start and end. |
| `rate` | Rate | `RateIcon` | Counts occurrences the same way Frequency does, but divides by the length of the observation to produce a rate (count per minute), so sessions of different lengths stay comparable. |
| `duration` | Duration | `DurationIcon` | Times how long a behavior lasts, from start to finish, using a built-in stopwatch per instance. |
| `task-analysis` | Task Analysis | `TaskAnalysisIcon` | Breaks a multi-step skill into its individual steps, then tracks each step's own level of independence. |
| `rating` | Score | `Star` (filled) | Captures a subjective rating on a fixed scale for something that isn't a simple count. |
| `timestamp` | Timestamp | `TimestampIcon` | Logs the specific time a behavior occurred, without measuring duration or count — useful for spotting time-of-day patterns. |

The label/icon/description triple above lives in `DATA_TYPE_INFO`
(`src/lib/dataTypeInfo.ts`) and powers the "Data type" info modal in every
card's details drawer. A creation form's kind-picker step should reuse this
exact copy — it's already written and already the thing a tech sees when
they tap "what is this?" on an existing card.

## 2. Fields common to every kind

Pulled straight off `CardConfig`'s shared intersection
(`src/routes/index.tsx`) plus the pieces every card component independently
re-declares (`title`, `phase`, `description`) even though they aren't
factored onto a shared type today:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Stable identity for drag-reorder, favoriting, hiding, and active-card tracking. Not shown to the user; a creation form should slugify the title (or generate one) rather than ask for it. |
| `kind` | one of the 7 slugs | yes | Fixed at creation — see §1. |
| `title` | `string` | yes | The goal/behavior name. |
| `phase` | `string` | yes | Free text, not an enum — but the app ships with 5 recognized values that get an explanatory info-modal (§3); anything else just shows the plain string with no extra copy. A creation form should offer those 5 as suggestions/defaults, not hard-restrict input to them. |
| `description` | `string` | yes | Short "what to tally/score" instruction — shown as its own row in the details drawer, always visible even on a card with no full `teachingProcedure` filled in yet. |
| `behaviorRole` | `"interfering"` \| omitted | no | Marks a reduction goal (something you want to see *less* of) instead of the default acquisition goal. Drives the "target vs. interfering" toolbar filter for every kind, but **only `frequency` and `duration` cards currently read it for anything else** — see §6 gap. |
| `teachingProcedure` | `TeachingProcedure` object \| omitted | no | See §3. Optional — a card can have just a `description` and nothing else if the full procedure isn't authored yet. |

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

One object shape, reused by all 7 kinds, rendered as a twirldown accordion
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
  from the card's own `levelDescriptions` (§4.6), not authored separately.

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
| `timestamp` | Mark Correct if (overridden per-card, see §4.7) | Mark Incorrect if (ditto) |

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
| `timestamp` | any interval scored | scored count === total interval count | `scored/total` / `"Intervals Marked"` |

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

### 5.7 `timestamp`

| Field | Type | Required | Behavior |
|---|---|---|---|
| `intervalMin` | `number` | yes | Length of each scored interval, in minutes (e.g. 30, 60). |
| `intervalCount` | `number` | no | Total intervals across the whole observation window. Omit for an open-ended card that just keeps showing new intervals for as long as the session runs. |
| `defaultWindowHours` | `number` | no (defaults to 4) | Only relevant when `intervalCount` is omitted — how many hours' worth of intervals to show by default. |
| `positiveLabel` | `string` | no (defaults to "Correct") | Overrides the button + measurement-row label for the positive outcome — e.g. "Dry" instead of "Correct" for a toileting check. |
| `negativeLabel` | `string` | no (defaults to "Incorrect") | Same, for the negative outcome — e.g. "Wet/Soiled." |
| `locked` | `boolean` | no | **Same temporary test hook as Rate's** — unlocks manual elapsed-time entry. Same flag-for-removal note applies. |

Drawer quick facts: Interval (length), Scored (`n/total`).

## 6. Known gaps to resolve before building the creation form

- **`behaviorRole` is declared on every `CardConfig` variant but only
  `frequency` and `duration` actually wire it into their component** (it's
  what drives the "zero already counts as complete" rule in §4). A creation
  form offering "interfering behavior" as a toggle for, say, a Trial card
  would set a field that only affects search/filtering, not that card's own
  completion logic — worth deciding whether to (a) restrict the toggle to
  Frequency/Duration only, or (b) actually wire the other 5 kinds up to
  respect it the same way, before the form ships.
- **`locked` is a "TEMPORARY test hook"** on both Rate and Timestamp,
  by its own code comment — decide whether it graduates into a real,
  documented feature (manual time entry) or gets dropped before a creation
  form has to explain it to a user.
- **`phase` and `promptLevels`/prompt-level names are both "free string
  with a known vocabulary that gracefully degrades"**, not enums — the app
  intentionally supports a custom value (shows the plain string with no
  extra icon/copy) rather than validating against the shipped list. A
  creation form should offer the known values as quick-pick suggestions,
  not a hard-restricted dropdown, to preserve that.
- **`dataType` (the drawer's own display label, e.g. "Percent Correct")
  is currently hardcoded per kind at the render-switch call site**, not
  actually read from `CardConfig` anywhere despite `TrialCardProps`
  technically accepting an override. Not a per-card field today — kind
  alone determines it (§1's table).
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
pattern as phases. A creation form's prompt-level picker (wherever
`promptLevels` is offered) should reuse this exact list as the default/
suggested set.

## 8. What's searchable

The global card search (`getVisibleCards` in `src/routes/index.tsx`)
matches against: `title`, `phase`, the kind's display label (§1's table,
not the raw slug), and `description` — plus, for `task-analysis` only,
every individual step string. Nothing else (no teaching-procedure fields,
no drawer stats) is searched today. Worth keeping in mind if a creation
form's step-list input needs to communicate "these are individually
findable later," especially for task analyses.

## 9. Suggested next step

Given all of the above is already-working, already-tested app behavior —
the actual gap for "Add New Card" is a single creation flow that:

1. Picks a `kind` (§1) — fixed afterward.
2. Collects §2's common fields, with `phase` as a suggest-from-list-or-type
   text input (§6).
3. Collects that kind's own fields from §5 — which, conveniently, is just
   the exact prop list each component already declares; a form generated
   directly off §5's tables would need no new validation logic beyond
   what each component already assumes (e.g. `max` required, `min`
   optional and defaulting to 0).
4. Optionally collects a `teachingProcedure` (§3) — every field but
   `measurement` is a plain textarea; `measurement` itself needs zero UI
   for `rating` cards (derived from `levelDescriptions`) and a simple
   correct/error textarea pair for everyone else.
5. Resolves §6's open questions (behaviorRole wiring, `locked`'s fate)
   before deciding whether those fields even appear in the form.
