# DynamoDB Best Practices

Rules for every read and write against the DalTime table. The goal is that **every screen is served by
a query whose cost is proportional to what the screen shows** — never to how much data the org has
accumulated over time.

Companion docs:

- [`dynamodb-entity-map.md`](./dynamodb-entity-map.md) — every record type, its keys, and cascade rules
- [`logging.md`](./logging.md) — what to log from `db.ts` / `service.ts`

---

## 1. How we are billed

The table is `PAY_PER_REQUEST` (on-demand) with PITR enabled (`infra/template.yaml`, `DynamoTable`).

| Unit | What it costs you |
| --- | --- |
| Read request unit (RRU) | One strongly consistent read of up to 4 KB, or **two eventually consistent reads** of up to 4 KB. |
| Write request unit (WRU) | One write of up to 1 KB. |
| GSI write | Every write that touches a projected attribute on an item with GSI keys is **billed again on the index**. |
| Storage | Per GB-month, base table **plus** every GSI copy (GSI1 is `ProjectionType: ALL`, so it is a full copy). |
| TTL deletes | Free. |

Things that follow from this:

- **You pay for what DynamoDB reads, not what it returns.** A `FilterExpression` runs *after* the read, so
  it saves bandwidth but not money.
- A `Query` reads at most **1 MB per call** (~128 RRU eventually consistent). Anything past that is only
  returned if you follow `LastEvaluatedKey`.
- Batching (`BatchWriteItem`, `Promise.all` of `UpdateItem`) does **not** reduce cost — each item is billed
  individually. Batch for latency, not for money.
- The HTTP API is throttled (`ThrottlingRateLimit: 10`, `ThrottlingBurstLimit: 10`), which caps how fast a
  runaway client can spend money. Do not raise it without re-reading this doc.

---

## 2. Hard rules

These are review blockers. A PR that violates one needs a written justification in its blueprint.

### R1 — No `Scan`, no PartiQL

`ScanCommand`, `ExecuteStatementCommand`, and `BatchExecuteStatementCommand` are banned in `backend/src`.
A Scan reads every item in the table (every org, every entity type). If a screen needs data you cannot
reach with a `GetItem` or `Query`, the key design is missing an access pattern — add a GSI or change the
sort key, don't Scan.

One-off admin/migration scripts under `backend/scripts/` may Scan, but must be run manually, never from a
Lambda.

### R2 — Every access pattern is designed before the code is written

Each blueprint's data section lists, per screen: the exact `PK` / `SK` (or `GSI1PK` / `GSI1SK`) key
condition, and the expected item count. If the count grows with time ("all shifts ever") rather than with
what the screen shows ("this week's shifts"), the design is wrong.

### R3 — Put what you filter on into the key

If a query needs to narrow by date, owner, or status, that value belongs in the sort key (or a GSI key),
not in a `FilterExpression`.

```ts
// ❌ Reads every shift the org has ever had, returns one week
KeyConditionExpression: 'PK = :pk AND begins_with(SK, :shift)',          // SK = SHIFT#<uuid>
FilterExpression: 'employee_id = :emp AND #date BETWEEN :start AND :end',

// ✅ Reads exactly one week of one employee's shifts
IndexName: 'GSI2',
KeyConditionExpression: 'GSI2PK = :emp AND GSI2SK BETWEEN :start AND :end', // GSI2PK = EMP#<id>, GSI2SK = <date>#<shift_id>
```

Date-bearing sort keys use ISO strings (`YYYY-MM-DD` / full ISO timestamps) so lexicographic order equals
chronological order and `begins_with` / `BETWEEN` work.

### R4 — `FilterExpression` only over a bounded result

A filter is acceptable only when the key condition already limits the read to a small, **non-growing** set
— e.g. one manager's shifts for one month, or the currently open swaps. Document the bound in a comment
next to the filter:

```ts
// Bounded: one manager × one month (≈ tens of items). Filter trims drafts only.
FilterExpression: '#status = :draft',
```

If you can't write that comment honestly, apply R3.

### R5 — Never combine `Limit` with `FilterExpression` to mean "first N matches"

