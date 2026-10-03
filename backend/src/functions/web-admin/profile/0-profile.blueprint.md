# Web-Admin Profile — Lambda Blueprint

## What this feature does

A WebAdmin can read and update their own user profile through two endpoints:

- `GET /web-admin/profile` — returns the caller's WebAdmin profile (name, email, status, entity type, timestamps).
- `PUT /web-admin/profile` — updates the caller's `first_name` and/or `last_name` in DynamoDB.

WebAdmins are cross-tenant super-admins. Unlike OrgAdmins, Managers, and Employees, a WebAdmin has no `org_id` — their single record in the database is `USER#<Cognito sub> / METADATA`.

## Auth

Both endpoints use `requireWebAdminWithLookup` (from `shared/auth.ts`) as the sole auth guard. This function:

1. Checks the caller's Cognito JWT group claim — rejects with 403 if not in the `WebAdmin` group.
2. Fetches `USER#<sub> / METADATA` from DynamoDB — rejects with 403 if the record is missing.
3. Checks the record's `status` field — rejects with 403 if `status !== 'ACTIVE'`.

This two-layer check means disabling a WebAdmin's DynamoDB record immediately blocks API access without requiring Cognito token revocation.

## Endpoints

### GET /web-admin/profile

- **Auth**: WebAdmin JWT (HTTP API default authorizer)
- **Handler**: `handler.ts` → `getProfile` in `service.ts`
- **What it does**: Fetches `USER#<sub> / METADATA` via `getMetadataRecord` (base-table GetItem), enriches the `status` field with the live Cognito `UserStatus` via `enrichSingleWithCognitoStatus`, strips DynamoDB key fields, and returns the result.
- **Response 200**: `WebAdminProfile` object
- **Response 403**: caller not in WebAdmin group, record missing, or record DISABLED

### PUT /web-admin/profile

- **Auth**: WebAdmin JWT (HTTP API default authorizer)
- **Handler**: `handler.ts` → `updateProfile` in `service.ts`
- **What it does**: Validates the request body (at least one of `first_name` or `last_name` must be a non-empty string), then calls `updateWebAdminProfile` in `db.ts` which uses `buildUpdateExpression` + `UpdateCommand` with `ReturnValues: 'ALL_NEW'`. Returns the full updated profile.
- **Request body**: `{ first_name?: string; last_name?: string }` — at least one field required
- **Response 200**: updated `WebAdminProfile` object
- **Response 400**: no fields provided, empty string field, field exceeds 100 characters, field contains invalid characters
- **Response 403**: not a WebAdmin, no DynamoDB record, or DISABLED

### OPTIONS /web-admin/profile

- **Auth**: NONE (API Gateway bypass, configured in SAM template)
- **What it does**: Returns 200 with CORS headers for browser preflight requests.

## DynamoDB access pattern

- GET: `GetItem` on `PK = USER#<sub>`, `SK = METADATA` via `getMetadataRecord` helper.
- PUT: `UpdateItem` on same key via `buildUpdateExpression`. Only provided fields are written (partial update). `updated_at` is always stamped.
- No GSI, no org partition, no fan-out writes.

## Validation rules (PUT)

- At least one of `first_name` or `last_name` must be present and non-undefined.
- Each provided field must be 1–100 characters (after trimming).
- Each provided field must match `/^[\p{L}\p{M}'\-. ]+$/u` — letters, hyphens, apostrophes, spaces, periods only.
- Fields are trimmed before writing.

## Files

| File                                                | Purpose                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `model.ts`                                          | `WebAdminProfile` and `UpdateProfileRequest` TypeScript types                 |
| `db.ts`                                             | `getWebAdminProfile(sub)` and `updateWebAdminProfile(sub, fields, updatedAt)` |
| `service.ts`                                        | `getProfile(sub, cognitoClient)` and `updateProfile(sub, body)`               |
| `handler.ts`                                        | Lambda entrypoint, OPTIONS short-circuit, route switching                     |
| `0-profile.blueprint.md`                            | This file                                                                     |
| `../../test/unit/web-admin/profile/handler.test.ts` | Unit tests                                                                    |

## SAM registration

Function name: `WebAdminProfileFunction`
Handler path: `src/functions/web-admin/profile/handler.handler`
Routes: `GET /web-admin/profile`, `PUT /web-admin/profile`, `OPTIONS /web-admin/profile`
Environment: `USER_POOL_ID` (for Cognito enrichment)
Policies: `DynamoDBCrudPolicy`, `cognito-idp:AdminGetUser`
