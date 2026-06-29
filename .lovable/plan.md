#  Roadmap & Implementation Plan

Organized into themed workstreams so we can tackle (and price) them in chunks. Nothing here is built yet — this is the proposal.

---

## 1. Schedule data & defaults

- Set **Phineas' Schedule** base = **Group A**.
- All group schedules: start at **8:00 AM**; replace "Arrival/Pairing" with a real activity (e.g. Morning Circle / Free Play).
- Seed sample alerts across activities (mix of autofade-on and snooze-on) for demo realism.

## 2. New Schedule creation flow

- Default title: **"New Schedule"**, text pre-selected on focus.
- Below name: **"Based on:"** dropdown of existing schedules.
- Footer: hollow **Cancel** (left) + solid **Create New Schedule** (right, with the same `+` icon as the header button).
- On create → open the new schedule **already in edit mode**.

## 3. Schedule dropdown polish

- Remove the lock icon on locked schedules. 
- instead, simply disable the edit button when one of them is selected and change the grayed out/faded icon to a pencil with a line through it.

## 4. Edit Activity popup

- **Cancel** (hollow) left, **Save** (solid) right.
- Split start/end into **two separate time inputs** — drop the dedicated "edit" button; tapping a time opens its keypad inline.

## 5. Alerts model (redesign)

Two sections inside Edit Activity:

**Default Alert** (toggle group, not buttons)

- Notify · Notify and Chime · No Alert
- Icons match the row icons (bell / bell-with-sound / muted bell).

**Priming Alert** (same three options) + **"X minutes prior"** field, default **5 min**.

Both sections share:

- **Allow Snooze** toggle (default snooze = 1 min — wired to a future user setting).
- **Autofade** toggle (default 5s visible — also future user-setting hook).

Internal: snooze duration and autofade duration read from constants today, exposed as `useUserPrefs()` later.

## 6. Global Notification Bar

New global component, mounted above the tabs, below the title; height animates with easing.

- Left: wiggling/hopping bell icon.
- Text: **"Time for X"** or **"In Y minutes: X"**.
- Right cluster (right→left): **Silence** (bell-slash), **Snooze** (Zzz), **Dismiss** (X).
- Swipe-left gesture → slide off-screen, dismiss + silence.
- Autofade → show N seconds then animate out.
- No autofade → persist until user acts.
- Stacks gracefully if multiple alerts fire near-simultaneously.

## 7. Schedule table interactions

- **Long-text scrub**: tap-and-drag text horizontally inside the cell to read truncated content; ellipsis slides out on touch and slides back after 3s idle, with text easing back to start.
- **Now button**: smooth-scroll current activity to center, then **bounce the chevron** horizontally + **pulse-flash** the current row.

## 8. Row styling — base vs custom vs current

- Base-schedule rows: faded, indented a few px on both sides (invisible padding columns keep grid alignment), with a **1px black divider** between a base row and its overriding custom row.
- **Current activity row**: rounded corners, **2px blue border**, subtle drop shadow, light-blue fill. Internal padding adjusts so total row height doesn't jump on highlight.

## 9. Edit-mode transitions

- Edit controls slide/fade in; main content eases down to make room (reverse on save/cancel).
- "Based on" becomes **static text** of the selected schedule's name while editing.
- Header buttons (Rename · Duplicate · New · Delete) all on **one row**; reduce label↔icon gap; **Delete** matches the others and shows the word "Delete" next to the trash icon.

## 10. Appointments (rework)

- Render as an **overlay layer** on top of the schedule, covering conflicting activities.
- Box style: rounded, **2px green border**, slight drop shadow.
- Content: appointment type (primary), provider name (smaller, lighter, italic), co-treat vs solo indicator.
- Top-right **eye toggle** per appointment → rolls up to a **4px horizontal line** at the start time; tap line to expand again.
- Global Appointments toggle rolls all up/down together.
- Only render for the current day.

## 11. Global UI polish

- **Buttons everywhere**: subtle drop shadow + bevel highlight (lighter top/left border, darker bottom/right) — light source top-left. Centralized via the `Button` variants and a CSS token.
- **Active-timers superscript**: when count > 1, tighten the spacing so the number hugs the stopwatch icon.
- **Pulse sync**: drive all pulsing elements (duration dots, circles, etc.) off the master seconds tick so phases align. Implement via a shared `useGlobalPulse()` hook reading from `SessionContext`.
- **Task Analysis card**: Error / Correct buttons → rounded pill shape matching the rest of the UI. Shrink the central trial bubble slightly so its hop-animation shadow isn't clipped.

---

## Suggested build order (smallest blast radius → largest)

1. **Quick wins** — §1 data, §3 dropdown icon, §11 superscript spacing, §11 task-analysis buttons + bubble size.
2. **Edit Activity & Alerts model** — §4, §5 (no notification UI yet, just data model).
3. **Global button shadow/bevel + pulse sync** — §11.
4. **New Schedule flow + edit-mode animations** — §2, §9.
5. **Row styling pass** — §7 Now-button bounce, §8 base/custom/current row treatment.
6. **Notification Bar** — §6 (depends on alerts model from step 2).
7. **Appointments overlay rework** — §10.
8. **Long-text scrub interaction** — §7.

---

## Technical notes (for the engineer hat)

- **State surface**: alerts config moves onto each activity item (`defaultAlert`, `primingAlert`, `snooze`, `autofade`) — bump the schedule type.
- **User-settings hook**: introduce `useUserPrefs()` returning `{ snoozeMs, autofadeMs }` with hard-coded defaults today; swap for real settings later without touching callers.
- **NotificationBar**: lives in `routes/index.tsx` (or a new `AppShell`) above `<StatusBar>`. Backed by a `NotificationContext` so any tab can push.
- **Pulse sync**: extend `SessionContext` with a shared `pulsePhase` derived from `Date.now() % 1000` ticked once per master interval; components consume via a hook.
- **Button shadow/bevel**: extend `buttonVariants` + add a `--btn-bevel-*` token set in `src/styles.css`.
- **Appointments overlay**: absolute-positioned layer inside the schedule scroll container, positioned by start/end time → row offsets.
- **Long-text scrub**: per-cell controlled component with pointer events + `requestAnimationFrame` for the easing-back transition.

Ready to start with **Phase 1 (Quick wins)** whenever you give the go-ahead, or we can re-order/trim any section first.