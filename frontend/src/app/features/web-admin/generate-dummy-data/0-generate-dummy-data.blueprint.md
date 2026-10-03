# Generate Dummy Data — Frontend Blueprint

## Purpose

This feature gives the Web-Admin a UI surface to trigger dummy-data generation for a chosen calendar month. It is a developer-tooling action and is intentionally scoped to the Web-Admin role only. No other role (Org-Admin, Manager, Employee) can see or access this feature.

The primary use case is populating the DalTime system with realistic availability records and open shifts without running backend scripts manually. This speeds up testing and demo setup.

---

## Feature Location

```
frontend/src/app/features/web-admin/generate-dummy-data/
  0-generate-dummy-data.blueprint.md  — this file
  generate-dummy-data.service.ts      — HttpClient service
  generate-dummy-data.component.ts    — standalone component (smart)
  generate-dummy-data.component.html  — template
  generate-dummy-data.component.spec.ts — unit tests
```

---

## Where the Button Lives

The `GenerateDummyDataComponent` is embedded directly into the web-admin dashboard template (`web-admin-dashboard.html`) as a "Developer Tools" card below the existing navigation cards. This avoids adding a new route for a simple one-action form, keeps the dashboard the natural place a developer would look for testing utilities, and reuses the existing grid layout.

---

## Month + Year Picker Behavior

The confirmation modal contains a single combined `<select>` element that shows entries like "June 2026", "July 2026", …, "June 2028".

### Valid picker range

The picker range is **computed dynamically each time the modal opens** (inside `openModal()`) based on the current system date at that moment. It is never hardcoded and is never computed at module load time.

- **Earliest option**: the current calendar month and year at the time the modal opens (e.g., if the modal opens on June 20 2026, the earliest option is "June 2026").
- **Latest option**: exactly 24 calendar months after the current month (e.g., "June 2028" if the current month is June 2026).
- **Total options**: always exactly 25 (current month inclusive through current month + 24 inclusive).
- **No past months appear**: options before the current month are excluded entirely — not just disabled.

### Default selection

When the modal opens, the picker always defaults to the first option (the current month/year). If the user had previously selected a different month, that selection is reset on every open. This matches the backend's validation which also anchors to the server-side clock.

### Option data shape

Each option is typed as `MonthYearOption`:

```ts
interface MonthYearOption {
  year: number; // e.g. 2026
  month: number; // 1-indexed (1 = January … 12 = December)
  label: string; // e.g. "June 2026"
}
```

The select renders the array index as the `<option value>` so the component tracks the selected index rather than a year/month pair directly. The `selectedOption` computed signal derives the active `MonthYearOption` from the index.

---

## Confirmation Flow

1. The Web-Admin clicks the "Generate Dummy Data…" button (rendered via `<app-button>`).
2. `openModal()` builds the month/year options array from the current date, resets selection to index 0 (current month/year), clears any prior success/error messages, and opens the `<app-confirmation-modal>`.
3. The modal body shows the combined month+year picker and explanatory/warning text.
4. The user adjusts the picker as needed and clicks **Generate**.
5. `onConfirmed()` fires — this is the only place where the HTTP call is made. No API call happens until this point.
6. The modal remains open with the confirm button in a loading/disabled state (`[saving]="true"`) while the request is in flight.
7. On success: the modal closes, a green success banner appears with the message returned by the Lambda.
8. On error: the modal closes, a red error banner appears with the Lambda's structured error text (or a generic fallback).
9. The user can dismiss the banner by navigating away or re-triggering the flow (which clears prior messages).

---

## Error Handling

The backend can return two styles of 400 body:

| Style                      | Body shape              | Used for                                         |
| -------------------------- | ----------------------- | ------------------------------------------------ |
| New range errors           | `{ "message": string }` | Past month, or more than 24 months in the future |
| Existing validation errors | `{ "error": string }`   | Invalid month number, missing fields, etc.       |

The component's error handler checks `body.message` first, then `body.error`, and falls back to a generic string if both are absent. This ensures both old and new 400 shapes are surfaced correctly.

---

## Loading and Toast Behavior

There is no external toast/notification service in this codebase. Success and error feedback is shown as inline alert banners (matching the established codebase pattern):

- **Success**: green banner with a checkmark icon, `role="alert"` + `aria-live="polite"`, `data-testid="generate-dummy-data-success"`.
- **Error**: red banner with an X icon, `role="alert"` + `aria-live="assertive"`, `data-testid="generate-dummy-data-error"`.

Both banners are cleared when `openModal()` is called, so stale feedback doesn't persist when the user opens the modal a second time.

---

## Role Scoping

The route `/web-admin` is already guarded by `authGuard` + `roleGuard` with `data: { roles: ['WebAdmin'] }` in `app.routes.ts`. Because `GenerateDummyDataComponent` is embedded inside the dashboard (not on its own route), it inherits the dashboard's route guard. No additional guard is needed on the component itself.

---

## API Contract

```
POST /web-admin/generate-dummy-data
Authorization: Bearer <web-admin-cognito-jwt>   (attached by AuthInterceptor)
Content-Type: application/json

Body:   { "year": number, "month": number }
200:    { "message": string }
400:    { "message": string }  — dynamic range error (past or > 24 months out)
400:    { "error": string }    — validation error (invalid month/year values)
403:    { "error": string }
500:    { "error": string }
```

The month is 1-indexed (January = 1, December = 12). The valid range is [current month/year, current month/year + 24 months] as determined by the server-side clock.

---

## Conventions

- Standalone component with `ChangeDetectionStrategy.OnPush`.
- All state managed with Angular signals — no `BehaviorSubject`.
- `<app-button>` and `<app-confirmation-modal>` imported from `@common-daltime`.
- Tailwind utility classes only — no CSS files, no inline styles.
- `data-testid` attributes on all interactive elements and feedback regions.
- No `any` — strict TypeScript throughout.

---

## Future Enhancements

- EventBridge scheduled rule to auto-generate data on the 1st of each month (noted as `// TODO` in the backend Lambda handler).
