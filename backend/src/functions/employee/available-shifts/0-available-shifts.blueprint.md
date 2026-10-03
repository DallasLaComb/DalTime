# Employee Available Shifts — Blueprint

## What this feature does

This Lambda handles `GET /employee/available-shifts` for the Employee role. It returns published shifts from OTHER employees in the calling employee's org that have been marked `available_for_pickup = true` for a given date. This supports a "shift swap / pickup" workflow where an employee can offer their shift and other employees can see it.

## Route

```
GET /employee/available-shifts?date=YYYY-MM-DD
OPTIONS /employee/available-shifts
```

## Query parameters

| Param | Format     | Required | Description                                   |
| ----- | ---------- | -------- | --------------------------------------------- |
| date  | YYYY-MM-DD | Yes      | The calendar day to look for available shifts |

## Authentication and authorization

- JWT authorizer on API Gateway validates the token signature.
- Handler checks the caller is in the `Employee` Cognito group (returns 403 if not).
- The caller's org_id and employee_id are resolved from `USER#<sub>/METADATA` in DynamoDB (returns 403 if record is missing).
- The query explicitly excludes the caller's own `employee_id` — an employee cannot pick up their own shift.

## DynamoDB access pattern

```
PK = ORG#<orgId>
SK begins_with SHIFT#
FilterExpression:
  #date = :date
  AND available_for_pickup = :true
  AND employee_id <> :callerId
  AND (#status = :published OR attribute_not_exists(#status))
```

No GSI required. The base key condition narrows to one org's shifts, and the FilterExpression handles the remaining predicates.

## Response

HTTP 200 with a JSON array of Shift objects (same interface as the shifts endpoint, with `available_for_pickup: true` included). `PK`, `SK`, `GSI1PK`, and `GSI1SK` are stripped before returning. Results are sorted by `start_time` ascending.

Returns `200 []` when no available shifts exist on that date (never 404).

## Error responses

| Status | Reason                                                                                     |
| ------ | ------------------------------------------------------------------------------------------ |
| 400    | `date` param missing or not in YYYY-MM-DD format, or the date is not a valid calendar date |
| 403    | Caller is not in the Employee group, or not provisioned in DynamoDB                        |
| 500    | Unexpected DynamoDB or service error                                                       |

## Files

```
backend/src/functions/employee/available-shifts/
  handler.ts   — Route dispatch and role guard
  service.ts   — Date validation, caller resolution, sort, and stripKeys
  db.ts        — DynamoDB QueryCommand with available_for_pickup filter
backend/test/unit/employee/available-shifts/
  handler.test.ts
  service.test.ts
```
