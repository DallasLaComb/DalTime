# Spec: Manager Management (Org Admin)

## Overview
Allows an OrgAdmin to register, list, update, and disable Manager users scoped to their organization. All routes are nested under `/org-admin/managers`. The OrgAdmin's `org_id` is resolved from their Cognito `sub` via the `USER#<sub>` reverse-lookup record (same pattern used by web-admin org-admins). When a Manager is created, the parent OrgAdmin's `manager_count` is incremented atomically. When disabled, it is decremented. On first sign-in, Cognito forces the new user to set their own password (`FORCE_CHANGE_PASSWORD`).

## Role Scope
**OrgAdmin only.** All routes require `CognitoJwtAuthorizer`. The caller's `org_id` is derived from the JWT `sub` claim via the reverse-lookup record (`PK = USER#<sub>`, `SK = METADATA`), never from a path parameter — OrgAdmins can only manage managers within their own organization.

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/org-admin/managers` | Yes — OrgAdmin | List all managers under the caller's org |
| POST | `/org-admin/managers` | Yes — OrgAdmin | Register a new manager |
| PUT | `/org-admin/managers/{managerId}` | Yes — OrgAdmin | Update a manager's first name, last name, or phone |
| DELETE | `/org-admin/managers/{managerId}` | Yes — OrgAdmin | Disable a manager |

## Request / Response Shapes

```typescript
// POST body
interface CreateManagerBody {
  email: string;         // Cognito username — must be a valid email
  first_name: string;    // required
  last_name: string;     // required
  phone?: string;        // optional
  temp_password: string; // OrgAdmin-chosen; Cognito enforces pool password policy
}

// PUT body — all fields optional, at least one required
interface UpdateManagerBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

// Stored DynamoDB entity (two records — see Key Design)
interface Manager {
  // Primary record
  PK: string;             // ORG#<org_id>
  SK: string;             // MANAGER#<manager_id>
  GSI1PK: string;         // MANAGER
  GSI1SK: string;         // <created_at ISO>
  manager_id: string;     // Cognito sub
  first_name: string;
  last_name: string;
  email: string;
  phone: string;          // empty string if not provided
  org_id: string;
  org_admin_id: string;   // the OrgAdmin who created this manager
  status: string;         // Cognito UserStatus
  employee_count: number; // atomic counter
  created_at: string;     // ISO 8601
  updated_at: string;     // ISO 8601
}

