# Employee Swap Shifts — Blueprint

## What this feature does

Employees can post their own published shifts for other employees in the same org to take. A manager receives a notification whenever a shift is posted for swap or claimed by a coworker.

The feature is divided into two views for the employee:

- **Available to Take** — open swap listings posted by OTHER employees in the org. The employee can claim any of these to take the shift.
- **My Posted Shifts** — all swap listings the employee has posted themselves, in any status (open, claimed, cancelled). Used for history and for cancelling an open listing they no longer want to give away.

---

## Routes

| Method | Path                                   | Who can call it | What it does                                                                                                            |
| ------ | -------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/employee/swap-shifts`                | Employee        | Returns `{ available: [...], mine: [...] }` — open listings from other employees and all listings posted by the caller. |
| POST   | `/employee/swap-shifts`                | Employee        | Post one of the caller's own published shifts for swap. Body: `{ shift_id }`.                                           |
| POST   | `/employee/swap-shifts/{swapId}/claim` | Employee        | Claim an open listing. Transfers shift ownership to the claimer.                                                        |
| DELETE | `/employee/swap-shifts/{swapId}`       | Employee        | Cancel (unpost) a listing the caller owns.                                                                              |

---

## Validation rules enforced at the API layer

**POST /employee/swap-shifts**

- `shift_id` must be provided as a non-empty string containing only alphanumeric characters and hyphens (max 128 chars).
- The shift must exist within the caller's own org.
- The shift must belong to the calling employee (`employee_id === callerId`). 403 otherwise.
- The shift must be `published` status. A draft shift cannot be posted for swap — 400.
- The shift date must be today or in the future. Past shifts cannot be swapped — 400.
- The caller must not already have an open swap listing for the same shift. 409 if a duplicate is found.

**POST /employee/swap-shifts/{swapId}/claim**

- The swap listing must exist within the caller's org. 404 otherwise (using 404, not 403, to avoid leaking cross-org existence).
- The caller must not be the original poster — an employee cannot claim their own listing. 403.
- The listing must still be `open`. 409 if it has already been claimed or cancelled.

**DELETE /employee/swap-shifts/{swapId}**

- The swap listing must exist within the caller's org. 404 otherwise.
- The caller must be the original poster. 403 if not.
- The listing must still be `open`. 409 if already claimed or cancelled.

---

## Data model (SWAP# DynamoDB record)

| Field  | Value                          |
| ------ | ------------------------------ |
| PK     | `ORG#<orgId>`                  |
| SK     | `SWAP#<swapId>`                |
| GSI1PK | `ORG_SWAP#<orgId>`             |
| GSI1SK | `STATUS#<status>#<created_at>` |

Shift display fields (date, start_time, end_time, type, location_id, location_name) and the poster's name are denormalized onto the SWAP# record at post time so the list endpoints do not need a secondary fetch per listing.

`manager_id` is also denormalized at post time from the posting employee's primary EMPLOYEE# record. This allows the claim handler to write a manager notification without an extra DynamoDB fetch — it reads `manager_id` directly from the already-fetched SWAP# item.

---

## Record lifecycle

A SWAP# record is never deleted. Status transitions work as follows:

```
open → claimed   (via POST /claim)
open → cancelled (via DELETE)
```

When the status changes, the GSI1SK is updated from `STATUS#open#<created_at>` to `STATUS#claimed#<created_at>` or `STATUS#cancelled#<created_at>`. This removes the item from the "Available to Take" GSI query (`begins_with(GSI1SK, 'STATUS#open#')`) automatically without a delete, so the Available to Take panel stays clean.

---

## Duplicate-post guard

Before creating a new swap listing, the service queries GSI1 for any existing open listing with `shift_id = <shiftId>` AND `posted_by_employee_id = <callerId>`. If one is found, the request is rejected with a 409. This is a query-then-write guard, not atomic, but the race window is extremely narrow (two near-simultaneous POSTs for the same shift by the same employee) and the consequence is a benign second listing the employee can cancel.

---

## Manager notifications

After a successful POST (shift posted for swap):

> "[Employee Name] has put [YYYY-MM-DD] [HH:MM–HH:MM] up for swap"

After a successful POST claim:

> "[Claimer Name] has taken [Poster Name]'s shift on [YYYY-MM-DD] [HH:MM–HH:MM]"

Notification messages are constructed from JWT-derived data and fetched record data. They are NEVER constructed from raw client input.

Both notifications are written using the existing `putNotification` function from `backend/src/functions/shared/notifications/db.ts`. The notification write is wrapped in a try/catch so that a DynamoDB failure writing the notification does NOT fail the primary 200 response. Errors are logged to CloudWatch only.

---

## What is explicitly out of scope for this story

- Cascading name updates: if an employee changes their name, the `posted_by_employee_name` / `claimed_by_employee_name` on existing SWAP# records is not updated. Flagged for a future story.
- Cascading shift field updates: if a manager edits a shift's date/time/location, the denormalized fields on the corresponding open SWAP# record are not updated. Flagged for a future story.
- Auto-cancellation when a shift is moved back to draft: if a manager demotes a published shift to draft, any open SWAP# for that shift should be cancelled automatically. Flagged for the manager shift update story.
