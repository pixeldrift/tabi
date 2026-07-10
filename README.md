# ABA DaBa

A prototype platform for Applied Behavioral Analysis data colletion and
session management. Focused on user experience and ease of information
access and recording while working in a busy clinical environment.
Many quality of life features for behavioral techs juggling client needs.


## Tech stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (React 19, SSR)
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [Motion](https://motion.dev/) (formerly Framer Motion) for animation
- [Nitro](https://nitro.build/) for the deployable server build — swappable across hosts, see [Deployment](#deployment)

## Getting started

```bash
bun install
bun run dev       # http://localhost:3000
```

Other scripts:

```bash
bun run build       # production build (output path depends on the deploy preset, see below)
bun run preview     # preview the build with Vite's server
bun run preview:cf  # preview a Cloudflare build in a real Workers runtime
bun run lint
bun run format
```

## Deployment

The production build targets [Vercel](https://vercel.com/) by default. Deploy
target is a one-line swap — no code changes needed:

```bash
NITRO_PRESET=cloudflare-module bun run build   # or netlify, node-server, etc.
```

To connect this repo to Vercel: Vercel dashboard → Add New → Project →
import this repo → Deploy. No build/output settings need to be touched —
Nitro's `vercel` preset writes directly to `.vercel/output` (Vercel's Build
Output API), which Vercel picks up automatically.

<details>
<summary>Cloudflare instead</summary>

Set `NITRO_PRESET=cloudflare-module` (see above), then:

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Build command: `bun install && bun run build`
3. Build output directory: `dist`

Note: Cloudflare's "Workers & Pages → Pages → Connect to Git" flow now
provisions projects on Cloudflare's unified Workers platform, whose deploy
step always runs `wrangler deploy` (a plain-Worker deploy) rather than
`wrangler pages deploy`. Because of that, this repo targets Nitro's
`cloudflare-module` preset (Worker + static-assets binding) instead of the
legacy `cloudflare-pages` preset — using `cloudflare-pages` here fails with
`Missing entry-point to Worker script or to assets directory` on that flow.
</details>

<details>
<summary>Note on the <code>nf3</code> patch</summary>

`patches/nf3@0.3.18.patch` fixes a real bug in Nitro's current beta: the
`vercel`/`netlify` presets (and any other preset that traces dependencies
into a serverless function bundle) import `@vercel/nft` — a CommonJS
package — via a named import, which fails under Node's ESM/CJS interop
(`SyntaxError: Named export 'nodeFileTrace' not found`). The
Cloudflare-Workers presets don't hit this since Workers bundle everything
into one file and skip the tracing step entirely. Bun applies this patch
automatically on `bun install`; remove it once upstream fixes the import.
</details>

Every push gets a preview URL; your production branch gets the live one.
Preview the exact Cloudflare build locally with `bun run preview:cf`.

## Roadmap

Running tracker for UI/UX polish requests, grouped by type and tagged by
complexity (🟢 Easy · 🟡 Medium · 🔴 Complex). "Later" items are backlog
features, not sized yet.

### 🎨 Visual Styling

- [x] 🟢 Number pad SVG icon for editable number fields
- [x] 🟢 Data-type SVG icons (percent, tally/frequency, duration/timer, rate,
      score/rank, task analysis) + rename "% Correct" → "Percent Correct" +
      title-case all data type text
- [x] 🟢 Previous instance bubbles → light blue for duration/frequency
      (match % correct treatment)
- [x] 🟢 Reduce spacing between data collection cards
- [x] 🟢 Schedule header row: round bottom corners, align "Activity"/"Location"
      headers to their text columns (not emoji column)
- [x] 🟢 Schedule sticky bar: full width, mini clock uses lowercase `a`/`p`
      (no space, matches activity times), tighten icon left margin
- [x] 🟢 Remove blue hover circle on Schedule pencil (edit) button
- [x] 🟡 Schedule tab: reduce margin above date/time, shrink dropdown/input
      padding; dropdown options: square top corners, flush/no-gap attachment,
      slide-down-from-behind animation, same blue border, bold selected option
- [x] 🟡 Global button bevel: light/dark border (top-left light source),
      drop shadow, subtle gradient overlay — audit all button variants
      (disabled/active/colored) for clashes

### 🎬 Animation

- [x] 🟡 Fix Schedule sticky-bar animation trigger timing (fires on wrong
      event, not exactly on stick/unstick)
- [x] 🟡 Smooth notification bar + top bar expand/collapse (no abrupt jump)
- [x] 🟢 "Outside of hours" gray label next to parked Time chevron
- [ ] 🔴 Session-start animation (odometer digit roll, blue flash, button
      fade/slide, timer pill shrink+reposition, header collapse) — single
      fluid tween, reversible for pause
- [ ] 🔴 "Data Submitted" animation — cards stagger-exit right, blank cards
      slide in from left as one sheet; reverse on restarting a session
- [ ] 🔴 Appointment collapse/expand: "roll up/down" height + fade animation;
      click top border to collapse too
- [ ] 🔴 Schedule pencil edit-mode animation (icon slides after name, check/X
      fade in, dropdown border fades without text jump, action-button
      container expands) — reversible
- [ ] 🔴 Collapsed/proportional mode transitions for Schedule appointments
      (fade + slide right, kept snappy)
- [ ] 🔴 Alert bar swipe gestures (dismiss left / snooze right, icon
      highlighting incl. conditional silence icon, chime keeps playing until
      silenced/dismissed, circular buttons, conditional silence button)

### ⚙️ Functionality / Features

- [x] 🟡 Co-treat toggle in appointment add/edit popup
- [x] 🟡 Data tab: "Start session to record data" → sticky bar (reuse
      Schedule sticky bar style)
- [x] 🟡 Schedule sticky bar toggles: Collapse/Expand View, Hide/Show Icons,
      Hide/Show Appointments
- [ ] 🔴 Settings tab (gear icon) + audit codebase to link existing static
      constants as options
- [ ] 🔴 Rate cards linked to session timer (swap lock→link icon is trivial;
      actual timer-sync is the real work) — shift link icon a few px left
      in the pill
- [ ] 🔴 Master clock: sync all timer ticks + Duration pulse-bubble animation
      across the whole app to the session timer (single source of truth)
- [ ] 🔴 Info Drawer redesign: non-modal, opens from right, full tab-pane
      height, shrinks cards to mini view when room allows, pointer arrow
      (like number-entry popups) overlapping the target card, drop shadow
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

*Roadmap last updated: 2026-07-10*