// Public response shape (DynamoDB keys stripped)
interface ManagerResponse {
  manager_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_admin_id: string;
  status: string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

// GET    → ManagerResponse[]
// POST   → ManagerResponse (201)
// PUT    → ManagerResponse
// DELETE → 204 No Content
```

## Business Rules

1. `email` is required, non-empty after trimming, and must match a basic email pattern (`x@x.x`).
2. `first_name` is required and non-empty after trimming.
3. `last_name` is required and non-empty after trimming.
4. `phone` is optional. If provided, store trimmed value; if omitted, store empty string.
5. `temp_password` is required and non-empty. Cognito's pool password policy is enforced — if it fails, surface a 400 with Cognito's error message.
6. The caller's `org_id` is resolved from the JWT `sub` via the reverse-lookup record. If the reverse-lookup record is not found, return 403.
7. If Cognito returns `UsernameExistsException`, return 409 with `{ error: 'A user with this email already exists' }`.
8. On successful creation:
   - Add user to the `Manager` Cognito group (`AdminAddUserToGroup`).
   - Write the primary DynamoDB record (`PK = ORG#<org_id>`, `SK = MANAGER#<manager_id>`).
   - Write the reverse-lookup record (`PK = USER#<manager_id>`, `SK = METADATA`).
   - Atomically increment `manager_count` on the OrgAdmin's user record.
9. `PUT` updates only `first_name`, `last_name`, and `phone`. At least one field must be provided. Updates both the primary record and the reverse-lookup record. The `updated_at` timestamp is refreshed.
10. `PUT` on an unknown `managerId` returns 404. `PUT` on a manager not belonging to the caller's org returns 403.
11. `DELETE` disables the Cognito account (`AdminDisableUser`) — does **not** delete the Cognito user or DynamoDB records (preserve audit trail). Updates DynamoDB `status` to `DISABLED`. Atomically decrements `manager_count` on the OrgAdmin's user record (floor at 0).
12. `DELETE` on an unknown `managerId` returns 404. `DELETE` on a manager not belonging to the caller's org returns 403.
13. `MessageAction: 'SUPPRESS'` on `AdminCreateUser` — Cognito does not send a welcome email. The OrgAdmin delivers credentials manually.
14. The stored `manager_id` is the Cognito `sub` UUID, not the email/username.
15. `employee_count` is initialized to `0` on create. It is incremented/decremented atomically by the future employees Lambda — never written by this handler directly.

## Cognito Operations

| Step | Command | Notes |
|---|---|---|
| Create user | `AdminCreateUserCommand` | `MessageAction: 'SUPPRESS'`, `TemporaryPassword`, `UserAttributes: [{ Name: 'name', Value: '<first_name> <last_name>' }, { Name: 'email', Value }, { Name: 'email_verified', Value: 'true' }, { Name: 'custom:org_id', Value }]` |
| Add to group | `AdminAddUserToGroupCommand` | Group: `Manager` |
| Disable user | `AdminDisableUserCommand` | Soft delete only |

## DynamoDB Access Patterns

| Operation | PK | SK | Index | Command |
|---|---|---|---|---|
| Resolve caller's org_id | `USER#<sub>` | `METADATA` | — | `GetCommand` |
| List managers for org | `ORG#<org_id>` | begins\_with `MANAGER#` | — | `QueryCommand` |
| Get manager by ID | `ORG#<org_id>` | `MANAGER#<manager_id>` | — | `GetCommand` |
| Write primary record | `ORG#<org_id>` | `MANAGER#<manager_id>` | — | `PutCommand` |
| Write reverse-lookup | `USER#<manager_id>` | `METADATA` | — | `PutCommand` |
| Read reverse-lookup (for delete/update) | `USER#<manager_id>` | `METADATA` | — | `GetCommand` |
| Update primary record | `ORG#<org_id>` | `MANAGER#<manager_id>` | — | `UpdateCommand` |
| Update reverse-lookup | `USER#<manager_id>` | `METADATA` | — | `UpdateCommand` |
| Update status on disable | `ORG#<org_id>` | `MANAGER#<manager_id>` | — | `UpdateCommand` |
| Increment manager_count | `ORG#<org_id>` | `USER#<org_admin_sub>` | — | `UpdateCommand` (ADD) |
| Decrement manager_count | `ORG#<org_id>` | `USER#<org_admin_sub>` | — | `UpdateCommand` (ADD -1) |

## Single-Table Key Design

```
// Primary record — supports listing by org
PK      = ORG#<org_id>
SK      = MANAGER#<manager_id>
GSI1PK  = MANAGER
GSI1SK  = <created_at ISO>

// Reverse-lookup — supports GET/DELETE/UPDATE by managerId without knowing org_id
PK      = USER#<manager_id>
SK      = METADATA
org_id  = <org_id>
```

## SAM Template Requirements

- New Lambda function: `ManagersFunction`
- New log group: `ManagersFunctionLogGroup`
- `USER_POOL_ID` env var: `!Ref CognitoUserPoolId`
- `TABLE_NAME` env var: via Globals (already set)
- IAM policy: `DynamoDBCrudPolicy` on `DalTimeTable` + `Statement` allowing `cognito-idp:AdminCreateUser`, `cognito-idp:AdminAddUserToGroup`, `cognito-idp:AdminDisableUser`, `cognito-idp:AdminGetUser` on the user pool ARN
- Routes: GET/POST on `/org-admin/managers`, PUT/DELETE on `/org-admin/managers/{managerId}`, OPTIONS on both paths

## Test Matrix

| # | Test | Route | Input | Expected Status | Assert on Body |
|---|---|---|---|---|---|
| 1 | Happy path — list | `GET /org-admin/managers` | valid JWT | 200 | `ManagerResponse[]` |
| 2 | Happy path — create | `POST /org-admin/managers` | valid body | 201 | response with `status: 'FORCE_CHANGE_PASSWORD'`, `employee_count: 0` |
| 3 | Happy path — update | `PUT /org-admin/managers/{managerId}` | `{ first_name: 'New' }` | 200 | updated `first_name`, unchanged `last_name` |
| 4 | Happy path — disable | `DELETE /org-admin/managers/{managerId}` | known managerId | 204 | empty body |
| 5 | Create — missing body | `POST` | no body | 400 | `{ error: 'Request body is required' }` |
| 6 | Create — invalid JSON | `POST` | malformed JSON | 400 | `{ error: 'Invalid JSON body' }` |
| 7 | Create — missing email | `POST` | no email field | 400 | `{ error: 'email is required' }` |
| 8 | Create — invalid email format | `POST` | `email: 'bad'` | 400 | `{ error: 'email must be a valid email address' }` |
| 9 | Create — missing first_name | `POST` | no first_name | 400 | `{ error: 'first_name is required' }` |
| 10 | Create — missing last_name | `POST` | no last_name | 400 | `{ error: 'last_name is required' }` |
| 11 | Create — missing temp_password | `POST` | no temp_password | 400 | `{ error: 'temp_password is required' }` |
| 12 | Create — duplicate email | `POST` | existing email | 409 | `{ error: 'A user with this email already exists' }` |
| 13 | Create — weak password | `POST` | password fails Cognito policy | 400 | Cognito error message forwarded |
| 14 | Create — caller reverse-lookup not found | `POST` | unknown sub | 403 | `{ error: 'Caller organization could not be resolved' }` |
| 15 | Update — unknown managerId | `PUT` | unknown id | 404 | `{ error: "Manager '<id>' not found" }` |
| 16 | Update — manager not in caller's org | `PUT` | different org | 403 | `{ error: 'Not authorized to manage this manager' }` |
| 17 | Update — missing body | `PUT` | no body | 400 | `{ error: 'Request body is required' }` |
| 18 | Update — empty body | `PUT` | `{}` | 400 | `{ error: 'At least one field must be provided' }` |
| 19 | Delete — unknown managerId | `DELETE` | unknown id | 404 | `{ error: "Manager '<id>' not found" }` |
| 20 | Delete — manager not in caller's org | `DELETE` | different org | 403 | `{ error: 'Not authorized to manage this manager' }` |
| 21 | Cognito failure on create | `POST` | Cognito throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 22 | DynamoDB failure on list | `GET` | DynamoDB throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 23 | CORS preflight | `OPTIONS` | — | 200 | empty body |
