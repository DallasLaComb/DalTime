# Blueprint: web-admin/employees — Cross-Org Employee Lookup

## Goal

Give Web Admin a read-only view of every employee across all organizations.  
Web Admin support staff use this to look up a specific user when investigating
an issue without needing to know which org they belong to.

## Auth Pattern (Story #257)

The handler calls `requireWebAdminWithLookup(event)` (async, from `shared/auth.ts`) instead of the old synchronous `requireWebAdmin`. This enforces two layers:

1. Cognito group check — the caller must be in the `WebAdmin` group.
2. DynamoDB provisioning check — the caller must have an ACTIVE `USER#<sub>/METADATA` record. Missing or DISABLED records return 403.

This is a read-only endpoint so `web_admin_id` is not threaded into the service call. The auth gate still applies.

## API surface

| Method  | Path                   | Auth         | Description                                                     |
| ------- | ---------------------- | ------------ | --------------------------------------------------------------- |
| GET     | `/web-admin/employees` | WebAdmin JWT | Returns all employees across all orgs, enriched with `org_name` |
| OPTIONS | `/web-admin/employees` | NONE         | CORS preflight                                                  |

## DynamoDB strategy

- Query **GSI1** with `GSI1PK = 'EMPLOYEE'` — all employee primary records write `GSI1PK: 'EMPLOYEE'`
- Collect unique `org_id` values from the result set
- **BatchGet** org items (`PK = ORG#<id>`, `SK = METADATA`) to resolve `org_name`
- Join in memory → return enriched list

## Response shape (per item)

```json
{
  "employee_id": "uuid",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0000",
  "org_id": "uuid",
  "org_name": "Acme Corp",
  "status": "CONFIRMED",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

## File layout

```
backend/src/functions/web-admin/employees/
  handler.ts   — GET + OPTIONS routing
  service.ts   — listEmployees(), joins org names
  db.ts        — listAllEmployees() via GSI1, batchGetOrgNames()

backend/src/functions/shared/models/web-admin/
  employee.model.ts   — WebAdminEmployee (DB shape) + WebAdminEmployeeResponse (API shape)

backend/test/unit/web-admin/employees/
  handler.test.ts
```

## SAM resources

- `WebAdminEmployeesFunctionLogGroup` log group
- `WebAdminEmployeesFunction` Lambda
  - Events: `ListWebAdminEmployees` (GET), `OptionsWebAdminEmployees` (OPTIONS, Auth: NONE)
  - Policy: `DynamoDBReadPolicy` on `DalTimeTable`
  - No Cognito policy needed (no user pool calls)

## env.local.json

Add `"WebAdminEmployeesFunction": { "TABLE_NAME": "daltime-daltime-backend-dev" }`

## Frontend

```
frontend/src/app/core/models/web-admin-employee.model.ts
frontend/src/app/services/web-admin-employees.service.ts
frontend/src/app/features/web-admin/employees/
  employees.ts
  employees.html
```

- Read-only list: no action buttons, no modals
- `app-search-bar` → filters by name or email client-side
- `app-data-table` (desktop) + `app-card-list` (mobile) columns: Name, Email, Organization, Status, Joined
- Add `web-admin/employees` route to `app.routes.ts`
- Add "Employees" nav link to `navbar.html` under WebAdmin block
- Add "Employees" card to `web-admin-dashboard.html`
