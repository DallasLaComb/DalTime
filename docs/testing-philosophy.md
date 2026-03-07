# Testing Philosophy

This project follows a pragmatic testing strategy designed for long-term maintainability while keeping development velocity high.

## Goals

- Prevent regressions
- Enable safe refactoring
- Verify real system behavior
- Document expected system behavior

Tests should give confidence, not create friction.

We follow a layered testing approach:

**Unit Tests → Integration Tests → E2E Tests**

Each layer verifies different concerns.

## Core Principles

- Tests must support refactoring
- Tests should verify behavior, not implementation details
- Prefer real integration over heavy mocking
- Tests must be fast and deterministic
- Every feature must include tests that validate:
  - Business logic
  - Data model correctness
  - API behavior
  - Critical user flows

---

## Testing Layers

### Unit Tests

Unit tests verify isolated logic without infrastructure.

They should:
- Run in milliseconds
- Require no network
- Require no AWS services

**Backend:**
- Service functions
- Validation logic
- Permissions logic
- Data transformers

**Frontend:**
- Angular services
- State logic
- Utility helpers
- Frontend models

**Unit tests should NOT:**
- Call APIs
- Access DynamoDB
- Call AWS services

### Integration Tests

Integration tests verify that components interact correctly.

**May involve:**
- Lambda handlers
- API endpoints
- DynamoDB persistence
- Authentication layers

**Should validate:**
- Request/response behavior
- Correct database writes
- Correct database reads
- Data model integrity
- Error handling

**Run against:**
- **Local:** SAM local environment
- **Deployed:** Development environment

Integration tests should prefer real infrastructure over mocks.

### E2E Tests

End-to-end tests verify real user workflows. They simulate actual user behavior in the system.

E2E tests run against deployed environments only.

**Examples:**
- User signup
- Login via Cognito
- Creating resources
- Editing resources
- Deleting resources

**E2E tests validate:**
- Frontend behavior
- Backend APIs
- Authentication
- Persistence

E2E tests should focus on critical user flows, not edge cases.

---

## Testing Requirements for Each Feature

Each new feature should include the following tests.

### Backend Requirements

#### 1. Unit Tests

Required when business logic exists.

Examples:
- Validation
- Calculations
- State transitions
- Permission rules

#### 2. Model Integration Tests (Required)

All DynamoDB access must occur through models. Each model must include integration tests to verify:
- Correct DynamoDB structure
- Correct attribute names
- Correct partition keys
- Correct sort keys
- Correct indexes
- Correct serialization/deserialization

Model tests must verify:
- Create
- Read
- Update
- Delete
- Query operations (if applicable)

**Example — UserModel integration test:**
- Create user
- Retrieve user
- Update user
- Delete user
- Query user by index

These tests protect against accidental schema drift.

#### 3. API Integration Tests

Each API endpoint must include integration tests verifying:
- Valid request
- Invalid request
- Expected response codes
- Persistence effects

**Example — `POST /users`:**
- Valid request creates record
- Invalid request fails
- Returned payload is correct

### Frontend Testing Rules

Frontend tests focus on logic and data behavior, not UI implementation.

**Unit tests should verify:**
- Angular services
- API client behavior
- State management
- Validation logic
- Frontend model behavior

Component tests should remain minimal. UI behavior is primarily validated through E2E tests.

#### Frontend Model Layer

Frontend models represent the data contract between the backend API and the Angular application.

**Location:** `frontend/src/app/core/models`

Frontend models define the structure of data used throughout the UI.

**Responsibilities:**
- Represent API data structures
- Normalize API responses
- Enforce consistent typing
- Provide safe parsing of backend data

Frontend models should not contain business logic. They may include:
- Simple helpers
- Parsing logic
- Default values

**Example:** `frontend/src/app/core/models/user.model.ts`

#### Frontend Model Tests

Frontend models must include unit tests verifying:
- Correct parsing of API responses
- Proper handling of optional fields
- Backwards compatibility with older responses
- Correct default values

**Example tests:**
- Deserialize API response into model
- Handle missing optional fields
- Reject invalid structures

These tests ensure the frontend always correctly understands backend responses.

---

## Model Layer Philosophy

Models exist in both backend and frontend layers.

**Backend models define:**
- How data is stored in DynamoDB
- How queries are executed