`Limit` caps items **read**, before the filter. `Limit: 1` + a filter checks one item and may return
nothing even when matches exist. For existence checks, use a key you can `GetItem`, or put the filtered
attribute into the key.

### R6 — Every `Query` that can exceed 1 MB paginates

Reading `result.Items` once silently truncates at 1 MB — the screen shows partial data with no error. Either:

- the key condition is provably small (document it, as in R4), or
- loop on `LastEvaluatedKey`:

```ts
const items: T[] = [];
let ExclusiveStartKey: Record<string, unknown> | undefined;
do {
  const page = await docClient.send(new QueryCommand({ ...params, ExclusiveStartKey }));
  items.push(...((page.Items ?? []) as T[]));
  ExclusiveStartKey = page.LastEvaluatedKey;
} while (ExclusiveStartKey);
```

For lists a user scrolls through (history, audit), prefer returning one page plus an opaque `nextToken`
to the client over looping server-side.

### R7 — Anything temporary gets a TTL

Sessions, audit trails with a retention window, notifications, and other data with a natural expiry carry
a numeric `ttl` attribute (Unix epoch **seconds**) and the table must have `TimeToLiveSpecification`
enabled on that attribute. TTL deletes are free; manual cleanup deletes are billed. Items may linger up to
~48 h after expiry, so reads must still ignore expired items where correctness matters.

### R8 — No global single-value partition keys for growing data

A key like `GSI1PK = 'EMPLOYEE'` puts every employee in every org under one partition. It grows without
bound and concentrates all writes on one index partition. Scope partition keys to a tenant or owner
(`ORG#<id>`, `MANAGER#<id>`, `USER#<sub>`). Cross-tenant listing (web-admin) must paginate (R6).

### R9 — Eventually consistent reads by default

Do not set `ConsistentRead: true` unless a read-after-write race is a real bug (e.g. reading a record
immediately after a conditional write in the same request). It doubles read cost and is not supported on
GSIs.

### R10 — Keep items small

Write cost rounds up per 1 KB and read cost per 4 KB. Don't store large blobs, full nested histories, or
duplicated denormalised lists on hot items — put them in their own items (or S3) and reference by id.
Hard item limit is 400 KB.

---

## 3. Recommended practices

- **Use `ConditionExpression` for concurrency**, not read-then-write. See `claimSwapAndTransferShift` in
  `employee/swap-shifts/db.ts` for the pattern.
- **Use `TransactWriteItems`** when two writes must succeed or fail together (e.g. primary record +
  reverse-lookup). Note transactions cost 2× per item — use them only when atomicity matters.
- **Sparse GSIs** for "items in a state" lists: only set the GSI key attributes while the item is in that
  state (e.g. available for pickup), and `REMOVE` them when it leaves. The index then contains only what
  the screen needs.
- **Update GSI keys when the indexed attribute changes.** If a shift changes owner, its employee-keyed GSI
  attributes must be rewritten in the same `UpdateItem`.
- **Prefer `GetItem` / `BatchGetItem`** over `Query` when you know the full key.
- **Use `ProjectionExpression`** when you only need a few attributes of large items (it does not reduce
  RRU, but reduces payload and Lambda memory/time).
- **New GSIs:** consider `KEYS_ONLY` or `INCLUDE` projection if the screen needs only a few attributes.
  GSI1 is `ALL`; changing an existing index's projection requires recreating it.
- **Cache immutable-ish lookups** (e.g. `USER#<sub>/METADATA`) per Lambda invocation rather than fetching
  them twice in one request.

---

## 4. PR / blueprint checklist

Copy into the blueprint's data section and tick each item:

- [ ] No `Scan` / PartiQL (R1)
- [ ] Every screen's access pattern listed with its exact key condition (R2)
- [ ] Every filtered attribute is in a key, or the filter is over a documented bounded set (R3, R4)
- [ ] No `Limit` + `FilterExpression` existence checks (R5)
- [ ] Queries that can exceed 1 MB paginate (R6)
- [ ] Temporary data has a `ttl` and the table has TTL enabled (R7)
- [ ] No new global single-value partition keys for growing data (R8)
- [ ] No `ConsistentRead: true` without a stated race (R9)
- [ ] GSI key attributes are updated whenever the value they index changes
- [ ] [`dynamodb-entity-map.md`](./dynamodb-entity-map.md) updated with any new record type or key

