# Broadcast Notifications (Backend) — Blueprint

Issue: [#9](https://github.com/DallasLaComb/DalTime/issues/9) — "WebAdmin: banner-wide notification composer & broadcast delivery".

Status: **Approved 2026-09-29** — D1, D2, D3 (list + delete included), D5 as recommended; D4 revised: WebAdmins also
receive `ALL` broadcasts so "all users" really means everyone. Message limit raised to 500 characters for
maintenance notices.

Companion: `frontend/src/app/features/web-admin/broadcasts/0-broadcasts.blueprint.md`.

## 1. Summary

A WebAdmin composes a **broadcast** — a short banner message targeted at every org, one org, or one
role within one org. Targeted users see the highest-severity unread, unexpired broadcast as a banner
at the top of the app shell and can dismiss it; dismissal persists per user.

Two backend slices:

| Slice | Routes | Who |
| --- | --- | --- |
| `web-admin/broadcasts/` | `POST` / `GET /web-admin/broadcasts`, `DELETE /web-admin/broadcasts/{broadcastId}` | WebAdmin only (`requireWebAdminWithLookup`, 403 otherwise) |
| `shared/broadcasts/` | `GET /{role}/broadcasts/active`, `PUT /{role}/broadcasts/{broadcastId}/dismissal` | `{role}` ∈ `web-admin`, `org-admin`, `manager`, `employee`; caller must hold the route's role (403 otherwise); wrapped in `withImpersonation` |

## 2. Decisions needing approval

### D1 — Fan-out on read, not on write (deviates from the issue text)

The issue says "persist via the existing notification entity/keys". The existing entity is
per-recipient (`PK = USER#<sub>`), so reusing it means **fan-out on write**: one `PutItem` per
targeted user. For "all orgs" that requires enumerating every user in the system — only possible via
the global `GSI1PK = EMPLOYEE / MANAGER / ORG_ADMIN` partitions (known violation #7 in
`docs/dynamodb-best-practices.md`), costs O(users) WRUs per broadcast, can time out the Lambda as the
user base grows, and **misses users created after the broadcast was sent**.

**Recommendation:** store each broadcast **once**, keyed by its target scope, and have each reader
query the (at most three) scopes that apply to them. Cost per broadcast = 1 write; cost per banner
poll = 3 small Queries + 1 BatchGet, independent of user count. Dismissal is a separate per-user
item. The existing inbox (`shared/notifications`, `USER#<sub>` / `NOTIFICATION#…`) is untouched —
broadcasts do **not** appear in `/notifications`, matching the issue's "distinct from the inbox".

### D2 — Route name `/web-admin/broadcasts` instead of `/web-admin/notifications`

`GET` / `PATCH /web-admin/notifications` already exist on `NotificationsFunction` and mean "the
WebAdmin's own inbox". Adding `POST` on the same path to a different function would work in HTTP API
but gives one path two unrelated meanings and a shared OPTIONS route owned by the other function.
**Recommendation:** `POST /web-admin/broadcasts`.

### D3 — Removing a broadcast early

Expiry is optional per the issue, so a broadcast with no expiry can currently never be taken down.
**Recommendation:** include `GET /web-admin/broadcasts` (list active) and
`DELETE /web-admin/broadcasts/{broadcastId}` in this story (keys in §3 already support them via a
sparse, bounded GSI1 entry). Alternative: make expiry required (max 90 days) and defer delete.

### D4 — WebAdmins receive `ALL` broadcasts (revised on approval)

"All users" includes WebAdmins: `GET /web-admin/broadcasts/active` returns `ALL`-scope broadcasts only
(WebAdmins have no org). While impersonating, a WebAdmin sees exactly what the target user sees.

### D5 — Enable TTL on the table

Broadcasts and dismissals carry `ttl`. `DynamoTable` currently has no `TimeToLiveSpecification`
(known violation #5). This story adds `TimeToLiveSpecification: { AttributeName: ttl, Enabled: true }`
— which also makes the existing impersonation-session `ttl` start working. Reads still exclude expired
items by key (TTL deletion can lag up to 48 h), so correctness does not depend on TTL timing.

## 3. Data model

### Records

| Record | PK | SK | GSI1PK | GSI1SK |
| --- | --- | --- | --- | --- |
| Broadcast | `BROADCAST#<scope>` | `<expires_at>#<broadcast_id>` | `BROADCAST` (D3 only) | `<expires_at>#<broadcast_id>` |
| Broadcast dismissal | `USER#<sub>` | `BROADCAST_DISMISSAL#<broadcast_id>` | — | — |

`<scope>` is one of:

| Target | `<scope>` |
| --- | --- |
| All orgs | `ALL` |
| One org | `ORG#<org_id>` |
| One org + role | `ORG#<org_id>#ROLE#<OrgAdmin\|Manager\|Employee>` |

- **SK starts with `expires_at`** (ISO) so "unexpired" is a key condition (`SK > :nowIso`), not a
  filter (R3). A broadcast with no expiry uses the sentinel `9999-12-31T23:59:59.999Z` and has no `ttl`.
- **`broadcast_id`** is a UUID. The public id the client uses to dismiss is the raw UUID — dismissal
  keys don't need `expires_at`, so no composite-id / URL-encoding issue like the inbox has.
- **Dismissal `ttl`** = the broadcast's `ttl` (absent when the broadcast never expires), so dismissals
  clean themselves up with the broadcast.

Broadcast item attributes:

| Attribute | Type | Notes |
| --- | --- | --- |
| `broadcast_id` | String | UUID |
| `message` | String | Trimmed, 1–500 chars |
| `severity` | `INFO` \| `WARNING` \| `CRITICAL` | Drives banner colour and "highest priority" |
| `target_scope` | `ALL` \| `ORG` \| `ORG_ROLE` | |
| `target_org_id` | String? | Present for `ORG` / `ORG_ROLE` |
| `target_role` | `OrgAdmin` \| `Manager` \| `Employee`? | Present for `ORG_ROLE` |
| `expires_at` | String? | ISO; must be in the future; omitted = never |
| `created_at` | String | ISO |
| `created_by_web_admin_id` | String | Audit (matches `modified_by_web_admin_id` convention) |
| `ttl` | Number? | `expires_at` in epoch seconds + 1 day grace |

### Access patterns

| Access pattern | Operation | Key expression | Bound |
| --- | --- | --- | --- |
| Create broadcast | `GetItem` (org exists, for ORG/ORG_ROLE) + `PutItem` | `ORG#<org_id>` / `METADATA`; then as above | 1 item |
| Resolve reader's org | `GetItem` | `USER#<sub>` / `METADATA` → `org_id` | 1 item |
| Active broadcasts for reader | 3 × `Query` in parallel | `PK = BROADCAST#ALL` / `BROADCAST#ORG#<org>` / `BROADCAST#ORG#<org>#ROLE#<role>` AND `SK > :nowIso` | Active broadcasts only — WebAdmin-authored, expected < 10 per scope. |
| Reader's dismissals for those | `BatchGetItem` | `USER#<sub>` / `BROADCAST_DISMISSAL#<id>` for each active id | ≤ active count (chunked at 100) |
| Dismiss | `PutItem` | `USER#<sub>` / `BROADCAST_DISMISSAL#<id>` | 1 item; idempotent |
| (D3) WebAdmin list active | `Query` GSI1 | `GSI1PK = BROADCAST AND GSI1SK > :nowIso`, paginated | Active broadcasts only |
| (D3) WebAdmin delete | `Query` GSI1 by id → `DeleteItem` | see §5 | 1 item |

**Dismiss validation:** before writing the dismissal the service confirms the id is among the caller's
active broadcasts (reuses the reader query) and returns **404** otherwise — no dismissal rows for
arbitrary ids, no existence leakage for other orgs' broadcasts.

### R8 justification (`BROADCAST#ALL`, `GSI1PK = BROADCAST`)

Both are single-value partitions, but: writes are WebAdmin-only (a handful per month); reads are
bounded by `SK > now` so expired items are never read; TTL removes them; the HTTP API throttle (10 rps)
is far below a partition's 3,000 RRU/s. Documented here per R8's "written justification" rule.

### Checklist (`docs/dynamodb-best-practices.md` §4)

- [x] No Scan / PartiQL (R1)
- [x] Every access pattern listed with its key condition (R2)
- [x] "Unexpired" is in the sort key; no filters (R3, R4)
- [x] No `Limit` + `FilterExpression` (R5)
- [x] Reader queries bounded (documented above); D3 admin list paginates (R6)
- [x] `ttl` on broadcasts + dismissals; table TTL enabled (R7, D5)
- [x] Single-value partitions justified above (R8)
- [x] No `ConsistentRead` (R9)
- [x] Entity map updated (Broadcast + Broadcast dismissal sections)

## 4. Contracts (`@daltime/contracts`)

- `contracts/src/entities/broadcast.ts` — `BroadcastSeverity`, `BroadcastTargetScope`,
  `BroadcastRecord`, `BroadcastDismissalRecord`, `BroadcastApiFields` (via `apiShapeOf`, also omitting `ttl`).
- `contracts/src/schemas/web-admin/broadcasts.ts` — `CreateBroadcastBody` (Zod `superRefine`:
  `org_id` required for `ORG`/`ORG_ROLE`, `role` required for `ORG_ROLE`, `expires_at` in the future),
  `BroadcastResponse`; `registerOperation('post', '/web-admin/broadcasts', …)` (+ D3 list/delete).
- `contracts/src/schemas/shared/broadcasts.ts` — `ActiveBroadcastListResponse`,
  `DismissBroadcastPathParams`; `registerRoleOperation` for the 3 role prefixes (declares the
  impersonation header), same loop pattern as `shared/notifications.ts`.
- Run `node contracts/scripts/contracts-sync.mjs` after edits.

## 5. Vertical slices

```
backend/src/functions/web-admin/broadcasts/
  0-broadcasts.blueprint.md
  handler.ts   # requireWebAdminWithLookup → POST (+ D3 GET, DELETE); withLogging(…, 'web-admin-broadcasts')
  service.ts   # createBroadcast(body, webAdminId) — builds scope key, verifies org exists, logs broadcast_id + target only
  db.ts        # putBroadcast, getOrgMetadata (+ D3 listActiveBroadcasts, deleteBroadcast)

backend/src/functions/shared/broadcasts/
  handler.ts   # GET list / PUT dismissal; withLogging(withImpersonation(…), 'shared-broadcasts')
  service.ts   # listActiveForCaller(sub, role) → sorted CRITICAL > WARNING > INFO, then newest; dismiss(sub, role, id)
  db.ts        # queryActiveByScope(scope, nowIso), batchGetDismissals(sub, ids), putDismissal(...)
```

- Reader role comes from the route prefix, and the caller's Cognito groups must include it (403
  otherwise — stops an Employee reading `/org-admin/broadcasts/active`). Org from the caller's
  `USER#<sub>/METADATA`. WebAdmins, and callers with no org, get only `ALL` broadcasts.
- `GET` returns **all** active, non-dismissed broadcasts sorted by priority; the banner shows the first.
  Returning the list (not just one) lets the next banner appear after a dismissal without a refetch.
- Dismiss under impersonation is a non-GET, so `withImpersonation` rejects it with 403 (read-only
  impersonation). The frontend hides the dismiss button while impersonating.
- Logging: `logger.info('broadcast created', { broadcast_id, target_scope, target_org_id, target_role, severity })`,
  `logger.info('broadcast dismissed', { broadcast_id, caller_sub })`. Never the message text.

## 6. Infra (`infra/template.yaml`)

- `WebAdminBroadcastsFunction` + `WebAdminBroadcastsFunctionLogGroup` + `…ErrorMetricFilter`
  (shape of `WebAdminProfileFunction`, `DynamoDBCrudPolicy` only). Events:
  `POST` / `GET` / `OPTIONS /web-admin/broadcasts`, `DELETE` / `OPTIONS /web-admin/broadcasts/{broadcastId}`.
- `BroadcastsFunction` + LogGroup + ErrorMetricFilter. Per role (`web-admin`, `org-admin`, `manager`, `employee`):
  `GET /{role}/broadcasts/active`, `OPTIONS /{role}/broadcasts/active`,
  `PUT /{role}/broadcasts/{broadcastId}/dismissal`, `OPTIONS /{role}/broadcasts/{broadcastId}/dismissal`.
- `DynamoTable`: add `TimeToLiveSpecification` (D5).
- `.github/iam/github-actions-policy.json` already grants `dynamodb:UpdateTimeToLive` / `DescribeTimeToLive`.

## 7. `backend/env.local.json`

```json
"WebAdminBroadcastsFunction": { "TABLE_NAME": "daltime-daltime-backend-dev" },
"BroadcastsFunction":         { "TABLE_NAME": "daltime-daltime-backend-dev" }
```

Neither calls Cognito APIs (`requireWebAdminWithLookup` uses JWT groups + DynamoDB), so no `USER_POOL_ID`.
`env.local.json` is git-ignored — each developer adds these two entries locally; `env.local.json.example` is updated.

## 8. Tests

- `test/unit/web-admin/broadcasts/{handler,service,db}.test.ts` — 201 for each of the 3 scopes;
  400 for missing org/role, past `expires_at`, empty/oversized message; 404 unknown org;
  **403 for OrgAdmin / Manager / Employee callers and for a WebAdmin with no DynamoDB record**;
  exact `PutCommand` key assertions.
- `test/unit/shared/broadcasts/{handler,service,db}.test.ts` — queries exactly the 3 scopes with
  `SK > now`; dismissed ids excluded; priority ordering; caller with no org → only `ALL`;
  dismiss unknown/foreign id → 404; dismiss is idempotent; impersonated GET works, impersonated PUT → 403.
- `arch.withlogging.test.ts` picks up both handlers automatically.
- Bruno: `bruno/web-admin/broadcasts/*.bru`, `bruno/shared/broadcasts/*.bru`.

## 9. Out of scope

Editing a sent broadcast; rich text / links in banners; real-time push (poll only); showing broadcasts
in the `/notifications` inbox; per-location targeting.
