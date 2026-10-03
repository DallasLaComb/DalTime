# Employee Schedule — Blueprint

## Purpose

The Employee Schedule view is the primary view for the Employee role. It displays the employee's
assigned shifts across three calendar views (day, week, month), lets them navigate through time,
and surfaces shifts from coworkers that are available for pickup.

## Default landing page

`/employee/schedule` is the default landing page for the Employee role. Navigating to the bare
`/employee` path redirects automatically to `/employee/schedule` via a `redirectTo` entry in
`app.routes.ts`. This redirect also applies when a Web-Admin impersonates an Employee — the
impersonation path eventually resolves to `/employee/schedule`, giving the Web-Admin an identical
view to what a real Employee would see.

The navbar's "Schedule" link routes directly to `/employee/schedule`.

## View modes

The component exposes three distinct calendar views, selectable via a toggle bar at the top of
the page. The default view on load is **Day**, anchored to today's date.

### Day view

Loads the employee's own shifts for the selected date by calling
`GET /employee/shifts?date=YYYY-MM-DD`. Shows one shift card per shift. If no shifts exist,
shows `<app-empty-state>` with a description that includes the formatted date.

Additionally, in day view the component calls `GET /employee/available-shifts?date=YYYY-MM-DD`
in parallel. If the response contains one or more shifts, an "Available from coworkers" section
appears below the own-shifts section (or below the empty state). Each available shift is rendered
with a dashed border (`border-dashed border-2 border-secondary`) to distinguish it from own
shifts. Each available shift card includes a disabled "Claim shift" button (no action wired —
placeholder for a future story). If no available shifts are returned, the section is hidden
entirely with no fallback empty state.

### Week view

Loads the employee's shifts for a 7-day window starting on the Sunday of the current week by
calling `GET /employee/shifts?week=YYYY-MM-DD`. Renders a 7-column grid (one column per day,
Sun–Sat). Column headers always render so the user can orient by day label. If no shifts exist
for the week, `<app-empty-state>` appears below the column headers. Today's column is
highlighted with a subtle background (`bg-tertiary/20` header, `bg-tertiary/10` cell) and
carries `aria-current="date"`. On mobile the grid scrolls horizontally (`overflow-x-auto`)
rather than collapsing columns.

### Month view

Loads all the employee's shifts for the current calendar month by calling
`GET /employee/shifts?month=YYYY-MM`. Renders shifts grouped by date in a flat list. Each
date group has a label and contains one or more shift cards in a card stack. A "Today" badge
highlights today's group. If no shifts exist for the month, shows `<app-empty-state>`. The
total shift count for the month is shown below the list.

## Date navigation

A prev/next pair of `<app-button>` elements sits above the view content. The step size
depends on the active view:

- Day view: ±1 day
- Week view: ±7 days
- Month view: ±1 calendar month

A "Today" button appears when the current period does not include today. Clicking it resets
the anchor to today. All navigation is driven by a single `currentDate` signal; the `effect()`
in the constructor re-fetches whenever either `currentDate` or `viewMode` changes.

Switching view modes resets `currentDate` to today so the user always lands on the current
period when toggling views.

## State model

| Signal                   | Type                       | Description                                        |
| ------------------------ | -------------------------- | -------------------------------------------------- |
| `viewMode`               | `signal<ViewMode>('day')`  | Active view                                        |
| `currentDate`            | `signal<Date>(new Date())` | Navigation anchor                                  |
| `shifts`                 | `signal<Shift[]>([])`      | Own shifts for the current period                  |
| `loading`                | `signal(boolean)`          | Own-shifts request in flight                       |
| `error`                  | `signal<string \| null>`   | Own-shifts error message                           |
| `availableShifts`        | `signal<Shift[]>([])`      | Available-for-pickup shifts (day view only)        |
| `availableShiftsLoading` | `signal(boolean)`          | Available-shifts request in flight                 |
| `availableShiftsError`   | `signal<string \| null>`   | Suppressed internally — section is hidden on error |

Derived values (`viewLabel`, `dayLabel`, `showTodayButton`, `grouped`, `weekColumns`,
`weekIsEmpty`) are all `computed()` signals.

## Accessibility

- View toggle buttons carry `aria-pressed` to communicate the active state to screen readers.
- The toggle bar is wrapped in `role="group" aria-label="Schedule view"`.
- The header label span uses `aria-live="polite"` so navigation changes are announced.
- Today's column header in week view carries `aria-current="date"`.
- All interactive elements have `data-testid` attributes for testing.

## Responsive behavior

- Mobile: week view uses `overflow-x-auto` so all 7 columns scroll horizontally rather than
  wrapping. Day and month views are single-column and naturally fit narrow viewports.
- Tablet/desktop: views render at full width up to the `1200px` content max.

## API contract

| Endpoint                                         | Used by                                    |
| ------------------------------------------------ | ------------------------------------------ |
| `GET /employee/shifts?date=YYYY-MM-DD`           | Day view own shifts                        |
| `GET /employee/shifts?week=YYYY-MM-DD`           | Week view own shifts (week-start = Sunday) |
| `GET /employee/shifts?month=YYYY-MM`             | Month view own shifts                      |
| `GET /employee/available-shifts?date=YYYY-MM-DD` | Day view available-from-coworkers section  |

## File inventory

| File                      | Role                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `schedule.ts`             | Smart component — manages state signals, fetches data, handles navigation                 |
| `schedule.html`           | Template — Tailwind-only, no inline styles, three conditional view sections               |
| `shifts.service.ts`       | Data service — wraps HttpClient calls to both shifts endpoints                            |
| `schedule.spec.ts`        | Unit tests — 30 tests covering view switching, navigation, empty states, available shifts |
| `0-schedule.blueprint.md` | This file                                                                                 |