---

## 5. Known violations (audit 2026-09-26)

Existing code that breaks the rules above. Fix these before production traffic grows; remove rows as
they're resolved.

| # | Rule | Location | Problem | Direction |
| --- | --- | --- | --- | --- |
| 1 | R3, R6 | `employee/shifts/db.ts` (`queryShiftsByEmployee`) | Reads every `SHIFT#` in the org, filters by employee + date. Truncates at 1 MB → current shifts go missing as history grows. | GSI keyed `EMP#<id>` / `<date>#<shift_id>`; update on swap claim. |
| 2 | R3, R6 | `employee/available-shifts/db.ts` (`listAvailableShifts`) | Reads every `SHIFT#` in the org, filters by date + pickup flag. | Sparse GSI set only while `available_for_pickup`, keyed `ORG_PICKUP#<org>` / `<date>`. |
| 3 | R3, R6 | `org-admin/shifts/db.ts` (`listShiftsByOrg`) | Reads every `SHIFT#` in the org, filters by month. | GSI keyed `ORG_SHIFT#<org>` / `<date>`. |
| 4 | R5 | `employee/swap-shifts/db.ts` (`findOpenSwapForShift`) | `Limit: 1` + filter → duplicate-post guard only checks the oldest open swap. | Deterministic key per (shift, poster) checked with `GetItem`, or conditional put. |
| 6 | R3, R7 | `shared/notifications/db.ts` (`queryUnreadNotificationsByUser`) | Reads a user's entire notification history to find unread; notifications never expire. | Add `ttl` to notifications; put read state in the key or a sparse GSI for unread. |
| 7 | R8, R6 | `web-admin/employees/db.ts`, `web-admin/organizations/db.ts` | Global `GSI1PK = 'EMPLOYEE'` / `'ORG'` (also `'MANAGER'`, `'ORG_ADMIN'`) read in one call with no pagination. | Paginate; long-term, scope listing keys. |
| 8 | R6 | `employee/swap-shifts/db.ts` (`listMyPostedSwaps`) | Reads the org's full swap history, filters by poster. | GSI keyed by poster, or accept with pagination if volume stays low. |
| 9 | — | `infra/template.yaml` `WebAdminGenerateDummyDataFunction` | Dummy-data generator is deployed to every environment including prod. | Gate behind a condition on `AppEnvironment`. |

Acceptable today (bounded filters, per R4): `manager/employees/db.ts` (`listEmployeesByManager`),
`manager/schedule/db.ts` (`listDraftShiftsByManager`), `employee/swap-shifts/db.ts`
(`listOpenSwapsForOrg`).

---

## 6. References

- [AWS — Paginating table query results](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html)
- [AWS — Query API (Limit vs FilterExpression)](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html)
- [AWS — Using Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [AWS — Enable TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-how-to.html)
- [Dynobase — 40 DynamoDB Best Practices](https://dynobase.dev/dynamodb-best-practices/)
- [The Hidden DynamoDB Cost Problem: Scan-Heavy Workloads](https://urielbitton.substack.com/p/the-hidden-dynamodb-cost-problem)
- [The 7 DynamoDB Sins](https://urielbitton.substack.com/p/the-7-dynamodb-sins-706)
- [DynamoDB Key Design Dictionary — hot partitions](https://hidekazu-konishi.com/entry/amazon_dynamodb_key_design_gsi_lsi_dictionary.html)
- [The surprising properties of DynamoDB pagination](https://advancedweb.hu/the-surprising-properties-of-dynamodb-pagination/)
- [Momento — Optimized DynamoDB secondary indexes](https://www.gomomento.com/blog/maximize-cost-savings-and-scalability-with-an-optimized-dynamodb-secondary-index/)
