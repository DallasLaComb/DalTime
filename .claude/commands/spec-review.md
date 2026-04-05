# /spec-review

Audit an existing implementation against its spec document.

**Usage:** `/spec-review <role>/<feature-name>`

**Example:** `/spec-review web-admin/organizations`

---

You are auditing an existing DalTime feature against its spec. The feature is: **$ARGUMENTS**

Parse the argument as `<role>/<feature-name>`.

## What to Review

### 1. Locate the Spec
Read `specs/lambda/<role>/<feature-name>.spec.md` OR `specs/component/<role>/<feature-name>.spec.md` (check both).

If no spec exists, **stop and report** — the feature is missing its spec. Do not proceed with a review; instead ask the user if they want to run `/new-lambda` or `/new-component` to create a retroactive spec.

### 2. Read the Implementation

**For Lambda features**, read:
- `backend/src/functions/shared/models/<role>/<feature-name>.model.ts`
- `backend/src/functions/<role>/<feature-name>/db.ts`
- `backend/src/functions/<role>/<feature-name>/service.ts`
- `backend/src/functions/<role>/<feature-name>/handler.ts`
- `backend/test/unit/<role>/<feature-name>/handler.test.ts`
- The relevant section of `backend/template.yaml`

**For Angular features**, read:
- `frontend/src/app/core/models/<feature-name>.model.ts`
- `frontend/src/app/features/<role>/<feature-name>/<feature-name>.service.ts`
- `frontend/src/app/features/<role>/<feature-name>/<feature-name>.component.ts`
- `frontend/src/app/features/<role>/<feature-name>/<feature-name>.component.spec.ts`
- `frontend/src/app/features/<role>/<feature-name>/<feature-name>.service.spec.ts`

### 3. Produce a Gap Report

Output a structured gap report with these sections:

---

#### Spec Compliance

For each item in the spec, mark one of:
- ✅ Implemented correctly
- ⚠️ Partially implemented (describe what's missing)
- ❌ Not implemented

Cover:
- API routes (correct method, path, auth)
- Request validation (all business rules enforced)
- Response shapes (match spec interfaces)
- DynamoDB key format (PK/SK/GSI match spec design)
- Error handling (400/403/404/500 paths exist)

#### Test Coverage Gaps

Compare the spec's test matrix against the actual test file. For each test row:
- ✅ Test exists and covers the case
- ⚠️ Test exists but is incomplete or uses wrong assertion style
- ❌ Test missing entirely

Also flag:
- Any `describe` block missing the happy path
- Any handler with fewer than 5 test cases (happy + 400 + 403 + 404 + 500)
- Any test that hardcodes raw event JSON instead of using a factory function
- Any test that does NOT assert on the response body (status code only is insufficient)

#### Convention Violations

Flag any of the following:
- `docClient` imported directly in handler (not injected)
- `any` type used
- Missing `.js` extension on ESM imports
- Business logic in `db.ts`
- DynamoDB access in `service.ts` (should go through `db.ts`)
- `TABLE_NAME` hardcoded instead of read from `process.env`
- Angular: component not standalone
- Angular: state using `BehaviorSubject` instead of Signals
- Angular: `any` type
- Angular: no `data-testid` on interactive elements
- Angular: tests querying by CSS class instead of role/label/testid

#### Recommended Actions

A numbered, prioritized list of what to fix. Group by: Critical (breaks tests or prod) → Important (coverage gaps) → Minor (convention cleanup).

---

After producing the report, ask the user which items they want addressed before making any code changes.
