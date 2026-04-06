# Spec: Org Admin Management (Web Admin)

## Overview
Allows a WebAdmin to register, list, and disable OrgAdmin users scoped to a specific Organization. All routes are nested under `/web-admin/organizations/{orgId}` — there is no global cross-org endpoint. When an OrgAdmin is created, the parent org's `org_admin_count` is incremented atomically. When disabled, it is decremented. On first sign-in, Cognito forces the new user to set their own password (`FORCE_CHANGE_PASSWORD` is the default status from `AdminCreateUser`).

## Role Scope
**WebAdmin only.** All routes require `CognitoJwtAuthorizer`.

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/web-admin/organizations/{orgId}/org-admins` | Yes — WebAdmin | List OrgAdmins for an org |
| POST | `/web-admin/organizations/{orgId}/org-admins` | Yes — WebAdmin | Register a new OrgAdmin for an org |
| DELETE | `/web-admin/organizations/{orgId}/org-admins/{userId}` | Yes — WebAdmin | Disable an OrgAdmin |

## Request / Response Shapes

```typescript
// POST body
interface CreateOrgAdminBody {
  email: string;         // Cognito username — must be a valid email
  name: string;          // display name, stored as Cognito 'name' attribute
  temp_password: string; // WebAdmin-chosen; Cognito enforces pool password policy
}

// Stored DynamoDB entity (two records — see Key Design)
interface OrgAdminUser {
  // Primary record
  PK: string;         // ORG#<org_id>
  SK: string;         // USER#<user_sub>
  GSI1PK: string;     // ORG_ADMIN
  GSI1SK: string;     // <created_at ISO>
  user_id: string;    // Cognito sub
  email: string;
  name: string;
  org_id: string;
  status: string;     // Cognito UserStatus e.g. FORCE_CHANGE_PASSWORD, CONFIRMED, DISABLED
  created_at: string; // ISO 8601
}

// Public response shape (DynamoDB keys stripped)
interface OrgAdminUserResponse {
  user_id: string;
  email: string;
  name: string;
  org_id: string;
  status: string;
  created_at: string;
}

// GET  → OrgAdminUserResponse[]
// POST → OrgAdminUserResponse (201)
// DELETE → 204 No Content
```

## Business Rules

1. `email` is required, non-empty after trimming, and must match a basic email pattern (`x@x.x`).
2. `name` is required and non-empty after trimming.
3. `temp_password` is required and non-empty. Cognito's pool password policy is enforced — if it fails, surface a 400 with Cognito's error message.
4. The `orgId` path parameter must reference an existing Organization in DynamoDB. Return 404 if not found.
5. If Cognito returns `UsernameExistsException`, return 409 with `{ error: 'A user with this email already exists' }`.
6. On successful creation:
   - Add user to the `OrgAdmin` Cognito group (`AdminAddUserToGroup`).
   - Write the primary DynamoDB record (`PK = ORG#<org_id>`, `SK = USER#<user_sub>`).
   - Write the reverse-lookup record (`PK = USER#<user_sub>`, `SK = METADATA`, `org_id` attribute).
   - Atomically increment `org_admin_count` on the org record using `ADD org_admin_count :one`.
7. `DELETE` disables the Cognito account (`AdminDisableUser`) — does **not** delete the Cognito user or DynamoDB records (preserve audit trail). Updates DynamoDB `status` to `DISABLED`. Atomically decrements `org_admin_count` on the org record (floor at 0).
8. `MessageAction: 'SUPPRESS'` on `AdminCreateUser` — Cognito does not send a welcome email. The WebAdmin delivers credentials manually.
9. The stored `user_id` is the Cognito `sub` UUID, not the email/username.

## Cognito Operations

| Step | Command | Notes |
|---|---|---|
| Create user | `AdminCreateUserCommand` | `MessageAction: 'SUPPRESS'`, `TemporaryPassword`, `UserAttributes: [{ Name: 'name', Value }, { Name: 'email', Value }, { Name: 'email_verified', Value: 'true' }]` |
| Add to group | `AdminAddUserToGroupCommand` | Group: `OrgAdmin` |
| Disable user | `AdminDisableUserCommand` | Soft delete only |

## DynamoDB Access Patterns

