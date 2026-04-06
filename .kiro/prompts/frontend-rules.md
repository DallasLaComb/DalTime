# DalTime — Frontend Rules (Angular)

## Components
- All components are **standalone** — no NgModule
- Use **Signals** for reactivity (`signal()`, `computed()`, `effect()`)
- Use `@defer` for lazy loading routes and heavy components
- Strict TypeScript throughout — never use `any`
- Use `trackBy` in all `@for` loops
- Bootstrap 5 for responsive layout (Mobile → Tablet → Laptop → PC)
- All components use `ChangeDetectionStrategy.OnPush`
- Never use `ngModel` — use reactive forms or signal-based forms
- `data-testid` attribute on every button, input, table row, and status message

## Models
- Frontend models mirror backend response shapes
- Live in `frontend/src/app/core/models/`
- Interfaces only — no business logic, may include parsing helpers and defaults

## Testing
- Use **Angular Testing Library** (`@testing-library/angular`) over raw `TestBed`
- Query by role/label/text/`data-testid` — not by component refs or CSS classes
- Mock all services in `TestBed` with Vitest mocks
- Use `provideHttpClientTesting` with `HttpTestingController` for HTTP layers
- Auth guards must be tested for **all 4 roles** — assert correct redirect or activation per role
- HTTP interceptors get their own test suite
- **No Karma** — use Vitest
- This project is **zoneless** — never use `fakeAsync`/`tick`. Use `async/await` + `await fixture.whenStable()` for async test assertions

## Testing Layers (full detail in `docs/testing-philosophy.md`)

| Layer | What it covers | Infra needed |
|---|---|---|
| Unit | Pure logic, validation, transformations | None |
| Integration | Handler → DynamoDB → response | LocalStack / SAM local |
| E2E | Full user flows via Playwright | Deployed env (dev/qa/prod) |

## CI/CD Gate Order

`lint + unit` → `integration` → `deploy dev` → `E2E dev` → `manual gate` → `QA` → `prod`

Target: PR feedback under 8 minutes.
