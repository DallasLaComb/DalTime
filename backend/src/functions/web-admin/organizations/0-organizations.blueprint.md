# Spec: Organizations (Web Admin)

## Overview
Provides full CRUD management of Organizations — the top-level multi-tenant boundary for DalTime. Every OrgAdmin, Manager, and Employee belongs to exactly one Organization; their access to schedules, time entries, and other data is always scoped to their `org_id`. Only `WebAdmin` users can create, update, or delete organizations.

## Role Scope
**WebAdmin only.** All routes require a valid Cognito JWT with the caller belonging to the `WebAdmin` Cognito group.

> ⚠️ **Known Gap:** SAM template currently has `Auth: Authorizer: NONE` on all organization routes. All routes must be migrated to require `CognitoJwtAuthorizer` and enforce the `WebAdmin` group claim.

## API Routes

| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/organizations` | Yes — WebAdmin | List all organizations |
| POST | `/organizations` | Yes — WebAdmin | Create a new organization |
| GET | `/organizations/{orgId}` | Yes — WebAdmin | Get a single organization by ID |
| PUT | `/organizations/{orgId}` | Yes — WebAdmin | Partially update an organization |
| DELETE | `/organizations/{orgId}` | Yes — WebAdmin | Delete an organization |

## Request / Response Shapes

```typescript
// POST /organizations body
interface CreateOrganizationBody {
  name: string;     // required, trimmed
  address: string;  // required, trimmed
}

// PUT /organizations/{orgId} body
interface UpdateOrganizationBody {
  name?: string;     // optional, trimmed when provided
  address?: string;  // optional, trimmed when provided
}

// Public response shape (DynamoDB keys stripped)
interface OrganizationResponse {
  org_id: string;
  name: string;
  address: string;
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  org_admin_count: number;  // maintained atomically by the org-admins Lambda
}

// GET /organizations → OrganizationResponse[]
// POST /organizations → OrganizationResponse (201)
// GET /organizations/{orgId} → OrganizationResponse
// PUT /organizations/{orgId} → OrganizationResponse
// DELETE /organizations/{orgId} → 204 No Content
```

## Business Rules

1. `name` is required on create and must be non-empty after trimming.
2. `address` is required on create and must be non-empty after trimming.
3. `org_id` is server-generated (`randomUUID()`) — never accepted from the client.
4. `created_at` and `updated_at` are server-generated ISO 8601 timestamps.
5. `org_admin_count` is initialized to `0` on create. It is incremented and decremented atomically by the org-admins Lambda — never written by this handler directly.
6. On `PUT`, only `name` and `address` are updatable. Fields omitted from the body retain their existing values.
7. `PUT` and `DELETE` on an unknown `orgId` return 404.
8. Whitespace-only strings for `name` or `address` are treated as empty and return 400.

## DynamoDB Access Patterns

| Operation | PK | SK | Index | Command |
|---|---|---|---|---|
| List all orgs | — | — | GSI1 (`GSI1PK = 'ORG'`) | `QueryCommand` |
| Get org by ID | `ORG#<org_id>` | `METADATA` | — | `GetCommand` |
| Create org | `ORG#<org_id>` | `METADATA` | — | `PutCommand` |
| Update org | `ORG#<org_id>` | `METADATA` | — | `UpdateCommand` |
| Delete org | `ORG#<org_id>` | `METADATA` | — | `DeleteCommand` |

## Single-Table Key Design

```
PK      = ORG#<org_id>
SK      = METADATA
GSI1PK  = ORG
GSI1SK  = <created_at ISO 8601>
```

The `GSI1` index allows listing all organizations sorted by creation time without a table scan.

## Test Matrix

| # | Test | Route | Input | Expected Status | Assert on Body |
|---|---|---|---|---|---|
| 1 | Happy path — list | `GET /organizations` | valid JWT | 200 | array of `OrganizationResponse` |
| 2 | Happy path — create | `POST /organizations` | `{ name, address }` | 201 | `OrganizationResponse` with generated `org_id` |
| 3 | Happy path — get | `GET /organizations/{orgId}` | known orgId | 200 | matching `OrganizationResponse` |
| 4 | Happy path — update name only | `PUT /organizations/{orgId}` | `{ name: 'New' }` | 200 | updated `name`, unchanged `address` |
| 5 | Happy path — delete | `DELETE /organizations/{orgId}` | known orgId | 204 | empty body |
| 6 | Create — missing body | `POST /organizations` | no body | 400 | `{ error: 'Request body is required' }` |
| 7 | Create — invalid JSON | `POST /organizations` | malformed JSON | 400 | `{ error: 'Invalid JSON body' }` |
| 8 | Create — missing name | `POST /organizations` | `{ address }` only | 400 | `{ error: 'name is required' }` |
| 9 | Create — missing address | `POST /organizations` | `{ name }` only | 400 | `{ error: 'address is required' }` |
| 10 | Create — whitespace name | `POST /organizations` | `{ name: '  ', address }` | 400 | `{ error: 'name is required' }` |
| 11 | Get — unknown orgId | `GET /organizations/{orgId}` | unknown id | 404 | `{ error: "Organization '<id>' not found" }` |
| 12 | Update — unknown orgId | `PUT /organizations/{orgId}` | unknown id | 404 | `{ error: "Organization '<id>' not found" }` |
| 13 | Update — missing body | `PUT /organizations/{orgId}` | no body | 400 | `{ error: 'Request body is required' }` |
| 14 | Delete — unknown orgId | `DELETE /organizations/{orgId}` | unknown id | 404 | `{ error: "Organization '<id>' not found" }` |
| 15 | DynamoDB failure — list | `GET /organizations` | DynamoDB throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 16 | DynamoDB failure — create | `POST /organizations` | DynamoDB throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 17 | CORS preflight | `OPTIONS /organizations` | no auth | 200 | empty body |

## Known Gaps (to address)

- [x] ~~No unit tests~~ — added in gap-fill pass
- [x] ~~Auth not enforced~~ — fixed in gap-fill pass
- [x] ~~`org_admin_ids` unmanaged~~ — replaced by `org_admin_count` (atomic counter) + org-scoped org-admins management feature
