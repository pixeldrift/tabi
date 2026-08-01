# Tabi

Tabi is a prototype front-end platform for Applied Behavioral Analysis,
with a preliminary emphasis on the needs of RBTs who frequently juggle data
entry while attending to the needs of challenging clients.

It is designed for data collection and session management, focused on user
experience and ease of information access while working in a busy clinical
environment. Convenience and quality-of-life features put actions and
information directly in the context where they're needed, minimizing the
need to hunt for anything. The tools you need are always at your fingertips,
in a human-readable form that's easy to understand at a glance.

Help and explanations work the same way, with a self-documenting approach
that's available at a glance instead of requiring a trip to documentation
or a training portal.

## Tech stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (React 19, SSR)
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [Motion](https://motion.dev/) (formerly Framer Motion) for animation
- [Nitro](https://nitro.build/) for the deployable server build, see [Deployment](#deployment)

## Getting started

```bash
bun install
bun run dev       # http://localhost:3000
```

Other scripts:

```bash
bun run build    # production build
bun run preview  # preview the build with Vite's server
bun run lint
bun run format
```

## Deployment

The production build targets [Vercel](https://vercel.com/), set via Nitro's
`vercel` preset in `vite.config.ts`. To connect this repo to Vercel: Vercel
dashboard → Add New → Project → import this repo → Deploy. No build/output
settings need to be touched — Nitro's `vercel` preset writes directly to
`.vercel/output` (Vercel's Build Output API), which Vercel picks up
automatically. Every push gets a preview URL; your production branch gets
the live one.

<details>
<summary>Note on the <code>nf3</code> patch</summary>

`patches/nf3@0.3.18.patch` fixes a real bug in Nitro's current beta: the
`vercel`/`netlify` presets (and any other preset that traces dependencies
into a serverless function bundle) import `@vercel/nft` — a CommonJS
package — via a named import, which fails under Node's ESM/CJS interop
(`SyntaxError: Named export 'nodeFileTrace' not found`). Bun applies this
patch automatically on `bun install`; remove it once upstream fixes the
import.
</details>

## Sound effects

`src/lib/soundEffects.ts` defines a fixed set of UI sound-effect triggers,
already wired up at their call sites throughout the app (session
start/pause/resume/discard, scoring a trial, tallying, opening a drawer,
etc.) — see that file for the full list of call sites. Each key below is a
silent no-op until a matching `.wav` or `.mp3` is dropped into
`src/assets/audio/` (the same folder as the existing alarm sounds,
`chime01.wav` etc.) — no code changes needed, it's picked up automatically
at build time.

| Trigger (in the app)                           | File name         |
| ---------------------------------------------- | ----------------- |
| Startup / welcome (on app load)                | `startup`         |
| New Session                                    | `session-start`   |
| Resume Session (unpause, or continue previous) | `session-resume`  |
| Pause Session                                  | `session-pause`   |
| Discard Session                                | `session-discard` |
| Submit Data                                    | `submit`          |
| Tally up (Frequency / Rate increment)          | `tally-up`        |
| Tally down (Frequency / Rate decrement)        | `tally-down`      |
| Yes / Correct / Independent                    | `correct`         |
| No / Error                                     | `error`           |
| Cancel / No Response                           | `no-response`     |
| Prompted                                       | `prompted`        |
| Click / check / toggle                         | `click`           |
| Drawer slide (open)                            | `drawer-slide`    |
| Twirldown (card expands to show all trials)    | `twirldown`       |
| Question / confirm dialog                      | `question`        |
| Popup / dropdown opens                         | `popup`           |
| Warning (destructive-action confirm)           | `warning`         |
| Success / completion                           | `success`         |

Both extensions are supported per key — `tally-up.wav` and `tally-up.mp3`
both resolve the same way, so use whichever you have.

## Architecture notes & lessons learned

A few patterns that took real debugging to arrive at — worth knowing before
touching this code again, so the same bugs don't get re-introduced or
re-solved from scratch.

- **Session transition timing (`SessionContext.tsx`)** — Timing state for
  session-transition animations (collapse, pill travel, header reflow) lives
  centrally in `SessionContext`, not mirrored out to components via effects.
  Mirroring introduces a one-render lag between components, which showed up
  as a visible "hop"/"bounce" on resume/pause. Read this state directly from
  context rather than re-deriving or copying it locally.

- **Framer Motion's `layout` prop** — Never toggle `layout` between `false`
  and `"position"` to suppress an animation. Motion re-initializes its
  projection when it's re-enabled and can catch (and animate) whatever moved
  while it was off. Instead keep `layout="position"` always on and zero
  `transition.layout.duration` when suppression is needed.

- **Effects keyed on a value another mechanism can reset** — If an effect
  depends on a value that gets reset by a separate, independently-timed
  mechanism (e.g. a transition-kind flag cleared by its own dwell timer),
  capture that value once via a ref at the moment of the real trigger and
  exclude it from the effect's dependency array. Otherwise a later, unrelated
  reset can cancel work the effect already had in flight.

- **Card data persistence (`CardDataStore.tsx`)** — Data-card state (elapsed
  time, scores, etc.) lives in a shared store keyed by card ID, not local
  `useState`, because cards remount on every display-mode switch (List/Grid/
  Card view). `useResetGuard` tracks which session's reset has already been
  applied per card, so switching views doesn't accidentally wipe recorded
  data, and starting a genuinely new session still resets it.

- **Blur/reveal photo pattern (`PhotoZoom.tsx`)** — `BlurredPhotoZoomButton`
  is the shared "blurred until tapped, then auto-reblurs" interaction for any
  photo needing a privacy step (client photo, guardian photos). Reuse it
  instead of reimplementing; plain `PhotoZoomButton` is for photos that don't
  need blurring (vehicles, staff).

- **Debug leftovers in demo card data** — Watch for stray testing overrides
  on the sample card configs in `routes/index.tsx` (e.g. an unlocked
  elapsed-time editor for fast-forwarding through intervals). One such
  leftover was the root cause of a real bug: it let elapsed time be typed in
  directly, which could cross an alert's interval boundary and fire a real
  chime with no legitimate alert due.

## Roadmap

Running tracker for UI/UX polish requests, grouped by type and tagged by
complexity (🟢 Easy · 🟡 Medium · 🔴 Complex). "Later" items are backlog
features, not sized yet. Completed requests are dropped from this list
rather than kept checked off — see git history for what's already shipped.

### ⚙️ Functionality / Features

- [ ] 🔴 Left-side target/goal list/tree view mirroring Info Drawer — titles
      (+ data type?), click scrolls to card + shows pointer arrow

### 🗄️ Later (backlog — not sized)

**Core concept to design around:** session timers are for data collection
only — they are not connected to appointments or billing. Appointments and
the employee calendar are what feed payroll and insurance submission.
Timers exist to produce rate-based data (e.g. words spoken per minute, how
long a client stays regulated without interfering behavior, frequency of
aggressive behavior) so BCBAs can track trends. The handoff, revision-mode,
and scheduling items below all need to respect that split.

- [ ] Step-by-step interactive welcome tour — guided popups walking through
      the main features and interactions, standing in for separate training
      or external documentation. Appears on first use, with a Settings
      toggle to turn the tour/hints on or off afterward
- [x] **Session lifecycle & handoff model** — modeled explicitly as four
      states now, simulated client-side (single hardcoded current user, no
      real auth/backend yet) but built so real auth can be wired in later
      without changing the state model itself. On page load, the app
      randomly seeds into one of the four for demo purposes:
  1. **Idle** — no session running; shows the last submitted session's
     length, timing, and who ended/submitted it. There's deliberately no
     "resume"/"restart previous session" action, since that's just
     starting a new one — the only action here is **Start New Session**.
     (The one legitimate reason to stitch a session back onto its
     predecessor — ending & submitting by accident instead of pausing —
     is the admin-side "merge sessions" feature below, not a resume
     action here.)
  2. **Running** — shows who started it and how long it's been going. If
     it's already running when the app loads, the big timer is already
     counting. Anyone else can **join** (a join icon replaces Play) to take
     it over, or just scroll and browse the live data without touching
     anything — no request/approve round-trip, joining the session over
     the handoff, full stop. Once someone besides you is in it, a presence
     icon appears in the header (room permitting); tapping it opens their
     staff profile directly, or a pick-list if more than one other person
     is present.
  3. **Paused** — parked: timer suspended, data not yet submitted, rate
     data unaffected. From here: **Resume**, **End & Submit Data**, or
     **End & Discard Session**. Editing data while paused (fixing a
     miscount, adding something forgotten) requires deliberately unlocking
     **Review Mode** first, so nothing on a parked session changes by
     accident — it's opt-in rather than the default the moment a session
     pauses.
  4. **Abandoned** — running, but nobody's currently in it. Shown today as
     a distinct "Session Unattended" label plus an in-app notification; a
     real half-hour/hour text-or-email nudge to the last driver is
     backlogged below. Any other staff member can join and pause/end it;
     submitting the data credits whoever actually submits it, not
     necessarily who originally started the session.
  - **Handoff is a courtesy, never a lock** — joining a running session
    never requires the current driver's permission or presence, per the
    above
  - No auth/multi-user model exists yet — this prototype hardcodes a
    single current user and simulates the others; swapping in real
    auth/backend later shouldn't require changing this state model
- [ ] **Admin: merge sessions** — for the rare case a session gets ended &
      submitted by accident instead of paused. Lets an admin combine two
      separately submitted sessions into one contiguous session for
      rate-data purposes (recalculating rates as if the gap between them
      never happened), rather than exposing any "un-submit"/reopen action
      on the RBT side
- [ ] Real half-hour/hour reminder for an abandoned session — push
      notification if the last driver has the app open, otherwise a text
      or email — today the abandoned state only shows in-app
- [ ] **Open-sessions dashboard** — a view listing all currently
      open/running sessions across clients, so anyone can see what's
      active and jump in
- [ ] Full calendar/scheduling integration, not just clinical appointments —
      surface handoffs ("Transfer session to [person]"), make it clear who's
      recording data vs. who's submitting it, and let a tech see their
      appointment ending with another tech taking over. Needs a clear
      distinction between "appointment" and "session"
- [ ] Targets that persist progress across sessions without needing to be
      graphed out first — pick up where you left off, with an icon/symbol
      denoting a persisted target
- [ ] Settings: an "add a new goal" section at the top of the page — guided
      workflow to pick a data-collection type and fill in its details (TA
      steps; correct/incorrect/no-response/prompt-level options; min/max for
      others), plus free-text sections for the standard drawer content
      (rationale, procedure, etc.). Leaving a standard section blank should
      simply omit it from the resulting card's drawer, matching today's
      SD/Correction/Materials behavior — or a checkbox per section could let
      the BCBA explicitly opt sections in/out instead — plus an area to add
      one or more custom sections beyond the standard set. Ideally shows a
      live preview of the resulting card as the form is filled in, and
      supports editing in place afterward (access permitting)
- [ ] Hierarchical goal structure: organize targets into categories and
      sub-categories (a learning tree) instead of today's flat card list —
      a data-model change, not just a UI one. Will likely pair with
      breadcrumb-style navigation in the Info Drawer later, showing where
      the active card sits in that hierarchy
- [ ] Robust "primer timer" feature — a few visual styles (sand, hatching
      egg, wheel, wedge, Pac-Man dots, etc.), color themes, sounds, and
      finale effects, with the ability to save a combination as the default
- [ ] Multi-instance Task Analysis entry (step-by-step + trial navigation,
      dual nav pattern)
- [ ] Custom mixed dashboard layout (standard/mini/expanded per card)
- [ ] Per-field access levels on Info tab data (Editing Allowed / Editing Not
      Allowed / Approval Required) plus a supervisor-side approve/deny action
      on the notification an edit request generates. Today, the "About Me"
      section's request-an-edit buttons only submit the request as a
      notification — there's no access-level distinction or approve/deny
      handling yet, so every submission behaves the same regardless of who's
      submitting it.

_Roadmap last updated: 2026-08-01_
