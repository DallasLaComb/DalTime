# Notifications — Blueprint

Issue: #209 ("Backend: Notification model, create/list/mark-read API"), Epic 5 ("Requests, Approvals & Notifications"), first story, no dependencies.

Status: **Approved** (Stage 1 product-owner spec + Stage 2 data-model / cloud-architecture review complete, decisions below).

## 1. Summary

A cross-role notification entity (recipient identified by Cognito `sub`, not by role) with:

- `createNotification(...)` — synchronous, in-process service function called inline by other backend slices (e.g. an approval handler). No new infra.
- `GET /{role}/notifications` — list caller's own notifications, newest first.
- `PATCH /{role}/notifications` — mark all of caller's unread notifications as read.
- `PATCH /{role}/notifications/{notificationId}` — mark one of caller's notifications as read.

`{role}` ∈ `web-admin`, `org-admin`, `manager`, `employee` — one Lambda function (`NotificationsFunction`) registered against all four role-prefixed path sets, consistent with the `ImpersonateFunction` / `ManagerEmployeesFunction` pattern of one function, many `HttpApi` events.

## 2. Open questions resolved

### (a) DynamoDB key shape

| Record       | PK                     | SK                                            | GSI1PK   | GSI1SK   |
| ------------ | ---------------------- | --------------------------------------------- | -------- | -------- |
| Notification | `USER#<recipient_sub>` | `NOTIFICATION#<created_at>#<notification_id>` | — (none) | — (none) |

- **PK = `USER#<recipient_sub>`** reuses the existing `USER#<sub>` reverse-lookup partition convention. Cross-user isolation is enforced structurally: a caller can only Query/GetItem within their own partition (`USER#<callerSub>`), derived from `getCallerSub(event)`. This satisfies the "no cross-user leak" requirement at the data layer, not just in application logic.
- **SK = `NOTIFICATION#<created_at>#<notification_id>`** — ISO timestamp first makes the partition naturally time-sorted (`ScanIndexForward=false` for "newest first", no GSI needed); `notification_id` suffix guarantees uniqueness on same-millisecond writes.
- **No GSI1 entry.** All required access patterns (list-by-recipient, get-one-and-verify-owner, mark-all-unread) are served by the base table. A `GSI1PK = NOTIFICATION` "by type across all users" index is speculative — out of scope per the issue, and would itself be a hot-partition risk (every notification system-wide on one key) if added naively. Deferred; revisit only if/when an admin cross-tenant notification view is actually specced.

Access pattern mapping:

| Access pattern                               | Operation                                                                               | Key expression                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| List caller's notifications, newest first    | `Query` (base table)                                                                    | `PK = USER#<callerSub>` AND `begins_with(SK, "NOTIFICATION#")`, `ScanIndexForward=false` |
| Mark one notification as read (verify owner) | `GetItem` then `UpdateItem` (base table)                                                | `PK = USER#<callerSub>`, `SK = NOTIFICATION#<created_at>#<notificationId>`               |
| Mark all unread as read                      | `Query` (base table, `FilterExpression: read_status = :unread`) + per-item `UpdateItem` | same Query as list                                                                       |
| Create                                       | `PutItem` (base table)                                                                  | as above                                                                                 |

`docs/dynamodb-entity-map.md` gets a new `### Notification` section (under "Record Types", replacing/extending the existing `(future)` placeholders) reflecting this table — done as part of this implementation, not deferred.

**Mark-one-as-read route shape consequence:** since SK embeds `created_at`, the client must supply both `created_at` and `notification_id` (or the API returns an opaque composite `notification_id` token that encodes both) to address a single item directly. Decision: the public `notification_id` returned to API consumers **is** the encoded `<created_at>#<rawId>` SK suffix (not just the raw UUID) — this avoids a second GetItem/Query to resolve `created_at` before the mark-read UpdateItem can run. `stripKeys()` does not strip this field; it's a derived public ID, not the literal `PK`/`SK`. Internally `rawId` (from `randomUUID()`) is also stored as its own attribute for log correlation.

**URL-encoding requirement:** the public `notification_id` is `<ISO-timestamp>#<uuid>` (e.g. `2026-06-18T12:00:00.000Z#a1b2c3d4-...`), which contains a literal `#` and `:` — both reserved URL characters. A frontend building `PATCH /{role}/notifications/${notification_id}` MUST `encodeURIComponent(notification_id)` before interpolating it into the path; otherwise the unencoded `#` truncates the URL client-side (everything after `#` becomes a URL fragment and never reaches the server), producing a silent failure rather than a 404. Flagged explicitly here so the future frontend story doesn't discover it via a confusing failure.

### (b) Sync vs async

**Synchronous.** `createNotification(recipientSub, type, message)` is a plain async function in `backend/src/functions/shared/notifications/service.ts`, imported and `await`-ed directly by whichever handler triggers a notification (e.g. a future approval handler in this epic). It performs one `PutItem` and returns. No SQS, EventBridge, SNS, Step Functions, or DLQ. Matches the issue's Technical Notes ("no speculative abstraction") and Stage 2 cloud-architecture's confirmation that this is the first and only creation path needed at current scale. If a future story needs fan-out (e.g. "notify everyone in a location"), that is the point to revisit async — not now.

### (c) Caller-scoping / authorization

