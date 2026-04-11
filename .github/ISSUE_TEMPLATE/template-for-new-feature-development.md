---
name: New Feature Development
about: Template for planning and tracking a new feature
title: "[FEATURE] "
labels: ["feature"]
---

## Data Model & Access Patterns

**Entity affected:**

**Access patterns:**
| Pattern | Model Method | PK | SK | Index |
|---|---|---|---|---|
| | | | | |

**Model changes:**
- [ ] New model
- [ ] Update existing model: ___
- [ ] No model changes

---

## API Contract

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| | | | | |

---

## Failure Modes

-
-

---

## Blueprints

Every feature must have a blueprint created **before** implementation begins.

- [ ] Backend blueprint created: `backend/src/functions/<role>/<feature>/0-<feature>.blueprint.md`
- [ ] Frontend blueprint created: `frontend/src/app/features/<role>/<feature>/0-<feature>.blueprint.md`
- [ ] N/A — this feature does not add a backend/frontend component

---

## Testing Plan

### Backend (Vitest)

**Unit Tests** (`backend/test/unit/<role>/<feature>/`)
-
-

**Model Integration Tests** (`backend/test/integration/`)
- [ ] Create
- [ ] Read
- [ ] Update
- [ ] Delete
- [ ] Query / access pattern tests
- [ ] Index tests
- [ ] Pagination tests

**API Integration Tests**
- [ ] Valid request — correct response and persistence
- [ ] Invalid request — correct error and no side effects
- [ ] Auth and permissions verified

---

### Frontend (Vitest)

**Frontend Model** (`frontend/src/app/core/models/`)

- [ ] Model created / updated: ___
  - [ ] Parses API response correctly
  - [ ] Optional fields handled
  - [ ] Default values set

**Unit Tests** (co-located with component/service)
- [ ] Test imports `APP_TEST_PROVIDERS` from `src/test-setup.ts` for mock auth/router
-
-

**Frontend Logic Tests**
- [ ] Service logic tested
- [ ] State updates verified
- [ ] Validation logic tested

---

### E2E Tests (Robot Framework — `robot/tests/<role>/`)

E2E tests must simulate real user experiences. Tests run against deployed environments only.

- [ ] Required — workflow:
  - [ ] Login
  - [ ] Create flow
  - [ ] Edit flow
  - [ ] Delete flow
  - [ ] Other: ___

**Viewport testing** — each E2E test must pass at all three breakpoints:
- [ ] Desktop (1920×1080)
- [ ] Tablet (768×1024)
- [ ] Mobile (375×812)

**Visibility assertions** — use viewport-aware checks (e.g. `Wait Until Element Is Visible` or bounding-box assertions) instead of relying solely on `data-testid` presence. An element loaded in the DOM but scrolled off-screen or hidden by overflow is **not** visible to a real user. Tests must confirm elements are within the visible viewport before interacting with them.

---

## Test Data

- [ ] Unique identifiers used
- [ ] Cleanup handled after tests
- [ ] DynamoDB TTL used if cleanup not possible

---

## Conditional Checklists

Complete only the sections that apply to this feature.

### If you added a backend feature:
- [ ] Blueprint exists at `backend/src/functions/<role>/<feature>/0-<feature>.blueprint.md`
- [ ] Handler delegates to service; no business logic in handler
- [ ] Service delegates to db; no DynamoDB access in service
- [ ] `docClient` is injected, not imported directly in handler
- [ ] No `any` types
- [ ] All ESM imports use `.js` extension
- [ ] `TABLE_NAME` read from `process.env`, not hardcoded
- [ ] Unit tests exist (`backend/test/unit/<role>/<feature>/`)
- [ ] Integration tests exist (`backend/test/integration/`)
- [ ] SAM `template.yaml` updated with new Lambda/API resources

### If you added a frontend feature:
- [ ] Blueprint exists at `frontend/src/app/features/<role>/<feature>/0-<feature>.blueprint.md`
- [ ] Component is standalone
- [ ] State uses Signals (not `BehaviorSubject`)
- [ ] No `any` types
- [ ] All interactive elements have `data-testid` attributes
- [ ] Tests query by role/label/testid, not CSS class
- [ ] Mobile responsive (tested at 375px width)
- [ ] Tablet responsive (tested at 768px width)
- [ ] Desktop layout verified (tested at 1920px width)
- [ ] Unit tests exist (co-located `.spec.ts` files)

### If you added or modified a model (backend or frontend):
- [ ] Model is abstract enough for reuse across features but strict enough to prevent misuse (typed fields, no loose `Record<string, any>` or `any` escape hatches)
- [ ] Backend model: `backend/src/functions/shared/models/<role>/<feature>.model.ts`
- [ ] Frontend model: `frontend/src/app/core/models/<feature>.model.ts`
- [ ] Backend model integration tests verify PK/SK format, required attributes, serialization/deserialization
- [ ] Frontend model unit tests verify API response parsing, optional field handling, default values
- [ ] `docs/dynamodb-entity-map.md` updated with new/changed record types, key formats, GSI usage, and deletion cascade steps

---

## Pre-Merge Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass at all viewport sizes (desktop, tablet, mobile)
- [ ] No direct DynamoDB calls outside models
- [ ] No business logic inside Lambda handlers
- [ ] API changes documented
- [ ] Model and access pattern changes documented
- [ ] `docs/dynamodb-entity-map.md` updated (if model changes were made)
- [ ] Feature manually tested
- [ ] Responsive design verified (mobile, tablet, desktop)
- [ ] All lines of code are understood
