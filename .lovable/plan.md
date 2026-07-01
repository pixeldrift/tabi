# Plan Checklist

Running tracker for UI/UX polish requests. Grouped by type, tagged by
complexity (🟢 Easy · 🟡 Medium · 🔴 Complex). Check items off as they land.
"Later" items are backlog features, not tweaks — not sized yet.

---

## 🎨 Visual Styling

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
- [ ] 🟡 Schedule tab: reduce margin above date/time, shrink dropdown/input
      padding; dropdown options: square top corners, flush/no-gap attachment,
      slide-down-from-behind animation, same blue border, bold selected option
- [ ] 🟡 Global button bevel: light/dark border (top-left light source),
      drop shadow, subtle gradient overlay — audit all button variants
      (disabled/active/colored) for clashes

## 🎬 Animation

- [ ] 🟡 Fix Schedule sticky-bar animation trigger timing (fires on wrong
      event, not exactly on stick/unstick)
- [ ] 🟡 Smooth notification bar + top bar expand/collapse (no abrupt jump)
- [ ] 🟢 "Outside of hours" gray label next to parked Time chevron
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

## ⚙️ Functionality / Features

- [ ] 🟡 Co-treat toggle in appointment add/edit popup
- [ ] 🟡 Data tab: "Start session to record data" → sticky bar (reuse
      Schedule sticky bar style)
- [ ] 🟡 Schedule sticky bar toggles: Collapse/Expand View, Hide/Show Icons,
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

## 🗄️ Later (backlog — not sized)

- [ ] Revision mode for editing a paused, unsubmitted session
- [ ] Multi-instance Task Analysis entry (step-by-step + trial navigation,
      dual nav pattern)
- [ ] Expanded/twirldown view for Percent Correct + other multi-trial cards
- [ ] Mini card view + multi-column grid dashboard (widget-style)
- [ ] Custom mixed dashboard layout (standard/mini/expanded per card)
- [ ] Pinned favorites for frequently-used targets
- [ ] Edit mode: reorder cards/targets, filter by behavior/goal/data type

---

*Last updated: 2026-06-30*
