# ABA DaBa

ABA DaBa is a prototype front-end platform for Applied Behavioral Analysis.
It is designed for data collection and session management, focused on user
experience and ease of information access while working in a busy clinical
environment. Aba DaBa includes many quality-of-life features for behavioral
technicians who need to juggle data entry while attending the needs of
challenging clients.


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

- [ ] Revision mode for editing a paused, unsubmitted session
- [ ] Multi-instance Task Analysis entry (step-by-step + trial navigation,
      dual nav pattern)
- [ ] Expanded/twirldown view for Percent Correct + other multi-trial cards
- [ ] Mini card view + multi-column grid dashboard (widget-style)
- [ ] Custom mixed dashboard layout (standard/mini/expanded per card)
- [ ] Pinned favorites for frequently-used targets
- [ ] Edit mode: reorder cards/targets, filter by behavior/goal/data type
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

*Roadmap last updated: 2026-07-12*