**Frontend models define:**
- How API responses are interpreted
- How UI code consumes data

Together they form the application data contract.

**When API structures change:**
1. Backend model changes
2. Backend model tests update
3. API integration tests update
4. Frontend model updates
5. Frontend model tests update

---

## DynamoDB Model Rule

All DynamoDB access must go through model classes. Direct DynamoDB access in business logic is not allowed.

**Example structure:**

```
backend/src/models/
  UserModel.js
  ProjectModel.js
```

- Services depend on models
- Models encapsulate DynamoDB structure
- Each model must have integration tests that verify its interaction with DynamoDB

This ensures the data structure is always understood and validated.

---

## DynamoDB Model Contracts and Query Contracts

Because this project uses DynamoDB, data structure is defined by access patterns rather than schemas.

To prevent accidental data structure drift, all models must enforce **Model Contracts** and **Query Contracts** through integration tests.

### Model Contracts

A Model Contract defines the structure and behavior of an entity stored in DynamoDB.

Each model must have integration tests that verify:
- Required attributes
- Partition key format
- Sort key format
- Index attributes
- Serialization
- Deserialization

**Example stored item:**

```
PK: USER#123
SK: PROFILE
email: test@example.com
createdAt: 2024-01-01T00:00:00Z
```

**Model Contract tests should verify:**
- Correct PK format
- Correct SK format
- Required attributes exist
- Optional attributes behave correctly
- Timestamps and metadata are set correctly

**These tests protect against:**
- Accidental key format changes
- Attribute naming drift
- Incomplete writes
- Serialization bugs

### Query Contracts

A Query Contract defines the expected behavior of a DynamoDB query.

Each query method in a model must have tests verifying:
- Correct items are returned
- Incorrect items are not returned
- Pagination behaves correctly (if applicable)
- Indexes function correctly

**Example query:** `UserModel.getUserByEmail(email)`

**Query contract test:**
1. Create test user
2. Query by email
3. Verify correct user returned
4. Verify only one record returned

### Access Pattern Testing

Each DynamoDB access pattern must be documented and tested.

**Examples:**
- Get user by ID
- Get users by organization
- List projects for user
- List activity for project

**Tests should validate:**
- Correct results
- Correct ordering
- Filtering behavior
- Index behavior

### Index Contract Testing

When a model depends on a Global Secondary Index (GSI), tests must verify that the index works as expected.

**Tests should verify:**
- Items appear in the index
- Queries return expected results
- Incorrect items are not returned

**Example:** Query users by `organizationId` using GSI1.

**Test steps:**
1. Create users across multiple organizations
2. Query using GSI1
3. Verify only users from the expected organization are returned

### Pagination Contracts

If a query supports pagination, tests must verify:
- First page returns expected results
- Next page token works correctly
- Results remain consistent across pages

Pagination bugs are common in DynamoDB systems and must be tested explicitly.

### Data Evolution Rules

DynamoDB allows flexible schemas. However, models must enforce backwards compatibility where possible.

Model Contract tests should verify that:
- Older records can still be parsed
- Missing optional fields do not break deserialization

---

## Test Naming Guidelines

**Model Contract tests:** `UserModel.contract.test.js`

**Query Contract tests:** `UserModel.query.test.js`

**Example structure:**

```
tests/
  integration/
    models/
      UserModel.contract.test.js
      UserModel.query.test.js
```

---

## Test Data Rules

Test data must:
- Use unique identifiers
- Avoid collisions
- Clean up after execution when possible

When cleanup is not possible, DynamoDB TTL fields should be used.

---

## When Tests Should Be Written

Tests should be written:
- Immediately after implementing a feature
- Before merging changes
- Before refactoring complex logic

Tests should evolve with the code.

---

## Test Coverage Philosophy

Coverage metrics are helpful but not the goal.

Instead we aim for:
- Strong coverage of business logic
- Strong coverage of data models
- Strong coverage of API behavior
- Minimal but meaningful E2E coverage

Quality of tests matters more than quantity.

---

## Summary

For every new feature:

**Backend:**
- Unit tests for logic
- Model integration tests for DynamoDB
- API integration tests for endpoints

**Frontend:**
- Unit tests for services
- Unit tests for frontend models

**System:**
- E2E tests for critical workflows

This layered strategy ensures the system remains reliable, maintainable, and easy to refactor over time.
