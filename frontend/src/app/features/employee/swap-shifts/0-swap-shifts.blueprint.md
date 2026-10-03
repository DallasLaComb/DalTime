# Employee Swap Shifts — Frontend Blueprint

## What this feature is

The Swap Shifts page lets employees view open shift-swap listings from coworkers and manage their own postings. It provides two panels on a single page behind a tab switcher:

- **Available to Take** — open listings posted by OTHER employees in the same org. The employee can claim any listing with one click.
- **My Posted Shifts** — all listings the employee has posted themselves (open, claimed, or cancelled). The employee can cancel open listings and see the status history of previous ones.

The page also has a "Post a Shift" button that opens a modal picker showing the employee's own upcoming published shifts for the current month. Selecting a shift and confirming posts it for swap (calls POST /employee/swap-shifts).

---

## Route

`/employee/swap-shifts` — guarded by `authGuard` + `roleGuard` with `roles: ['Employee']`.

---

## API calls

| Action                        | Method + Path                               | Notes                                                     |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Load both panels              | `GET /employee/swap-shifts`                 | Returns `{ available, mine }` — one request for both tabs |
| Post a shift for swap         | `POST /employee/swap-shifts`                | Body: `{ shift_id }` · 409 = already posted               |
| Claim a listing               | `POST /employee/swap-shifts/{swapId}/claim` | 409 = already claimed                                     |
| Cancel a listing              | `DELETE /employee/swap-shifts/{swapId}`     | 204 No Content                                            |
| Fetch own shifts (for picker) | `GET /employee/shifts?month=YYYY-MM`        | Filtered client-side to published + future only           |

---

## Component decisions

- **Single load call** — GET /employee/swap-shifts returns `{ available, mine }`. Both panels share one loading spinner and one error alert, driven by the same `loading` and `listError` signals. After any mutating action (claim, cancel, post) the list is fully refreshed via `load()`.

- **"My Posted Shifts" filtering** — the backend returns ALL statuses (open, claimed, cancelled) in the `mine` array. All are shown in the panel so the employee has a history; status badges differentiate them visually. Only `open` listings show the Cancel button.

- **Post modal uses client-side eligibility filter** — the picker fetches the employee's shifts for the current month via GET /employee/shifts?month=YYYY-MM (reusing EmployeeShiftsService indirectly via SwapShiftsService.listMyShiftsForMonth) and then filters client-side to `status === 'published' && date >= today`. This avoids a new dedicated endpoint and matches the backend's own validation rules.

- **409 on post** — displays the specific message "Shift is already posted for swap." (inline in the modal, not the global banner) so the employee understands they don't need to post again.

- **Cancel uses ConfirmationModal** — destructive action. The actual DELETE is not sent until the employee confirms in the modal.

- **Claim is one-click** — no confirmation modal. The claim button shows a loading spinner while the request is in flight; other claim buttons are disabled to prevent double-claiming.

---

## Files

| File                                               | Purpose                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `swap-shifts.ts`                                   | Standalone OnPush component — state signals, API calls, tab switching                   |
| `swap-shifts.html`                                 | Template — two tabpanels, banners, confirmation modal, post modal                       |
| `swap-shifts.service.ts`                           | HTTP service — list(), postShift(), claimShift(), cancelShift(), listMyShiftsForMonth() |
| `frontend/src/app/core/models/swap-shift.model.ts` | TypeScript interfaces mirroring the backend PublicSwapShift shape                       |

---

## Accessibility

- Tab switcher uses `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`.
- Panels use `[hidden]` (not `*ngIf`) so they are present in the DOM for keyboard access even when not visible.
- A `role="status"` / `aria-live="polite"` region announces success/error messages to screen readers.
- Cancel modal uses `ConfirmationModalComponent` which handles focus trapping and Escape key.
- Post modal is a hand-rolled `role="dialog"` with `aria-modal="true"`, `aria-labelledby`, and keyboard close via the × button.
- Shift picker list uses `role="listbox"` / `role="option"` with `aria-selected`.
- All interactive elements have `data-testid`.
