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

## Testing Plan

### Backend

**Unit Tests**
- [ ] Not required
- [ ] Required — cases:
  - 

**Model Integration Tests**
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

### Frontend

**Frontend Model**

Location: `frontend/src/app/core/models/`

- [ ] Not required
- [ ] Model created / updated: ___
  - [ ] Parses API response correctly
  - [ ] Optional fields handled
  - [ ] Default values set

**Frontend Logic Tests**
- [ ] Service logic tested
- [ ] State updates verified
- [ ] Validation logic tested

---

### E2E Tests

- [ ] Not required
- [ ] Required — workflow:
  - [ ] Signup / login
  - [ ] Create flow
  - [ ] Edit flow
  - [ ] Delete flow
  - [ ] Other: ___

---

## Test Data

- [ ] Unique identifiers used
- [ ] Cleanup handled after tests
- [ ] DynamoDB TTL used if cleanup not possible

---

## Pre-Merge Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] No direct DynamoDB calls outside models
- [ ] No business logic inside Lambda handlers
- [ ] API changes documented
- [ ] Model and access pattern changes documented
- [ ] Feature manually tested
- [ ] All lines of code are understood

