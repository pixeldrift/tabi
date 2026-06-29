# Global Notification Bar — Plan

A single global bar mounted above the tabs (below the title), animating its height in/out with easing. Handles **alerts** (scheduled activity alarms) plus **info notifications** (goal/target changes, coworker messages, announcements). Each item lives in the bar briefly, then archives to the Notifications tab.

---

## 1. Notification model

Single shape covers every kind:

```ts
type NotificationKind =
  | "alert-now"        // "Time for X"
  | "alert-priming"    // "In Y min: X"
  | "goal-change"      // goal/target updated
  | "message"          // coworker message
  | "announcement";    // supervisor / org-wide

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;             // e.g. "Time for Morning Circle"
  body?: string;             // optional second line
  icon: "bell" | "bell-chime" | "bell-muted" | "target" | "message" | "megaphone";
  createdAt: number;
  // behavior
  autofadeMs?: number;       // undefined = persist until acted on
  allowSnooze?: boolean;     // alerts only
  // routing
  sourceRef?: { type: "activity" | "goal" | "thread"; id: string };
  // lifecycle
  state: "live" | "snoozed" | "silenced" | "dismissed" | "archived";
};
```

Alerts populate `allowSnooze` / `autofadeMs` from the activity's alert config (built in §5). Info notifications default to `autofadeMs = 6000`, no snooze.

## 2. State + context

New `NotificationContext` (provider in `routes/index.tsx`, above `<StatusBar>`):

- `notifications: Notification[]` — live + recently archived (last ~50).
- `push(n)`, `dismiss(id)`, `snooze(id, ms?)`, `silence(id)`.
- Auto-archives on dismiss/silence/autofade-expire/snooze-expire-then-dismiss.
- Snoozed items re-enter `live` after `snoozeMs` (default 60s, from `useUserPrefs()`).
- Schedule tick (existing `SessionContext` seconds tick) drives alert firing: when `now` crosses an activity's priming time → push `alert-priming`; at start time → push `alert-now` (respecting that activity's alert config: Notify / Notify+Chime / No Alert).

## 3. Bar UI

Mounts in `routes/index.tsx` between the page title row and `<StatusBar>`. Always rendered; height collapses to 0 when empty.

Per-row layout (left → right):

- **Icon** (left): wiggle/hop animation for `alert-now`, gentle pulse for `alert-priming`, static for info kinds. Color tinted per kind (alert=red/amber, goal=blue, message=green, announcement=violet) using semantic tokens.
- **Text**: title bold, optional body smaller/lighter. Truncates with the existing `ScrubText` interaction for long content.
- **Right cluster** (right→left), only the buttons that apply:
  - Alerts: **Silence** (bell-slash) · **Snooze** (Zzz) · **Dismiss** (×).
  - Messages / announcements: **Open** (arrow) · **Dismiss** (×).
  - Goal changes: **View** (arrow) · **Dismiss** (×).

Open/View routes to the relevant tab + scrolls to `sourceRef` (e.g. message thread, activity row).

## 4. Gestures + animation

- **Swipe left** → slide off-screen, treat as dismiss (alerts: also silence).
- **Tap row body** (not buttons) → same as the row's primary "Open" action (or dismiss if alert).
- **Enter**: slide down + fade in (200ms ease-out). **Exit**: slide up + fade out.
- **Stacking**: if multiple live, stack vertically (max 3 visible; older collapse into a "+N more" pill that expands on tap). Newest on top.
- **Autofade**: per-row progress underline ticks down; pausing on hover/touch.

## 5. Tab + badge integration

- Notifications tab badge shows count of items in `state !== "archived"` that haven't been seen on the tab yet.
- Notifications tab lists the full history grouped by day, with the same row styling (minus the autofade timer), plus filters by kind.
- Dismissing in the bar moves to archived but stays visible in the tab.

## 6. User-prefs hooks (future-ready)

`useUserPrefs()` already planned for alerts. Extend with:
- `snoozeMs` (default 60_000)
- `autofadeAlertMs` (default 5_000)
- `autofadeInfoMs` (default 6_000)
- `maxStackVisible` (default 3)
- `notificationSounds: { chime: boolean }`

All constants today, swappable later without touching call sites.

## 7. Build order (small → large)

1. `NotificationContext` + types + `useUserPrefs()` stub.
2. Bar shell (empty + single-row render) mounted in `routes/index.tsx`.
3. Alert firing wired to schedule tick; Silence/Snooze/Dismiss actions.
4. Swipe gesture + autofade progress.
5. Stacking + "+N more" overflow.
6. Info kinds (goal/message/announcement) with demo push buttons for testing.
7. Notifications tab list view + badge.

---

## Technical notes

- Bar lives outside the tab content so it's visible on every tab.
- `NotificationContext` is independent of `SessionContext` but subscribes to its seconds tick to evaluate alert firing windows; firing is idempotent per `(activityId, kind)` per day.
- Swipe via pointer events + transform; threshold ~40% width → commit, else spring back.
- Icons use existing lucide set (`Bell`, `BellRing`, `BellOff`, `Target`, `MessageSquare`, `Megaphone`).
- All colors via semantic tokens added to `styles.css` (`--notif-alert`, `--notif-info`, etc.).

Give the go-ahead and I'll start with steps 1–3 (the core alert path) in one pass, then layer the rest.
