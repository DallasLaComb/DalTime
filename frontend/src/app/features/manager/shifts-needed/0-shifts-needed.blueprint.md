# Blueprint: Shifts Needed Page

Managers plan shift coverage requirements for any future month. The page defaults to next calendar month on load; managers can navigate forward/back to any month (floor at current month). Managers can add, edit, and delete coverage windows, and manage their org's location list from the same page.

---

## Route

`/manager/shifts-needed` — guarded by `authGuard` + `roleGuard` with `roles: ['Manager']`.

---

## API Dependencies

| Method | Endpoint                               | Purpose                    |
| ------ | -------------------------------------- | -------------------------- |
| GET    | `/manager/locations`                   | Populate location picker   |
| POST   | `/manager/locations`                   | Create a location          |
| DELETE | `/manager/locations/{id}`              | Delete a location          |
| GET    | `/manager/shifts-needed?month=YYYY-MM` | Load shifts for next month |
| POST   | `/manager/shifts-needed`               | Create shift               |
| PUT    | `/manager/shifts-needed/{id}`          | Update shift               |
| DELETE | `/manager/shifts-needed/{id}`          | Delete shift               |

---

## Models

**`core/models/manager-location.model.ts`**

```ts
export interface ManagerLocation {
  location_id: string;
  org_id: string;
  name: string;
  address?: string;
  created_by: string;
  created_at: string;
}

export interface CreateLocationBody {
  name: string;
  address?: string;
}
```

**`core/models/manager-shift-needed.model.ts`**

```ts
export interface ShiftNeeded {
  shift_id: string;
  org_id: string;
  manager_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  employee_count: number;
  location_id: string;
  location_name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftBody {
  date: string;
  start_time: string;
  end_time: string;
  employee_count: number;
  location_id: string;
  notes?: string;
}

export type UpdateShiftBody = Partial<CreateShiftBody>;
```

---

## Services

**`features/manager/shifts-needed/shifts-needed.service.ts`**

- `list(month: string): Observable<ShiftNeeded[]>`
- `create(body: CreateShiftBody): Observable<ShiftNeeded>`
- `update(id: string, body: UpdateShiftBody): Observable<ShiftNeeded>`
- `remove(id: string): Observable<void>`

**`features/manager/shifts-needed/locations.service.ts`**

- `list(): Observable<ManagerLocation[]>`
- `create(body: CreateLocationBody): Observable<ManagerLocation>`
- `remove(id: string): Observable<void>`

---

## Component: `ManagerShiftsNeededComponent`

**File:** `features/manager/shifts-needed/shifts-needed.ts`
**Template:** `features/manager/shifts-needed/shifts-needed.html`

### Signals

```ts
readonly targetMonth = signal<string>('2026-06')   // computed from today on init; navigable forward/back, floor at current month
readonly shifts = signal<ShiftNeeded[]>([])
readonly locations = signal<ManagerLocation[]>([])
readonly loading = signal(true)
readonly error = signal<string | null>(null)

// Add/edit form
readonly formOpen = signal(false)
readonly editingShift = signal<ShiftNeeded | null>(null)  // null = add mode
readonly formDate = signal('')
readonly formStartTime = signal('')
readonly formEndTime = signal('')
readonly formEmployeeCount = signal(1)
readonly formLocationId = signal('')
readonly formNotes = signal('')
readonly formSubmitted = signal(false)
readonly formSaving = signal(false)
readonly formError = signal<string | null>(null)

// Delete
readonly deletingShiftId = signal<string | null>(null)

// Locations modal
readonly locationsModalOpen = signal(false)
readonly newLocationName = signal('')
readonly newLocationAddress = signal('')
readonly locationSaving = signal(false)
readonly locationError = signal<string | null>(null)
readonly deletingLocationId = signal<string | null>(null)

// Computed
readonly shiftsByDate = computed(() => groupByDate(this.shifts()))
readonly monthLabel = computed(() => formatMonthLabel(this.targetMonth()))  // "June 2026"
```

### Key behaviors

- On init: compute next calendar month, load locations and shifts in parallel
- **Month navigation:** `[<]` and `[>]` buttons change `targetMonth` and reload shifts; `[<]` is disabled when already at the current calendar month
- **Add form:** clicking "Add Shift" opens an inline form below the list header; submitting calls POST then appends to local state and closes form
- **Edit:** clicking Edit on a row populates the same form in edit mode; submitting calls PUT then updates local state
- **Delete:** clicking Delete calls DELETE immediately (no modal), removes from local state; show a brief inline error if it fails
- **Locations modal:** "Manage Locations" button opens a modal listing existing locations with delete buttons and a small add form at the bottom

---

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│  [<] June 2026 [>]               [Manage Locations] │
│                                        [+ Add Shift] │
├─────────────────────────────────────────────────────┤
│ [add/edit form — shown inline when open]             │
├─────────────────────────────────────────────────────┤
│ Mon, Jun 2                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │ 05:00 – 22:00 · 2 employees · Main Office    │   │
│  │ "Bring radio equipment"                       │   │
│  │                              [Edit] [Delete]  │   │
│  └──────────────────────────────────────────────┘   │
│ Tue, Jun 3                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │ 08:00 – 16:00 · 1 employee  · Downtown Site  │   │
│  │                              [Edit] [Delete]  │   │
│  └──────────────────────────────────────────────┘   │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

- No shifts state: `<app-empty-state>` with title "No shifts planned" and description "Add a shift to get started."
- Loading state: spinner centered
- Error state: `<app-error-alert>` with retry button

---

## Shift Add/Edit Form (inline)

Fields:

| Field          | Input                                    | Validation                            |
| -------------- | ---------------------------------------- | ------------------------------------- |
| Date           | `<input type="date">`                    | Required; must be within target month |
| Start Time     | `<input type="time">`                    | Required                              |
| End Time       | `<input type="time">`                    | Required; must be after start         |
| # of Employees | `<input type="number" min="1" max="50">` | Required, integer ≥ 1                 |
| Location       | `<select>` populated from `locations()`  | Required                              |
| Notes          | `<textarea rows="2">`                    | Optional, max 500 chars               |

Actions: Cancel (secondary, sm) · Save (primary, sm, `[loading]="formSaving()"`)

---

## Locations Modal

- Lists existing locations: name, optional address, delete button (danger-outline, sm)
- "Add Location" section at bottom: Name input (required) + Address input (optional) + Add button
- Deleting a location that is referenced by a shift: backend returns 400; show inline error
- Close button (secondary) at top right; also closable via Escape key

---

## Files

```
frontend/src/app/features/manager/shifts-needed/
  0-shifts-needed.blueprint.md
  shifts-needed.ts
  shifts-needed.html
  shifts-needed.service.ts
  locations.service.ts

frontend/src/app/core/models/
  manager-location.model.ts
  manager-shift-needed.model.ts
```

Route registration in `app.routes.ts`:

```ts
{
  path: 'manager/shifts-needed',
  canMatch: [authGuard, roleGuard],
  data: { roles: ['Manager'] as const },
  loadComponent: () =>
    import('./features/manager/shifts-needed/shifts-needed').then((m) => m.ManagerShiftsNeededComponent),
},
```

---

## Constraints

- No NgModules, no BehaviorSubject — signals only
- `ChangeDetectionStrategy.OnPush`
- All buttons via `<app-button>`; all interactive elements have `data-testid`
- Tailwind only — no inline styles, no component CSS
- `trackBy` on all `@for` loops
- Empty-state, loading, and error handled with shared components (`app-empty-state`, `app-loading-spinner`, `app-error-alert`)
