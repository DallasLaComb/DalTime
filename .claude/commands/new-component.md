# /new-component

Spec-driven workflow for a new Angular feature (component + service + model + tests).

**Usage:** `/new-component <role>/<feature-name>`

**Example:** `/new-component web-admin/organizations`

---

You are implementing a new Angular feature for DalTime using spec-driven development. The feature is: **$ARGUMENTS**

Parse the argument as `<role>/<feature-name>`. Valid roles: `web-admin`, `org-admin`, `manager`, `employee`.

## Step 1 — Write the Spec (do this first, do NOT write implementation code yet)

Create the file `specs/component/<role>/<feature-name>.spec.md` with this structure:

```markdown
# Spec: <Feature Name> Component

## Overview
One paragraph describing what this UI feature does and the user problem it solves.

## Role Scope
Which role sees this feature. Cognito group and Angular route guard required.

## Route
`/<role>/<feature-name>` — lazy loaded via `@defer`

## UI Behavior
- What the user sees on load
- What actions are available (buttons, forms, tables)
- Loading, empty, and error states

## API Calls
| Method | Endpoint | When | Response Shape |
|---|---|---|---|

## Frontend Model
(TypeScript interface for the data this component consumes)

## Form Validation Rules (if applicable)
Numbered list of field-level and form-level validation rules.

## Component Test Matrix
| Test | Action / State | Expected DOM behavior |
|---|---|---|
| Shows loading spinner | on init, API pending | spinner visible |
| Renders item list | API returns items | table/list visible with correct data |
| Shows empty state | API returns [] | empty message visible |
| Shows error state | API throws | error message visible |
| Form submit — valid | valid inputs | API called, success feedback shown |
| Form submit — invalid | missing required fields | error messages shown, API not called |

## Guard / Role Test Matrix
| Role | Expected behavior |
|---|---|
| WebAdmin | allowed |
| OrgAdmin | redirect to /unauthorized |
| Manager | redirect to /unauthorized |
| Employee | redirect to /unauthorized |
```

After writing the spec, **stop and ask the user to review it** before continuing to Step 2.

---

## Step 2 — Implement (only after user approves the spec)

Implement in this exact order. Check what already exists before creating files.

### a. Frontend Model
File: `frontend/src/app/core/models/<feature-name>.model.ts`

- TypeScript interface matching the API response shape
- Optional fields must be explicitly marked `?`
- Include a parse/factory helper if the API shape needs normalization
- No business logic

### b. API Service
File: `frontend/src/app/features/<role>/<feature-name>/<feature-name>.service.ts`

- Standalone `@Injectable({ providedIn: 'root' })`
- Inject `HttpClient` via `inject(HttpClient)`
- One method per API call, returning `Observable<T>`
- Use the frontend model as the return type

### c. Component
File: `frontend/src/app/features/<role>/<feature-name>/<feature-name>.component.ts`
Template: `frontend/src/app/features/<role>/<feature-name>/<feature-name>.component.html`

- Standalone component: `standalone: true`
- Use Signals for all state: `signal()`, `computed()`, `effect()`
- Inject service via `inject()`
- Handle loading, error, and empty states explicitly
- Use Bootstrap 5 classes for responsive layout
- Use `trackBy` function with `@for` loops
- Add `data-testid` attributes to all interactive elements and key data nodes

### d. Route Registration
Update `frontend/src/app/features/<role>/<role>.routes.ts` (or the relevant routes file):
- Register the new route with `loadComponent` for lazy loading

### e. Component Unit Tests
File: `frontend/src/app/features/<role>/<feature-name>/<feature-name>.component.spec.ts`

Follow these rules strictly:
- Use Angular Testing Library (`@testing-library/angular`)
- Query by `role`, `label`, or `data-testid` — never by CSS class or component ref
- Mock the service with `vi.fn()` / `jest.fn()` in `TestBed`
- Cover every row in the spec's component test matrix
- Required tests: loading state, success state, empty state, error state
- Form tests: valid submit calls service, invalid submit shows errors, API not called

### f. Service Unit Tests
File: `frontend/src/app/features/<role>/<feature-name>/<feature-name>.service.spec.ts`

- Use `provideHttpClientTesting` and `HttpTestingController`
- One test per API method
- Assert correct HTTP method, URL, and request body
- Assert correct response mapping to model

### g. Guard Tests (if a new guard is added)
File: `frontend/src/app/core/guards/<guard-name>.guard.spec.ts`

- Test all 4 roles: `WebAdmin`, `OrgAdmin`, `Manager`, `Employee`
- Assert correct `CanActivate` result or redirect URL per role

---

## Conventions Reminder

- All components use `ChangeDetectionStrategy.OnPush`
- Never use `ngModel` — use reactive forms or signal-based forms
- Never use `any` — strict TypeScript throughout
- Bootstrap 5 grid: `container`, `row`, `col-*` — responsive breakpoints `sm`, `md`, `lg`, `xl`
- `data-testid` attribute on every button, input, table row, and status message
- This project is **zoneless** — never use `fakeAsync`/`tick`. Use `async/await` + `await fixture.whenStable()` for async test assertions instead
- Run `npm test` in `frontend/` after implementation to verify tests pass
