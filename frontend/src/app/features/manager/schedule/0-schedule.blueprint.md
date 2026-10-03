# Manager Schedule Feature — Frontend Blueprint

## What this feature is

The Manager Schedule view lets managers see the full weekly schedule for their organization and overlay each employee's availability (both recurring weekly availability and date-specific overrides) so they can make informed shift assignments.

## Story #333 — Shift status filter chips

Added status filter chips to the ScheduleFiltersComponent and wired them into both manager and org-admin schedule views. The chips appear below the employee/location/type dropdowns and let managers filter the shift list to Published, Unfilled, or Draft Failed shifts.

### Status chip filter predicates

| Chip         | Filter predicate                                        |
| ------------ | ------------------------------------------------------- |
| All          | No status filter (empty Set — shows all shifts)         |
| Published    | `shift.status === 'published'`                          |
| Unfilled     | `shift.status === 'draft' AND shift.employee_id === ''` |
| Draft Failed | `shift.status === 'draft_failed'`                       |

"Unfilled" is a combined predicate (not a raw status value) because backend draft shifts can have an assigned employee; "Unfilled" specifically means an unassigned draft.

### Architecture

- `ShiftStatus` union in `shift.model.ts` extended to include `'draft_failed'`
- `ShiftStatusFilter` display type added to `schedule.utils.ts` — separate from `ShiftStatus` because "Unfilled" is not a backend status value
- `filterShifts()` in `schedule.utils.ts` extended with optional `statusChips: Set<ShiftStatusFilter>` — OR logic within the set, AND logic with other filters
- `ScheduleBaseComponent` (`schedule-base.ts`) extended with `filterStatuses` signal and `setStatusFilter()` handler
- `ScheduleFiltersComponent` extended with `activeStatusChips` input and `statusChipsChange` output (multi-select toggle chips, "All" clears selection)
- Both manager and org-admin schedule HTML templates wired to the new input/output

## Key files

| File                               | Purpose                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `schedule.ts`                      | Standalone component — schedule tab shell, signal-based state |
| `schedule.html`                    | Template for the schedule grid                                |
| `schedule.service.ts`              | Fetches and shapes the shift schedule from the backend        |
| `shifts.service.ts`                | Fetches individual shift data                                 |
| `employee-availability.service.ts` | Fetches per-employee availability bundles (see below)         |

## EmployeeAvailabilityService — concurrency design

`getAllBundles(employeeIds)` loads recurring availability and date overrides for every employee in the org. Because a typical org has 20–40 employees, a naive `forkJoin` over all employees would fire ~30–80 Lambda invocations simultaneously, exhausting the account's concurrency budget and producing 503 errors.

**Design decision:** `getAllBundles` uses `from(employeeIds).pipe(mergeMap(..., 3))` to cap the number of employees whose requests are in-flight at any moment to **3**. The inner `forkJoin` for each employee still fires both the availability request and the overrides request concurrently — only the outer fan-out is throttled. This keeps Lambda concurrency usage bounded while still parallelising work within each employee's pair of requests.

If the org grows large enough that even 3-at-a-time is too slow, the concurrency constant can be raised; if the account concurrency limit is lowered further, reduce it.

## Story #360 — Amber chip click routes to Fill Shift view

### Background — two types of unfilled chips

The schedule grid renders two visually distinct chip types for positions that still need an employee:

| Chip colour           | Source data                               | Meaning                                                                                                       |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Red (dashed border)   | `ShiftNeeded` record                      | Scheduler has not yet run for this slot — no Shift record exists yet                                          |
| Amber (dashed border) | `Shift` record where `employee_id === ''` | Scheduler ran but could not find a suitable employee, OR the shift was created manually without assigning one |

Before story #360, clicking a red chip correctly opened the Fill Shift view (`openFillShiftView(slot)`). Clicking an amber chip incorrectly opened the generic edit modal (`openEditModal(shift)`), which forced the manager to manually type an employee ID rather than showing the availability/OT-risk candidate list.

### Fix — `openShiftAction` dispatcher

A new `openShiftAction(shift: Shift)` method acts as the single dispatcher for all shift-chip clicks:

- If `shift.employee_id === ''` → calls `openFillShiftViewForExistingShift(shift)`.
- Otherwise → calls `openEditModal(shift)` (existing behaviour for assigned shifts).

All three chip `(click)` bindings in the template (month view, week view, day view) now call `openShiftAction(shift)` instead of `openEditModal(shift)`.

### `openFillShiftViewForExistingShift(shift: Shift)`

Pre-fills the fill-shift form signals from the existing Shift's fields (date, location, start/end times, type derived from the hour), sets a new `selectedEmptyShift` signal to the Shift record, saves the current view mode into `fillShiftReturnMode`, and switches `viewMode` to `'fill-shift'`.

The Fill Shift view header uses the `formDate`, `formStartTime`, `formEndTime`, and `formLocationId` signals — both the red-chip path and the amber-chip path set these same signals, so the view renders correctly for both.

### `assignFromFillView` — dual-path logic

When the manager clicks Assign on a candidate:

1. **Amber-chip path** (`selectedEmptyShift()` is non-null): calls `PATCH /manager/shifts/:id` via `shiftsService.update(id, { employee_id })`. On success, replaces the old record in `allShifts` in-place and closes the fill view. No new Shift record is created.
2. **Red-chip path** (`selectedUnfilledSlot()` is non-null, `selectedEmptyShift()` is null): creates a new Shift via `POST /manager/shifts` as before.

The `fillShiftRemaining` computed returns `1` when `selectedEmptyShift()` is set (there is exactly one slot — the existing Shift record), so the "slots remaining" badge and the Assign button disabled state work correctly for both paths.

### `closeFillShiftView`

Now also clears `selectedEmptyShift` in addition to `selectedUnfilledSlot`, so the fill view resets fully on next open regardless of which path was used.

### No backend changes

`PATCH /manager/shifts/:id` with `{ employee_id }` already resolves the employee name from Cognito and writes both `employee_id` and `employee_name`. `UpdateShiftBody = Partial<CreateShiftBody>` already includes `employee_id`. No Lambda or DynamoDB changes were needed.
