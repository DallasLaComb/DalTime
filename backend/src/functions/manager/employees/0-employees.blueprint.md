# Blueprint: Manager Employees

Managers own a set of employees within their org. This function handles all employee lifecycle operations a manager can perform, plus read-only access to each employee's recurring availability and date-specific availability overrides.

---

## Routes

| Method | Path                                                     | Auth        | Description                                             |
| ------ | -------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| GET    | `/manager/employees`                                     | Manager JWT | List all employees belonging to the calling manager     |
| POST   | `/manager/employees`                                     | Manager JWT | Create a new employee (invites via Cognito)             |
| PUT    | `/manager/employees/{employeeId}`                        | Manager JWT | Update an employee's name or phone                      |
| DELETE | `/manager/employees/{employeeId}`                        | Manager JWT | Disable an employee (soft-delete via Cognito)           |
| PATCH  | `/manager/employees/{employeeId}`                        | Manager JWT | Re-enable a previously disabled employee                |
| GET    | `/manager/employees/{employeeId}/availability`           | Manager JWT | Read an employee's recurring weekly availability        |
| GET    | `/manager/employees/{employeeId}/availability/overrides` | Manager JWT | Read an employee's date-specific availability overrides |

All mutating routes (POST, PUT, DELETE, PATCH) verify that the target employee belongs to the calling manager's org before acting. A 403 is returned if the employee is owned by a different manager.

---

## Caller Resolution

Every route resolves the caller's identity with a single lookup before acting:

```
GET USER#<sub> / METADATA → { org_id, manager_id }
```

If that lookup returns nothing, a 403 is returned immediately — the caller is unrecognised.

---

## DynamoDB Key Design

**Employee record:**

- `PK = ORG#<org_id>`
- `SK = EMP#<employee_id>`

**Availability record (recurring weekly schedule):**

- `PK = EMP#<employee_id>`
- `SK = AVAILABILITY`

**Availability overrides record (date-specific exceptions):**

- `PK = EMP#<employee_id>`
- `SK = AVAILABILITY_OVERRIDES`

---

## Request / Response Shapes

### GET /manager/employees

**Response 200:** Array of employee objects enriched with Cognito account status.

```json
[
  {
    "employee_id": "uuid",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@acme.com",
    "phone": "555-5678",
    "org_id": "uuid",
    "manager_id": "uuid",
    "status": "CONFIRMED",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
]
```

### POST /manager/employees

**Request body:**

```json
{
  "email": "jane@acme.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "555-5678",
  "temp_password": "Temp@1234"
}
```

**Validation:** `email`, `first_name`, `last_name`, and `temp_password` are required. `phone` is optional.

**Response 201:** Created employee object.

**Error cases:**

- 400 if required fields are missing or invalid
- 409 if a Cognito user with that email already exists

### PUT /manager/employees/{employeeId}

**Request body:** At least one of `first_name`, `last_name`, or `phone`.

**Response 200:** Updated employee object.

**Error cases:**

- 400 if no updateable field is provided or a provided field is empty after trim
- 403 if the employee belongs to a different manager
- 404 if the employee does not exist

### DELETE /manager/employees/{employeeId}

Disables the employee's Cognito account and marks them inactive in DynamoDB.

**Response 204:** No body.

**Error cases:**

- 403 if the employee belongs to a different manager
- 404 if the employee does not exist

### PATCH /manager/employees/{employeeId}

Re-enables a previously disabled employee's Cognito account and marks them active in DynamoDB.

**Response 204:** No body.

**Error cases:**

- 403 if the employee belongs to a different manager
- 404 if the employee does not exist

### GET /manager/employees/{employeeId}/availability

Returns the employee's recurring weekly availability schedule. The schedule captures which hours the employee is generally available each day of the week and is set by the employee themselves. Managers read it to inform scheduling decisions.

If the employee has never set availability, the route returns a payload with `schedule: null` rather than a 404, so callers can distinguish "no record yet" from "employee not found".

**Response 200:**

```json
{
  "employee_id": "uuid",
  "schedule": {
    "monday": ["09:00", "17:00"],
    "tuesday": ["09:00", "17:00"]
  },
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

`schedule` is `null` when the employee has not yet set their availability.

**Error cases:**

- 400 if `employeeId` path parameter is missing
- 403 if the employee belongs to a different manager
- 404 if the employee does not exist

### GET /manager/employees/{employeeId}/availability/overrides

Returns the employee's date-specific availability overrides — exceptions to their recurring schedule for specific calendar dates (e.g. holidays, time-off requests). Set by the employee; read by the manager to avoid scheduling conflicts.

If no overrides have been set, returns `overrides: {}` rather than a 404.

**Response 200:**

```json
{
  "employee_id": "uuid",
  "overrides": {
    "2025-07-04": "unavailable",
    "2025-12-25": "unavailable"
  },
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

`overrides` is an empty object `{}` when the employee has set no overrides.

**Error cases:**

- 400 if `employeeId` path parameter is missing
- 403 if the employee belongs to a different manager
- 404 if the employee does not exist

---

## SAM / env.local.json

**Function name:** `ManagerEmployeesFunction`

**SAM events:** GET, POST `/manager/employees`; GET, PUT, DELETE, PATCH `/manager/employees/{employeeId}`; GET `/manager/employees/{employeeId}/availability`; GET `/manager/employees/{employeeId}/availability/overrides`; plus OPTIONS for each distinct path.

**env.local.json entry:**

```json
"ManagerEmployeesFunction": {
  "TABLE_NAME": "daltime-daltime-backend-dev",
  "USER_POOL_ID": "us-east-1_kzQ806uSv"
}
```

`USER_POOL_ID` is required because POST uses Cognito AdminCreateUser, and DELETE/PATCH use AdminDisableUser/AdminEnableUser.

---

## File Layout

```
backend/src/functions/manager/employees/
  handler.ts    routes HTTP method + path to the correct service call
  service.ts    business logic: caller resolution, authz checks, field validation
  db.ts         DynamoDB queries: list, get, create, update, disable, enable, getAvailability, getAvailabilityOverrides
```

---

## Tests (vitest unit)

Required cases per handler test suite:

- **OPTIONS /manager/employees (and all sub-paths):** returns 200
- **GET /manager/employees:** happy path returns array; caller lookup fails → 403; service throws → 500
- **POST /manager/employees:** happy path → 201; missing body → 400; invalid JSON → 400; validation failure → 400; email conflict → 409; service throws → 500
- **PUT /manager/employees/{employeeId}:** happy path → 200; missing employeeId → 400; employee not found → 404; employee belongs to different manager → 403
- **DELETE /manager/employees/{employeeId}:** happy path → 204; missing employeeId → 400; not found → 404; wrong manager → 403; service throws → 500
- **PATCH /manager/employees/{employeeId}:** happy path → 204; missing employeeId → 400; not found → 404; wrong manager → 403; service throws → 500
- **GET /manager/employees/{employeeId}/availability:** happy path returns availability payload; employee not found → 404; wrong manager → 403; service throws → 500
- **GET /manager/employees/{employeeId}/availability/overrides:** happy path returns overrides payload; employee not found → 404; wrong manager → 403; service throws → 500