| Operation | PK | SK | Index | Command |
|---|---|---|---|---|
| List OrgAdmins for org | `ORG#<org_id>` | begins\_with `USER#` | — | `QueryCommand` |
| Write primary record | `ORG#<org_id>` | `USER#<user_sub>` | — | `PutCommand` |
| Write reverse-lookup | `USER#<user_sub>` | `METADATA` | — | `PutCommand` |
| Read reverse-lookup (for delete) | `USER#<user_sub>` | `METADATA` | — | `GetCommand` |
| Update status on disable | `ORG#<org_id>` | `USER#<user_sub>` | — | `UpdateCommand` |
| Increment org count | `ORG#<org_id>` | `METADATA` | — | `UpdateCommand` (ADD) |
| Decrement org count | `ORG#<org_id>` | `METADATA` | — | `UpdateCommand` (ADD -1) |

## Single-Table Key Design

```
// Primary record — supports listing by org
PK      = ORG#<org_id>
SK      = USER#<user_sub>
GSI1PK  = ORG_ADMIN
GSI1SK  = <created_at ISO>

// Reverse-lookup — supports GET/DELETE by userId without knowing org_id
PK      = USER#<user_sub>
SK      = METADATA
org_id  = <org_id>      ← used to reconstruct ORG#<org_id> PK
```

## SAM Template Requirements

- New Lambda function: `OrgAdminsFunction`
- New log group: `OrgAdminsFunctionLogGroup`
- `USER_POOL_ID` env var: `!Ref CognitoUserPoolId`
- `TABLE_NAME` env var: `!Ref DalTimeTable`
- IAM policy: `DynamoDBCrudPolicy` on `DalTimeTable` + `Statement` allowing `cognito-idp:AdminCreateUser`, `cognito-idp:AdminAddUserToGroup`, `cognito-idp:AdminDisableUser` on the user pool ARN
- Routes: GET/POST on `/web-admin/organizations/{orgId}/org-admins`, DELETE on `/web-admin/organizations/{orgId}/org-admins/{userId}`, OPTIONS on both paths

## Test Matrix

| # | Test | Route | Input | Expected Status | Assert on Body |
|---|---|---|---|---|---|
| 1 | Happy path — list | `GET /{orgId}/org-admins` | valid JWT | 200 | `OrgAdminUserResponse[]` |
| 2 | Happy path — create | `POST /{orgId}/org-admins` | valid body | 201 | response with `status: 'FORCE_CHANGE_PASSWORD'` |
| 3 | Happy path — disable | `DELETE /{orgId}/org-admins/{userId}` | known userId | 204 | empty body |
| 4 | Create — missing body | `POST` | no body | 400 | `{ error: 'Request body is required' }` |
| 5 | Create — invalid JSON | `POST` | malformed JSON | 400 | `{ error: 'Invalid JSON body' }` |
| 6 | Create — missing email | `POST` | no email field | 400 | `{ error: 'email is required' }` |
| 7 | Create — invalid email format | `POST` | `email: 'bad'` | 400 | `{ error: 'email must be a valid email address' }` |
| 8 | Create — missing name | `POST` | no name | 400 | `{ error: 'name is required' }` |
| 9 | Create — missing temp_password | `POST` | no temp_password | 400 | `{ error: 'temp_password is required' }` |
| 10 | Create — org not found | `POST` | unknown orgId | 404 | `{ error: "Organization '<id>' not found" }` |
| 11 | Create — duplicate email | `POST` | existing email | 409 | `{ error: 'A user with this email already exists' }` |
| 12 | Create — weak password | `POST` | password fails Cognito policy | 400 | Cognito error message forwarded |
| 13 | Delete — unknown userId | `DELETE` | unknown userId | 404 | `{ error: "User '<id>' not found" }` |
| 14 | Delete — missing userId param | `DELETE` | no param | 400 | `{ error: 'userId path parameter is required' }` |
| 15 | Delete — missing orgId param | any route | no orgId | 400 | `{ error: 'orgId path parameter is required' }` |
| 16 | Cognito failure on create | `POST` | Cognito throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 17 | DynamoDB failure on list | `GET` | DynamoDB throws | 500 | `{ error: 'An unexpected error occurred' }` |
| 18 | CORS preflight | `OPTIONS` | — | 200 | empty body |
