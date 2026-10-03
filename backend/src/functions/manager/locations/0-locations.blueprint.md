# Blueprint: Manager Locations

Managers define a list of named locations (e.g. "Main Office", "Downtown Site") for their org. These locations are shared across all managers in the org and are referenced by shifts-needed entries.

---

## Routes

| Method | Path                              | Auth        | Description                             |
| ------ | --------------------------------- | ----------- | --------------------------------------- |
| GET    | `/manager/locations`              | Manager JWT | List all locations for the caller's org |
| POST   | `/manager/locations`              | Manager JWT | Create a new location                   |
| DELETE | `/manager/locations/{locationId}` | Manager JWT | Delete a location owned by caller's org |

---

## DynamoDB Key Design

**Primary record:**

- `PK = ORG#<org_id>`
- `SK = LOCATION#<location_id>`

**No GSI needed** — list query uses `PK = ORG#<org_id>` + `begins_with(SK, "LOCATION#")`.

**Fields stored:**

```
location_id  string   UUID
org_id       string
name         string   max 100 chars, trimmed
address      string?  optional free text, max 200 chars
created_by   string   manager_id of creator
created_at   string   ISO timestamp
```

---

## Request / Response Shapes

### GET /manager/locations

**Response 200:**

```json
[
  {
    "location_id": "uuid",
    "org_id": "uuid",
    "name": "Main Office",
    "address": "123 Main St",
    "created_by": "uuid",
    "created_at": "2026-05-13T00:00:00.000Z"
  }
]
```

### POST /manager/locations

**Request body:**

```json
{ "name": "Main Office", "address": "123 Main St" }
```

**Validation:** `name` required, non-empty after trim, max 100 chars. `address` optional, max 200 chars.

**Response 200:** Created location object (same shape as list item).

### DELETE /manager/locations/{locationId}

**Response 200:** `""`

**Error cases:**

- 404 if location not found
- 403 if location belongs to a different org

---

## Caller Resolution

All routes use the same lookup pattern:

```
GET USER#<sub> / METADATA → { org_id, manager_id }
```

---

## File Layout

```
backend/src/functions/manager/locations/
  handler.ts    routes to getLocations / createLocation / deleteLocation
  service.ts    validation + business logic, throws ValidationError / NotFoundError / ForbiddenError
  db.ts         listLocations, createLocation, getLocation, deleteLocation
```

**Model:** `backend/src/functions/shared/models/manager/location.model.ts`

---

## SAM / env.local.json

**Function name:** `ManagerLocationsFunction`

**SAM events:** GET, POST, DELETE `/manager/locations`, DELETE `/manager/locations/{locationId}`, plus OPTIONS for each path.

**env.local.json entry:**

```json
"ManagerLocationsFunction": {
  "TABLE_NAME": "daltime-daltime-backend-dev"
}
```

(No Cognito needed — no user pool lookups.)

---

## Tests (vitest unit)

Required cases per handler test suite:

- **GET:** happy path returns array; caller lookup fails → 403
- **POST:** happy path; missing name → 400; empty name → 400
- **DELETE:** happy path; location not found → 404; location belongs to different org → 403; DynamoDB failure → 500
