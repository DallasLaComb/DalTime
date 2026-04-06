# /new-lambda

Spec-driven workflow for a new Lambda feature.

**Usage:** `/new-lambda <role>/<feature-name>`

**Example:** `/new-lambda web-admin/users`

---

You are implementing a new Lambda feature for DalTime using spec-driven development. The feature is: **$ARGUMENTS**

Parse the argument as `<role>/<feature-name>`. Valid roles: `web-admin`, `org-admin`, `manager`, `employee`.

## Step 1 — Write the Spec (do this first, do NOT write implementation code yet)

Create the file `specs/lambda/<role>/<feature-name>.spec.md` with this structure:

```markdown
# Spec: <Feature Name>

## Overview
One paragraph describing what this feature does and why it exists.

## Role Scope
Which role(s) can access these endpoints and what Cognito group is required.

## API Routes
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | /... | Yes — <role> | ... |

## Request / Response Shapes
(TypeScript interfaces for request bodies and response payloads)

## Business Rules
Numbered list of validation rules, constraints, and logic that must be enforced.

## DynamoDB Access Patterns
| Operation | PK | SK | GSI | Notes |
|---|---|---|---|---|

## Single-Table Key Design
- PK format: `<TYPE>#<id>`
- SK format: `METADATA` or sub-entity discriminator
- GSI1PK: `<TYPE>`
- GSI1SK: `<created_at ISO>`

## Test Matrix
| Test | Route | Input | Expected Status | Notes |
|---|---|---|---|---|
| Happy path — list | GET /... | valid JWT | 200 | returns array |
| Happy path — create | POST /... | valid body | 201 | returns created item |
| Missing body | POST /... | no body | 400 | |
| Invalid JSON | POST /... | malformed JSON | 400 | |
| Not found | GET /.../{id} | unknown id | 404 | |
| DynamoDB failure | GET /... | DynamoDB throws | 500 | |
```

After writing the spec, **stop and ask the user to review it** before continuing to Step 2.

---

## Step 2 — Implement (only after user approves the spec)

Implement in this exact order. Check what already exists before creating files.

### a. Model
File: `backend/src/functions/shared/models/<role>/<feature-name>.model.ts`

- Full DynamoDB entity interface (include PK/SK/GSI fields)
- Create/Update body interfaces
- Public response interface (key fields omitted — used as return type after `stripKeys()`)

### b. DB layer
File: `backend/src/functions/<role>/<feature-name>/db.ts`

- Import `docClient` and `TABLE_NAME` from `../../shared/dynamo.js`
- One exported async function per DynamoDB operation
- Use `@aws-sdk/lib-dynamodb` commands: `GetCommand`, `PutCommand`, `QueryCommand`, `UpdateCommand`, `DeleteCommand`
- No business logic — data access only

### c. Service layer
File: `backend/src/functions/<role>/<feature-name>/service.ts`

- Import db functions — NOT `docClient` directly
- Export `ValidationError extends Error`
- One exported async function per business operation
- Validate inputs, throw `ValidationError` for bad data
- Call `stripKeys()` on all returned items

### d. Handler
File: `backend/src/functions/<role>/<feature-name>/handler.ts`

- Accept `APIGatewayProxyEventV2WithJWTAuthorizer`
- Route on `event.routeKey`
- Handle OPTIONS for CORS preflight → return `ok('')`
- Catch `ValidationError` → `badRequest()`
- Catch all other errors → `internalError()`
- Import response helpers from `../../shared/response.js`

### e. Unit Tests
File: `backend/test/unit/<role>/<feature-name>/handler.test.ts`

Follow these rules strictly:
- Use `vi.mock()` to mock the service module entirely
- Create a `buildApiGwEvent(overrides)` factory at top of file
- One `describe` block per route
- Cover every row in the spec's test matrix
- Required tests per route: happy path, missing/invalid body (400), not found (404), service throws (500)
- Assert on status codes AND parsed response body shape

### f. SAM Template
File: `backend/template.yaml`

Add:
- A `LogGroup` resource for the new function
- The Lambda `Function` resource with correct `Handler`, `Environment`, and `Events`
- HTTP API routes for each method/path in the spec
- The JWT Authorizer on protected routes

---

## Conventions Reminder

- All imports use `.js` extension (ESM)
- `randomUUID()` from `node:crypto` for ID generation
- Timestamps: `new Date().toISOString()`
- Never hardcode table names — always `process.env.TABLE_NAME`
- Run `npm test` in `backend/` after implementation to verify unit tests pass