- Auth is **authenticator-only**: the existing `CognitoJwtAuthorizer` (already the `DefaultAuthorizer` for `DalTimeHttpApi`) validates the JWT; no Cognito group/role check is added or needed. This matches the rest of the backend — `grep` over `shared/` and all handlers confirms zero role-group enforcement anywhere; every handler scopes by `getCallerSub`.
- `getCallerSub(event)` (existing, `backend/src/functions/shared/auth.ts`) is the sole source of identity used to build `PK = USER#<callerSub>` for every list/mark-read operation. There is no `org_id` or `manager_id` lookup involved — notifications are addressed directly to a sub, independent of org/role hierarchy.
- Mark-one-as-read on a `notification_id` the caller does not own: the `GetItem` is scoped to `PK = USER#<callerSub>`, so a forged/foreign ID simply returns no item → handler returns **404 Not Found** (not 403) to avoid existence leakage (confirms/denies nothing about whether the ID exists for _someone_). This is the explicit choice the Stage 1 spec asked for.

## 3. Model

`backend/src/functions/shared/models/notifications/notification.model.ts`

```ts
export type NotificationType = 'INFO' | 'APPROVAL' | 'REQUEST' | 'SHIFT';

export interface Notification {
  PK: string; // USER#<recipient_sub>
  SK: string; // NOTIFICATION#<created_at>#<raw_id>
  notification_id: string; // public composite id = `${created_at}#${raw_id}`
  recipient_sub: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string; // ISO
}

export type PublicNotification = Omit<Notification, 'PK' | 'SK'>;
```

`stripKeys()` (existing shared util) strips `PK`/`SK` before returning to API callers, consistent with every other entity.

## 4. Vertical slice

```
backend/src/functions/shared/notifications/
  handler.ts   # routes GET/PATCH by path+method, calls service
  service.ts   # createNotification, listNotifications, markOneRead, markAllRead — throws NotFoundError etc.
  db.ts        # Query/GetItem/UpdateItem/PutItem only
  0-notifications.blueprint.md
```

This is the first vertical slice under `shared/` with its own routes (precedent, justified above: recipients are genuinely cross-role, so no single role folder is correct). Existing `shared/` contents (auth.ts, dynamo.ts, response.ts, models/) remain cross-cutting utilities; this slice follows the same handler/service/db split as role-owned slices.

- `handler.ts` dispatches on `event.requestContext.http.method` + presence of `{notificationId}` path param, mirroring `manager/employees/handler.ts`'s `handleGet`/`handlePatch` style. Uses `getCallerSub`, `ok`/`noContent`/`badRequest`/`notFound`, `mapHandlerError`, `setRequestOrigin`.
- `service.ts`: `listNotifications(callerSub)`, `markOneAsRead(callerSub, notificationId)` (throws `NotFoundError` if not owned/not found), `markAllAsRead(callerSub)`, and the internal `createNotification(recipientSub, type, message)` for other slices to import directly (not exposed over HTTP in this story).
- `db.ts`: `queryNotificationsByUser(sub)`, `getNotification(sub, notificationId)`, `putNotification(record)`, `updateNotificationRead(sub, notificationId)`, `queryUnreadNotificationsByUser(sub)`.

## 5. Infra (`infra/template.yaml`)

One new `NotificationsFunction` + `NotificationsFunctionLogGroup`, following the `ImpersonateFunction` block shape (CodeUri, Handler, LoggingConfig, `DependsOn` the LogGroup), with `DynamoDBCrudPolicy` on `DalTimeTable` (matches the existing per-function policy grain — no IAM divergence). No Cognito permissions needed (no `cognito-idp:*` actions; this slice never calls Cognito).

Events (×4 role prefixes, all on the same function/handler):

| Event name pattern               | Method  | Path                                                                |
| -------------------------------- | ------- | ------------------------------------------------------------------- |
| `List{Role}Notifications`        | GET     | `/{role}/notifications`                                             |
| `MarkAll{Role}NotificationsRead` | PATCH   | `/{role}/notifications`                                             |
| `MarkOne{Role}NotificationRead`  | PATCH   | `/{role}/notifications/{notificationId}`                            |
| `Options{Role}Notifications`     | OPTIONS | `/{role}/notifications` (`Auth: Authorizer: NONE`)                  |
| `Options{Role}NotificationById`  | OPTIONS | `/{role}/notifications/{notificationId}` (`Auth: Authorizer: NONE`) |

`{role}` substituted for `web-admin`, `org-admin`, `manager`, `employee` → 20 events total on one function resource.

## 6. `backend/env.local.json`

```json
"NotificationsFunction": {
  "TABLE_NAME": "daltime-daltime-backend-dev"
}
```

No `USER_POOL_ID` — this slice never touches Cognito, only `getCallerSub` (JWT claim decode), consistent with functions like `ManagerLocationsFunction`/`OrgAdminLocationsFunction` that also omit it.

## 7. Tests (Epic 2 conventions)

- Unit: `handler.test.ts` (`buildApiGwEvent` factory; GET list, PATCH all, PATCH one happy path, 400 missing path param, 404 not-owned/not-found, 500 DynamoDB failure), `service.test.ts`, `db.test.ts` (`aws-sdk-client-mock` on `@aws-sdk/lib-dynamodb`, asserting exact `QueryCommand`/`GetCommand`/`UpdateCommand`/`PutCommand` inputs). Target ≥80% branch coverage.
- Integration: seed two distinct users (A, B); `createNotification` for A; assert B's list call returns `[]`; assert B's `PATCH /.../notifications/{a_notification_id}` returns 404, not 200 — proving no cross-user leak end-to-end, not just at the unit-mock level.

## 8. Out of scope (carried from issue)

Real-time/websocket delivery; async/event-driven creation; pagination of the list endpoint (deferred given current low scale); rate limiting (no precedent elsewhere in this repo); frontend notification UI (separate story).
