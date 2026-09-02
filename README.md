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

## Tips — discoverability call-outs

Running list of real quality-of-life touches in the app that are easy to
miss on a first look — the ones actually worth showing off, not the
self-explanatory stuff (nobody needs a tour of what the Info tab is). This
is raw material for an eventual in-app "Did you know?" tip mechanism
(reusing the guided tour's own spotlight/callout system, but single-step
and resurfaced periodically rather than a one-time walkthrough) — see the
Roadmap below. Add to this list whenever a new little touch like this ships.

**Schedule**

- **Alert Cycle** — the bell icon on any schedule item is a single tap that
  cycles Notify → Chime → No Alert, right inline. No dialog, no digging
  through settings.
- **"Now" jump button** — snaps the schedule grid straight to the current
  time instead of scrolling to find yourself.
- Collapsed / Appointments / Icons toggle controls how much detail the
  day's view shows.

**Session & header**

- **Joining is instant, never gated** — no request/approve round-trip to
  take over someone else's running session, and a live session can be
  browsed read-only without joining it at all.
- Tapping the presence icon opens a roster (or straight to a profile if
  it's just one other person).
- Tapping the relative time ("2hr ago") under the session box reveals the
  exact date/timestamp.
- Any attribution credit ("Started by X," "Paused by X") is a tappable
  pill that opens that staff member's profile.
- **Review Mode** — a deliberate, explicit unlock to edit a paused
  session's data, so nothing changes by accident. Easy to not realize it's
  even possible without finding the toggle.

**Data tab**

- Edit mode (pencil icon) unlocks drag-to-reorder plus per-card
  favorite/hide — three features behind one icon.
- Each card's small info-drawer icon holds rationale/procedure/materials/
  SD/correction — separate from the actual data-entry flow, so it's easy
  to skip past entirely.
- "Keep active card centered" (Settings) — opt-in auto-scroll so whichever
  card is active stays in view.
- Toolbar filters combine data-type + interfering/target-behavior — not
  obvious they stack.

**Notifications**

- Snooze with a configurable duration.
- Per-notification alarm sound can override the global default.

**Client Info**

- Per-field "request an edit" — doesn't edit directly, raises an approval
  request as a notification instead.

## Roadmap - Features to Add

Running tracker for UI/UX polish requests, grouped by type and tagged by
complexity (🟢 Easy · 🟡 Medium · 🔴 Complex). "Later" items are backlog
features. Completed requests are dropped from this list rather than kept
checked off. See git history for what's already shipped.

### ⚙️ Functionality / Features

- [ ] 🟡 Validate the multi-instance Task Analysis navigation paradigm
      (step-by-step + trial dual-nav) with real RBTs — it's built and
      shipped, but the interaction pattern itself hasn't been tested against
      actual use yet, and may need rework based on what that turns up
- [ ] 🟡 Schedule icon linked to a data card's own timeline — "Potty Time"
      was removed as a scheduled activity (ScheduleView.tsx's ACTIVITIES)
      on the idea that a fixed block on the schedule can't say whether a
      check actually happened or what it found the way logging it as
      interval data can. In its place: a small icon on the relevant
      schedule row/location, driven by a linked data card's real logged
      entries (e.g. an Interval-kind "Dry check" card) — showing something
      like time-since-last-check or a quick dry/wet indicator pulled from
      that card's own timeline, rather than a separate static reminder
      block. Needs a way to associate a schedule row with a specific data
      card first (nothing links the two today).
- [ ] 🟡 Advanced sync details — an expandable section in the "Session Data
      Status" popup (StatusBar.tsx's SaveIndicator) that lists exactly what
      changed since the last sync (which cards, which trials/entries) when
      status is "On Device", instead of just the summary sentence. Mainly
      useful for the rare case someone actually needs to know precisely
      what's still local before, say, closing the tab.
- [ ] 🔴 Hierarchical goal structure: Organize targets into categories and
      sub-categories (a learning tree) instead of today's flat card list —
      a data-model change, not just a UI one. What the tree view mode below
      would actually render; will likely pair with breadcrumb-style
      navigation in the Info Drawer later, showing where the active card
      sits in that hierarchy
- [ ] 🔴 Target/goal tree view — A new **view mode** alongside List/Card/
      Grid in DataToolbar's existing view-mode toggle, not a separate
      left-side drawer: same segmented control, the tree replaces the card
      list itself when selected. Shows titles (+ data type?), click
      scrolls to/activates the card. Depends on the hierarchical goal
      structure above actually existing in the data — today's flat
      target list has no real categories to draw a tree from yet.
- [ ] 🔴 Full calendar/scheduling integration, not just clinical appointments —
      Surface handoffs ("Transfer session to [person]"), make it clear who's
      recording data vs. who's submitting it, and let a tech see their
      appointment ending with another tech taking over. Needs a clear
      distinction between "appointment" and "session". **Deliberately
      decoupled from the smaller "dim/hide what isn't yours" and "client
      handoff" item below** — a real calendar is as large a lift as today's
      whole Schedule feature, and shouldn't block a much cheaper near-term
      win
- [ ] 🔴 Admin text-editing page — a helper page, linked from Settings, where
      every piece of descriptive prose in the app (anything beyond a plain
      label/title — helper text, placeholders, empty-state copy, tooltips,
      etc.) can be found and edited in one place, instead of hunting through
      individual components for a specific string
- [ ] 🟡 Notifications tab cleanup — a badge for new/unread notifications,
      the ability to clear just one type at a time instead of all-or-nothing,
      and a simplified set of notification types overall
- [ ] 🟡 Custody/handoff editing UI for "direct" appointments — the
      underlying mechanism shipped (an RBT's own 1:1 session is a
      `kind: "direct"` `Appointment`, same shape as a related-service
      pull-out; `resolveTransfer` in `ScheduleContext.tsx` auto-links a
      "direct" appointment's Arrival/Transfer/Dismissal boundaries to
      whichever appointment ends/starts at the exact same moment — a
      lunch-cover relay between two RBTs, or an untagged (not "Co-Treat")
      Speech/OT appointment the tech steps away from, falling back to
      guardian when nothing's adjacent). What's still missing is a way to
      actually use it by hand:
      today's Add/Edit Appointment dialog only ever produces
      "related-service" appointments, with no `kind` toggle to create a
      "direct" one, and no guardian/staff picker to override what
      `resolveTransfer` auto-guessed when it's wrong.
- [ ] 🟢 A small idle animation on the app's logo (an eye blink or similar) —
      a charm touch, not tied to any state change

### 🗄️ Long-term Roadmap - Potential Future Features

**Core concept to design around:** session timers are for data collection
only — they are not connected to appointments or billing. Appointments and
the employee calendar are what feed payroll and insurance submission.
Timers exist to produce rate-based data (e.g. words spoken per minute, how
long a client stays regulated without interfering behavior, frequency of
aggressive behavior) so BCBAs can track trends. The handoff, revision-mode,
and scheduling items below all need to respect that split.

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
- [ ] Real half-hour/hour reminder for an abandoned session — push
      notification if the last driver has the app open, otherwise a text
      or email — today the abandoned state only shows in-app
- [ ] **Open-sessions dashboard** — a view listing all currently
      open/running sessions across clients, so anyone can see what's
      active and jump in
- [ ] Targets that persist progress across sessions without needing to be
      graphed out first — pick up where you left off, with an icon/symbol
      denoting a persisted target
- [ ] Robust "primer timer" feature — a few visual styles (sand, hatching
      egg, wheel, wedge, Pac-Man dots, etc.), color themes, sounds, and
      finale effects, with the ability to save a combination as the default
- [ ] Custom mixed dashboard layout (standard/mini/expanded per card)
- [ ] Per-field access levels on Info tab data (Editing Allowed / Editing Not
      Allowed / Approval Required) plus a supervisor-side approve/deny action
      on the notification an edit request generates. Today, the "About Me"
      section's request-an-edit buttons only submit the request as a
      notification — there's no access-level distinction or approve/deny
      handling yet, so every submission behaves the same regardless of who's
      submitting it.
- [ ] **Admin: merge sessions** — for the rare case a session gets ended &
      submitted by accident instead of paused. Lets an admin combine two
      separately submitted sessions into one contiguous session for
      rate-data purposes (recalculating rates as if the gap between them
      never happened), rather than exposing any "un-submit"/reopen action
      on the RBT side. Deprioritized to the bottom of this list — this demo
      isn't focused on supervisor/BCBA-side functions
- [ ] **Room utilization / assignment** — a dedicated view combining a room
      list with whichever clients or activities are currently assigned to
      each one, plus a schedule alongside it navigable by time of day and
      day of week (the same kind of navigation the Schedule tab already
      has, applied per-room instead of per-client)
  - **Assignment tool**: a list of the day's appointments a user can drag
    onto either the room list directly or onto a floor plan — a linked view
    of that same list, where dropping a client on a floor-plan region
    assigns them to whatever room that region represents
  - **Floor plan editor (admin-side)**: draw shapes over an uploaded floor
    plan image to define each room's clickable region. End users only ever
    see the finished map — a shape's region is what doubles as both its
    click target and its highlighted drop zone during assignment; the
    drawing/editing tool itself is admin-only
  - Beyond hand-drawn shapes, allow uploading a layered file (Illustrator,
    SVG, or Photoshop) and mapping its existing layers directly to regions/
    click zones, instead of requiring every region to be redrawn by hand on
    top of a flattened image
  - **Room properties beyond name** — a location on the floor plan, plus a
    set of amenities/characteristics (e.g. designated safety/crisis room,
    adjustable lighting, no windows). These can then be flagged as
    requirements on a client, so available rooms can be visually filtered
    or highlighted against what a given client actually needs when
    assigning them
  - Reference: a similar layered-floor-plan assignment concept was
    prototyped for conference-room scheduling in another project — worth
    revisiting that prior art before designing this from scratch

_Roadmap last updated: 2026-09-01_
