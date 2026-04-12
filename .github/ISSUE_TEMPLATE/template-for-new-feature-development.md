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

Outline what needs to be tested. Detailed checklists live in the PR template.

### Backend
- Unit tests (`backend/test/unit/<role>/<feature>/`):
- Integration tests (`backend/test/integration/`):

### Frontend
- Unit tests (co-located `.spec.ts`):
- Logic/service tests:

### E2E (Robot Framework — `robot/tests/<role>/`)
- Workflows to cover:
