# Blueprint: Manager Shifts Needed

Managers define shift coverage windows for any future month. Each entry says "on this date, at this location, I need N employees covering continuously from start_time to end_time." Individual employee assignment happens later; this feature captures the coverage requirements only.

---

## Routes

| Method | Path                                   | Auth        | Description                          |
| ------ | -------------------------------------- | ----------- | ------------------------------------ |
| GET    | `/manager/shifts-needed?month=YYYY-MM` | Manager JWT | List caller's shifts for given month |
| POST   | `/manager/shifts-needed`               | Manager JWT | Create a shift coverage entry        |
| PUT    | `/manager/shifts-needed/{shiftId}`     | Manager JWT | Update a shift                       |
| DELETE | `/manager/shifts-needed/{shiftId}`     | Manager JWT | Delete a shift                       |

`month` defaults to the next calendar month from server time if omitted. Any future month is valid; past months are read-only (GET allowed, POST/PUT/DELETE rejected with 400).

---

## DynamoDB Key Design

**Primary record:**

- `PK = ORG#<org_id>`
- `SK = SHIFT_NEEDED#<shift_id>`

**GSI for manager-scoped date queries:**

- `GSI1PK = MANAGER#<manager_id>`
- `GSI1SK = <date>` (e.g. `2026-06-15`)

List query:

```
GSI1PK = MANAGER#<manager_id>
AND begins_with(GSI1SK, '2026-06')
```

**Fields stored:**

```
shift_id        string    UUID
org_id          string
manager_id      string
date            string    YYYY-MM-DD
start_time      string    HH:MM (24-hour, e.g. "05:00")
end_time        string    HH:MM (24-hour, e.g. "22:00")
employee_count  number    integer ≥ 1
location_id     string    references a Location record
location_name   string    denormalized for display without a join
notes           string?   optional free text, max 500 chars
created_at      string    ISO timestamp
updated_at      string    ISO timestamp
```

---

## Request / Response Shapes

### GET /manager/shifts-needed?month=2026-06

**Response 200:** Array of shift objects (PK/SK/GSI keys stripped), sorted by date then start_time ascending.

### POST /manager/shifts-needed

**Request body:**

```json
{
  "date": "2026-06-15",
  "start_time": "05:00",
  "end_time": "22:00",
  "employee_count": 2,
  "location_id": "uuid",
  "notes": "Bring radio equipment"
}
```

**Validation:**

- `date`: required, valid YYYY-MM-DD, must not be in the past (today or future only)
- `start_time` / `end_time`: required, valid HH:MM, end must be after start
- `employee_count`: required, integer ≥ 1 ≤ 50
- `location_id`: required; service fetches the location to verify it belongs to caller's org and to denormalize `location_name`
- `notes`: optional, max 500 chars after trim

**Response 200:** Created shift object.

### PUT /manager/shifts-needed/{shiftId}

**Request body:** Same shape as POST body (all fields optional, at least one required).

**Validation:** Same field rules; additionally 404 if not found, 403 if shift belongs to a different manager.

**Response 200:** Updated shift object.

### DELETE /manager/shifts-needed/{shiftId}

**Response 200:** `""`

**Error cases:** 404 if not found; 403 if belongs to different manager.

---

## Caller Resolution

Same pattern as other manager features:

```
GET USER#<sub> / METADATA → { org_id, manager_id }
```

---

## File Layout

```
backend/src/functions/manager/shifts-needed/
  handler.ts    routes GET / POST / PUT / DELETE
  service.ts    validation, location verification, business logic
  db.ts         listShifts, createShift, getShift, updateShift, deleteShift
```

**Models:**

- `backend/src/functions/shared/models/manager/location.model.ts` (shared with locations feature)
- `backend/src/functions/shared/models/manager/shift-needed.model.ts`

---

## SAM / env.local.json

**Function name:** `ManagerShiftsNeededFunction`

**SAM events:**

- GET `/manager/shifts-needed`
- POST `/manager/shifts-needed`
- PUT `/manager/shifts-needed/{shiftId}`
- DELETE `/manager/shifts-needed/{shiftId}`
- OPTIONS `/manager/shifts-needed` (no auth)
- OPTIONS `/manager/shifts-needed/{shiftId}` (no auth)

**env.local.json entry:**

```json
"ManagerShiftsNeededFunction": {
  "TABLE_NAME": "daltime-daltime-backend-dev"
}
```

---

## Tests (vitest unit)

Required cases per handler:

- **GET:** happy path; invalid month param → 400; caller lookup fails → 403; DB failure → 500
- **POST:** happy path; missing field → 400; date in past → 400; end_time before start_time → 400; notes too long → 400; location not in org → 403; DB failure → 500
- **PUT:** happy path; shift not found → 404; shift belongs to other manager → 403; invalid field → 400
- **DELETE:** happy path; not found → 404; belongs to other manager → 403
