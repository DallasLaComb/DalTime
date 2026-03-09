## Data Model & Access Patterns

**Entity affected:** Availability

**Access patterns:**
| Pattern | Model Method | PK | SK | Index |
|---|---|---|---|---|
| Get availability by employee | `getByEmployee(employeeId)` | `EMP#<employeeId>` | `AVAIL#<date>` | — |
| Get availability by date range | `getByDateRange(employeeId, start, end)` | `EMP#<employeeId>` | `AVAIL#<startDate>` to `AVAIL#<endDate>` | — |
| Get all availability for a date | `getByDate(date)` | `DATE#<date>` | `EMP#<employeeId>` | GSI1 |

**Model changes:**
- [x] New model
- [ ] Update existing model: ___
- [ ] No model changes

---

## API Contract

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| POST | `/availability` | `{ employeeId, date, startTime, endTime }` | `201 { availability }` | Creates a new availability entry |
| GET | `/availability?employeeId=&start=&end=` | — | `200 { availabilities: [] }` | Returns availability for an employee within a date range |
| GET | `/availability?date=` | — | `200 { availabilities: [] }` | Returns all employee availability for a given date |
| PUT | `/availability/{availabilityId}` | `{ startTime, endTime }` | `200 { availability }` | Updates an existing availability entry |
| DELETE | `/availability/{availabilityId}` | — | `204` | Removes an availability entry |

---

## Failure Modes

- Employee submits availability for a date in the past — reject with 400
- Overlapping availability entries for the same employee on the same date — reject with 409
- Employee tries to update/delete another employee's availability — reject with 403

---

## Testing Plan

### Backend

**Unit Tests**
- Validate that overlapping time ranges are correctly detected
- Validate that past dates are rejected
- Validate start time is before end time

**Model Integration Tests**
- [x] Create
- [x] Read
- [x] Update
- [x] Delete
- [x] Query / access pattern tests
- [x] Index tests
- [ ] Pagination tests

**API Integration Tests**
- [x] Valid request — correct response and persistence
- [x] Invalid request — correct error and no side effects
- [x] Auth and permissions verified

---

### Frontend

**Frontend Model**

Location: `frontend/src/app/core/models/`

- [x] Model created / updated: Availability
  - [x] Parses API response correctly
  - [x] Optional fields handled
  - [x] Default values set

**Unit Tests**
- Availability model correctly parses date and time strings from API response
- Date range selection helper returns correct start/end values

**Frontend Logic Tests**
- [x] Service logic tested
- [x] State updates verified
- [x] Validation logic tested

---

### E2E Tests

- [x] Required — workflow:
  - [ ] Signup / login
  - [x] Create flow
  - [x] Edit flow
  - [x] Delete flow
  - [ ] Other: ___

---

## Test Data

- [x] Unique identifiers used
- [x] Cleanup handled after tests
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
- [ ] Responsive design verified (mobile, tablet, and desktop)
- [ ] All lines of code are understood
