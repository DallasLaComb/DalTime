# Employee Shifts — Blueprint

## What this feature does

This Lambda handles `GET /employee/shifts` for the Employee role. It returns a list of shifts assigned to the calling employee, scoped to a time window they specify with a query parameter.

## Route

```
GET /employee/shifts?month=YYYY-MM
GET /employee/shifts?date=YYYY-MM-DD
GET /employee/shifts?week=YYYY-MM-DD
OPTIONS /employee/shifts
```

## Query parameters

Exactly one of the three time-window params must be provided. Providing none or more than one returns 400.

| Param | Format     | Description                                                           |
| ----- | ---------- | --------------------------------------------------------------------- |
| month | YYYY-MM    | All shifts in the given calendar month                                |
| date  | YYYY-MM-DD | Shifts on a single specific day                                       |
| week  | YYYY-MM-DD | Shifts over a 7-day window starting on (and including) the given date |

The `week` param value is the week-start date (typically Monday). The endpoint computes the week-end as `weekStart + 6 days` inclusive.

## Authentication and authorization

- JWT authorizer on API Gateway validates the token signature.
- Handler checks the caller is in the `Employee` Cognito group (returns 403 if not).
- The caller's org and employee_id are resolved from `USER#<sub>/METADATA` in DynamoDB (returns 403 if record is missing).

## DynamoDB access pattern

All three variants query:

```
PK = ORG#<orgId>
SK begins_with SHIFT#
```

With a FilterExpression that constrains `employee_id = :employeeId`, a date condition, and `(#status = :published OR attribute_not_exists(#status))`.

Date conditions by param:

- `?month`: `begins_with(#date, :month)`
- `?date`: `#date = :date`
- `?week`: `#date >= :weekStart AND #date <= :weekEnd` (YYYY-MM-DD lexicographic order == chronological order)

No GSI required for any of the three patterns.

## Response

HTTP 200 with a JSON array of Shift objects. `PK`, `SK`, `GSI1PK`, and `GSI1SK` are stripped before returning. Results are sorted by `date` ascending, then `start_time` ascending.

Returns `200 []` when no shifts match (never 404).

## Error responses

| Status | Reason                                                                 |
| ------ | ---------------------------------------------------------------------- |
| 400    | No time-window param provided, multiple provided, or format is invalid |
| 403    | Caller is not in the Employee group, or not provisioned in DynamoDB    |
| 500    | Unexpected DynamoDB or service error                                   |

## Files

```
backend/src/functions/employee/shifts/
  handler.ts   — Route dispatch and role guard
  service.ts   — Param parsing, validation, sort, and stripKeys
  db.ts        — DynamoDB QueryCommand for each time-window variant
backend/test/unit/employee/shifts/
  handler.test.ts
  service.test.ts
```
