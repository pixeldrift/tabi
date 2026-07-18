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

| Trigger (in the app)                           | File name          |
| ------------------------------------------------ | ------------------- |
| Startup / welcome (on app load)                  | `startup`           |
| New Session                                      | `session-start`     |
| Resume Session (unpause, or continue previous)   | `session-resume`    |
| Pause Session                                    | `session-pause`     |
| Discard Session                                  | `session-discard`   |
| Submit Data                                      | `submit`            |
| Tally up (Frequency / Rate increment)            | `tally-up`          |
| Tally down (Frequency / Rate decrement)          | `tally-down`        |
| Yes / Correct / Independent                      | `correct`           |
| No / Error                                       | `error`             |
| Cancel / No Response                             | `no-response`       |
| Prompted                                         | `prompted`          |
| Click / check / toggle                           | `click`             |
| Drawer slide (open)                              | `drawer-slide`      |
| Twirldown (card expands to show all trials)      | `twirldown`         |
| Question / confirm dialog                        | `question`          |
| Popup / dropdown opens                           | `popup`             |
| Warning (destructive-action confirm)             | `warning`           |
| Success / completion                             | `success`           |

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
- [ ] Session handoff / shift boundaries: clarify what "ending a shift"
      means vs. the client's own schedule, and when to pause/park a session
      vs. end it outright. User-centric visibility into who's currently in
      a session, who last ran it, and who else is accessing it concurrently
- [ ] Full calendar/scheduling integration, not just clinical appointments —
      surface handoffs ("Transfer session to [person]"), make it clear who's
      recording data vs. who's submitting it, and let a tech see their
      appointment ending with another tech taking over. Needs a clear
      distinction between "appointment" and "session"
- [ ] Targets that persist progress across sessions without needing to be
      graphed out first — pick up where you left off, with an icon/symbol
      denoting a persisted target
- [ ] Notifications when a goal changes phase, a learner graduates from a
      goal, or a supervisor updates a program — so technicians aren't
      surprised to find cards missing or new ones appearing without warning
- [ ] Pre-submission data review: a summary screen before submitting a
      session, warning about incomplete trials or unmet minimums, with end
      totals shown in a human-readable way
- [ ] Settings: an "add a new goal" section at the top of the page — guided
      workflow to pick a data-collection type and fill in its details (TA
      steps; correct/incorrect/no-response/prompt-level options; min/max for
      others), plus free-text sections for the standard drawer content
      (rationale, procedure, etc.) with the ability to hide/delete standard
      sections and add custom ones. Ideally shows a live preview of the
      resulting card as the form is filled in, and supports editing in place
      afterward (access permitting)
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
- [ ] Auto-expire/fade preference for the Notifications tab's persistent list
      (e.g. auto-clear after an hour, a day, etc.). Today notifications
      persist there indefinitely until manually cleared — no such
      preference exists yet, this is just noting the idea for later.

*Roadmap last updated: 2026-07-17*
