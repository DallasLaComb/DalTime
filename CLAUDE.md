# DalTime — Claude Code Project Context

## Architecture

| Layer | Technology |
|---|---|
| CDN / Static Hosting | CloudFront + S3 |
| Frontend | Angular 21 (Standalone Components, Signals) |
| API | API Gateway V2 (HTTP API) + JWT Authorizer |
| Backend | AWS Lambda (Node.js 24, ESM) |
| Database | DynamoDB (single-table design) |
| Auth | Amazon Cognito |
| IaC | AWS SAM (`backend/template.yaml`) |
| CI/CD | GitHub Actions |

## Environments

| Name | Purpose |
|---|---|
| `local` | SAM local + DynamoDB local (Docker) |
| `dev` | Auto-deploys on merge to `master` |
| `qa` | Release gate — manual approval |
| `prod` | Production — manual approval after QA |

## Roles

There are exactly 4 roles. Every auth guard, route, and API test must cover all of them.

| Role | Cognito Group | Route Prefix |
|---|---|---|
| `WebAdmin` | `WebAdmin` | `/web-admin` |
| `OrgAdmin` | `OrgAdmin` | `/org-admin` |
| `Manager` | `Manager` | `/manager` |
| `Employee` | `Employee` | `/employee` |

## Project Structure

```
backend/
  src/functions/
    shared/           # dynamo.ts, response.ts, models/
    web-admin/        # one folder per Lambda feature
    org-admin/
    manager/
    employee/
  test/
    unit/             # vitest — no AWS, no network
    integration/      # vitest — requires LocalStack or SAM local
  template.yaml       # SAM template
frontend/
  src/app/
    core/             # auth, guards, interceptors, models, navbar
    features/         # vertical slice per role
    shared/           # reusable UI components
docs/
  testing-philosophy.md   # full testing strategy — read before writing tests
specs/                # spec documents (created before implementation)
  lambda/
  component/
```

## Spec-Driven Development Workflow

**Every feature starts with a spec.** No implementation code before a spec is written and confirmed.

Use the custom commands:
- `/new-lambda <feature-name>` — spec then implement a Lambda vertical slice
- `/new-component <component-name>` — spec then implement an Angular vertical slice
- `/spec-review <path>` — audit an existing implementation against its spec

The spec lives in `specs/lambda/<name>.spec.md` or `specs/component/<name>.spec.md`.

## Library Rules

Before using any library, look up its current LTS version. This is a greenfield project — always pin to LTS, never install outdated versions.

## Backend (Lambda / Node.js) Rules

### Project structure per feature
Each Lambda feature is a vertical slice:
```
backend/src/functions/<role>/<feature>/
  handler.ts   ← pure function, inject all deps
  service.ts   ← business logic, throws ValidationError
  db.ts        ← DynamoDB commands only, no business logic
```

### Handler isolation
- Handlers must be pure functions — inject `DynamoDBDocumentClient` (or Cognito client) via parameter, never import `docClient` directly inside handler logic
- All dependencies are mockable with `vi.mock()`

### Event shape contracts
- One test per API Gateway route shape the handler handles (GET, POST, PUT, DELETE, authorizer)
- Use a `buildApiGwEvent(overrides)` factory — never hardcode raw event JSON

### DynamoDB mocking
- Mock at the `@aws-sdk/lib-dynamodb` client level using `aws-sdk-client-mock`
- Assert on exact command types (`PutCommand`, `QueryCommand`, etc.) and their inputs — not just return values

### Error path coverage (required per handler)
Every handler test suite must include: happy path, invalid input (400), unauthorized (403), not found (404), DynamoDB/Cognito failure (500).

### Models
- Interfaces live in `backend/src/functions/shared/models/<role>/<feature>.model.ts`
- DynamoDB key fields (`PK`, `SK`, `GSI1PK`, `GSI1SK`) are included on the stored interface but stripped before returning to callers via `stripKeys()`
- Single-table key conventions: `PK = <TYPE>#<id>`, `SK = METADATA` (or sub-entity discriminator), `GSI1PK = <TYPE>`, `GSI1SK = <created_at ISO>`

### Target coverage
≥80% branch coverage per handler.

## Frontend (Angular) Rules

### Components
- All components are **standalone** — no NgModule
- Use **Signals** for reactivity (`signal()`, `computed()`, `effect()`)
- Use `@defer` for lazy loading routes and heavy components
- Strict TypeScript throughout
- Use `trackBy` in all `@for` loops
- Bootstrap 5 for responsive layout (Mobile → Tablet → Laptop → PC)

### Models
- Frontend models mirror backend response shapes
- Live in `frontend/src/app/core/models/`
- Interfaces only — no business logic, may include parsing helpers and defaults

### Testing
- Use **Angular Testing Library** over raw `TestBed`
- Query by role/label/text — not by component refs or CSS classes
- Mock all services in `TestBed` with Jest/Vitest mocks
- Use `provideHttpClientTesting` with `HttpTestingController` for HTTP layers
- Auth guards must be tested for **all 4 roles** — assert correct redirect or activation per role
- HTTP interceptors get their own test suite
- **No Karma** — use Vitest

### Test runner
- Backend: `vitest` with `unit` and `integration` projects (see `backend/vitest.config.ts`)
- Frontend: Vitest

## Testing Layers (summary — full detail in `docs/testing-philosophy.md`)

| Layer | What it covers | Infra needed |
|---|---|---|
| Unit | Pure logic, validation, transformations | None |
| Integration | Handler → DynamoDB → response | LocalStack / SAM local |
| E2E | Full user flows via Playwright | Deployed env (dev/qa/prod) |

## CI/CD Gate Order

`lint + unit` → `integration` → `deploy dev` → `E2E dev` → `manual gate` → `QA` → `prod`

Target: PR feedback under 8 minutes.

## DynamoDB Conventions

- Single table: env var `TABLE_NAME`
- GSI: `GSI1` (env var `GSI1_INDEX`)
- All DynamoDB access goes through `db.ts` in the feature folder
- Strip `PK/SK/GSI1PK/GSI1SK` before returning to API consumers (use `stripKeys()`)
