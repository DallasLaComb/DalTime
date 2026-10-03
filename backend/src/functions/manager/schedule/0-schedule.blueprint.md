# Manager Schedule — Backend Blueprint

## What this feature does

The manager schedule feature lets a manager generate a draft shift schedule for a calendar month, review it, and publish it to employees. It lives in `backend/src/functions/manager/schedule/`.

---

## Endpoints

### POST /manager/schedule/generate?month=YYYY-MM

Runs the draft-generation algorithm for the calling manager's org.

**Algorithm overview:**

1. Load the shifts-needed list (what slots the manager has defined), all employees under this manager, and any existing shift records for the month.
2. Build a `filledCounts` map from existing shifts — but **exclude `draft_failed` sentinels** so those slots are retried on re-runs.
3. Sort employees by most-constrained-first (fewest available days in the month).
4. For each unfilled slot, find the first available employee who hasn't hit their `max_shifts` limit for that day.
5. If a candidate is found: write a `draft` shift record via PutItem.
6. If **no candidate is found**: write a **`draft_failed` sentinel record** via PutItem with a deterministic SK — this makes the slot visible to the manager in the UI as "Draft Failed" so they can override it manually.
7. Increment the draft generation counter in `ScheduleMeta`.

**Constraints enforced:**

- Maximum 10 draft generations per manager per month. Returns `ValidationError` if exceeded.
- Never assigns an employee to more shifts per day than their `max_shifts` availability setting allows.

**Response:** `{ created, unfilled, draftFailed, draftCount, maxDrafts }`

---

### POST /manager/schedule/publish?month=YYYY-MM

Changes all `draft` shifts for the manager/month to `published`. Only `status = 'draft'` records are picked up — `draft_failed` sentinels are intentionally excluded and are never published to employees.

**Response:** `{ published: N }`

---

### GET /manager/schedule/drafts?month=YYYY-MM

Returns all `draft` shift records (not `draft_failed`, not `published`) for the manager/month. Used by the manager UI to preview what will be published.

**Response:** `{ drafts: Shift[] }` (DynamoDB keys stripped)

---

### GET /manager/schedule/meta?month=YYYY-MM

Returns the draft generation counter for the manager/month.

**Response:** `{ draftCount: N, maxDrafts: 10 }`

---

## draft_failed sentinel records

When the algorithm cannot fill a slot, instead of silently dropping it, it writes a sentinel `Shift` record with:

- `status: 'draft_failed'`
- `employee_id: ''` and `employee_name: ''` (slot is unfilled)
- **Deterministic SK**: `SHIFT#FAILED#<manager_id>#<date>#<location_id>#<start_time>#<end_time>`

The deterministic SK makes re-runs idempotent: PutItem on the same PK+SK simply overwrites the previous sentinel rather than accumulating duplicates.

These sentinel records appear in GET /manager/shifts alongside normal draft and published records (same GSI1 query). The frontend filters on `status` to show the "Draft Failed" category.

---

## Auth

All endpoints require a valid Cognito JWT with `Manager` group membership. The caller's `org_id` and `manager_id` are resolved from the Cognito `sub` via `getMetadataRecord` — client-supplied identity fields are never trusted.

---

## Key files

| File         | Purpose                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `handler.ts` | Lambda entrypoint, routes method+path to service calls                         |
| `service.ts` | Business logic: draft generation algorithm, publish, meta                      |
| `db.ts`      | DynamoDB access: GSI1 queries, PutItem, UpdateItem for shifts and ScheduleMeta |
