# ABA DaBa

ABA DaBa is a prototype front-end platform for Applied Behavioral Analysis.
It is designed for data collection and session management, focused on user
experience and ease of information access while working in a busy clinical
environment. Convenience and quality-of-life features put actions and
information directly in the context where they're needed, minimizing the
need to hunt for anything — what you need is always at your fingertips, in
a human-readable form that's easy to understand at a glance without having
to stop and think about it, and help and explanations work the same way,
available at a glance instead of requiring a trip to documentation or a
training portal. ABA DaBa is built for behavioral technicians who need to
juggle data entry while attending to the needs of challenging clients.

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

## Roadmap

Running tracker for UI/UX polish requests, grouped by type and tagged by
complexity (🟢 Easy · 🟡 Medium · 🔴 Complex). "Later" items are backlog
features, not sized yet. Completed requests are dropped from this list
rather than kept checked off — see git history for what's already shipped.

### 🐛 Bugs

- [ ] Stray chime (sometimes more than one) plays when resuming or starting
      a session — likely an audio-playback or notification-system timing
      issue, root cause not yet confirmed

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
- [ ] Data Revision mode: edit/update session data while the session timer
      isn't running (paused, not yet submitted) — e.g. adding tallies
      without skewing rate data by leaving the timer running
- [ ] **Session lifecycle & handoff model** — RBT priority: this is the core
      mobile, in-session workflow (vs. curriculum/admin tooling, which is
      laptop-side and less time-pressured), so it should be sequenced ahead
      of BCBA-facing features like goal creation
  - Pause vs. Stop/Submit are different things and the UI should say so:
    **Pause** stops the timer but leaves the session live and claimed —
    data stays editable, nothing is finalized, anyone authorized can resume
    it. **Stop/Submit** is the only terminal action; it locks the data and
    requires an explicit "submitted by" attribution (a compliance record,
    not just a UI state)
  - **Presence model**: a session has one "driver" at a time (whoever's
    actively timing/scoring). Any other authorized RBT can join as an
    **observer** — read-only, sees live data as it's entered — without
    taking over
  - **Explicit handoff**: no silent takeover. A second RBT requests to
    become driver, the current driver (if reachable) accepts, and the
    switch is logged (who handed off to whom, when)
  - **Orphaned sessions**: define what happens when the driver's device
    disconnects mid-session — sit locked until they reconnect, or let
    another RBT force-claim it after a visibility window? Implicit
    takeover is simpler but risks two people scoring concurrently;
    requiring explicit handoff is safer but adds friction exactly when a
    tech is already juggling a client. Needs a real answer, not a default
  - **Visibility**: surface who's currently driving, who's observing, and
    who last handed the session off — a running custody record, not just
    input for handoff decisions
  - Clarify what "ending a shift" means vs. the client's own schedule, and
    when to pause/park a session vs. end it outright
  - No auth/multi-user model exists in the app today — this needs one
    built underneath it, not bolted on after
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

_Roadmap last updated: 2026-07-28_
