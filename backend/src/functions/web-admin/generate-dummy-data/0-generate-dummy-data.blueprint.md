# Blueprint: Generate Dummy Data

## Purpose

This Lambda provides a Web-Admin-only endpoint to seed realistic test data into
the system for a chosen year and month. It is intended for dev and QA environments
where testers and developers need a populated DalTime account without running
manual seed scripts.

## Endpoint

`POST /web-admin/generate-dummy-data`

Request body: `{ "year": number, "month": number }` (month is 1-indexed)

Response: `{ "message": string }` describing what was generated

## Valid date range

The `year`/`month` in the request must fall within a dynamic window relative to
the server-side clock at the time of the request:

- **Minimum (inclusive):** the current calendar month/year (e.g. if today is
  2026-06-20, June 2026 is allowed; May 2026 is not).
- **Maximum (inclusive):** the current month/year plus 24 calendar months (e.g.
  June 2028 is allowed; July 2028 is not).

Requests outside this window return HTTP 400:

- Past: `{ "error": "month/year must not be in the past" }`
- Future beyond 24 months: `{ "error": "month/year must be within 24 months from now" }`

The `month` field must still be a valid calendar month (1–12). Requests with an
invalid month (0, 13, floats, etc.) are rejected before the window check.

## Auth guard

The handler calls `requireWebAdminWithLookup`, which enforces two layers of
authorization: (1) the caller must be in the `WebAdmin` Cognito group, and (2)
their DynamoDB record must exist and be `ACTIVE`. Any other caller receives a 403.

## Employee discovery

The service queries DynamoDB — it does not use the scripts folder or any
hardcoded user list. For each org it queries:

- Employees: `PK = ORG#<orgId>, SK begins_with EMPLOYEE#` (same access pattern
  as `listEmployeesByOrg` in `org-admin/employees/db.ts`)
- Managers: `PK = ORG#<orgId>, SK begins_with MANAGER#`
- Locations: `PK = ORG#<orgId>, SK begins_with LOCATION#` (via `listOrgLocations`)

Orgs with no employees or no managers are silently skipped.

## Availability generation

One `EmployeeAvailability` item is written per qualifying employee using
`PutItem` semantics (via BatchWriteItem), overwriting any prior record for
that employee. The item holds a `WeeklySchedule` (keyed by day-of-week) where
each day independently has a ~70% chance of being available. If available, the
day gets a single time slot drawn from one of the SHIFT_PRESETS and max_shifts
= 1.

## Zero-availability rule

The first employee alphabetically by email (ascending sort) always gets no
availability record written. Their existing record, if any, is left untouched
— the rule means "do not generate availability for this employee in this run,"
not "delete their record." This simulates the real-world case of an employee
who has not submitted any availability, which the scheduling algorithm must
handle gracefully.

## Open shift generation

For each org with at least one location and one manager, the service generates
5–15 open shift records (random count per org) spread randomly across days in
the requested month. Each shift picks a location and a shift preset (morning
08:00–16:00, afternoon 12:00–20:00, or night 22:00–06:00, etc.) at random.

Open shifts have `employee_id: ''` and `employee_name: ''`. The `GSI1PK` is
set to `MANAGER#<managerId>` using a real manager from the org (never a blank
or sentinel value) so the manager's schedule query can find these items.
Status is always `published`.

## No swap requests

Swap request generation is explicitly out of scope for this feature. This
Lambda only writes `EmployeeAvailability` and `Shift` records.

## Bulk write

All writes use `BatchWriteItem` in chunks of 25 (the DynamoDB maximum per
call). `UnprocessedItems` are retried up to 5 times with exponential backoff
starting at 100 ms. If items remain unprocessed after all retries, an error is
thrown so the failure is visible rather than silently lost.

## Future EventBridge hook

The handler contains a `// TODO: wire to EventBridge scheduled rule on 1st of month`
comment. Automating monthly data generation in dev/qa via an EventBridge scheduled
rule is explicitly deferred to a future story — the endpoint works as a manual
trigger for now.
