# Spec: Org Admin Management Component (Web Admin)

## Overview
A dedicated page for managing the OrgAdmins of a single Organization. Reached by clicking **Manage Admins** on an org row in the Organizations page. Shows all OrgAdmins for that org, lets the WebAdmin register new ones, and disable existing ones. The org name is displayed in the page header for context.

## Role Scope
**WebAdmin only.** Protected by `authGuard` + `roleGuard` with `data: { roles: ['WebAdmin'] }`.

## Route
`/web-admin/organizations/:orgId/org-admins` — lazy loaded via `loadComponent` in `app.routes.ts`.

The `orgId` is read from `ActivatedRoute.snapshot.params['orgId']` on init.

## UI Behavior

### On load
- Fetches both `GET /organizations/{orgId}` (for org name in header) and `GET /web-admin/organizations/{orgId}/org-admins` in parallel.
- Shows a centered spinner while loading.
- On success: renders the OrgAdmin list with org name in the page heading.
- On error: danger alert with a Retry button.

### Page header
```
← Organizations    Acme Corp — Org Admins    [+ Register Org Admin]
```
- Back link navigates to `/web-admin/organizations`.
- Org name is the fetched org's `name` field.

### OrgAdmin list (non-empty)
**Laptop/PC columns:** Name, Email, Status badge, Created, Actions.
**Mobile/tablet:** card layout.

- **Status badge:** `FORCE_CHANGE_PASSWORD` → yellow "Pending" · `CONFIRMED` → green "Active" · `DISABLED` → grey "Disabled".
- Each active row has a **Disable** button. Disabled rows show no action button.

### Empty state
- "No org admins registered yet" with instructional copy.

### Register modal
- Opened by **+ Register Org Admin**.
- Fields:
  - **Name** — text, required
  - **Email** — email input, required
  - **Temporary Password** — password input with a show/hide toggle, required
- `org_id` is taken from the route param — not shown in the form.
- Inline field-level error messages (not silent button disable only).
- On 409: inline error — "A user with this email already exists."
- On other API error: inline error with the server's message.
- On success: closes modal, refreshes list.

### Disable confirmation modal
- Shows the user's name and email.
- "This will prevent them from signing in. Their data is preserved."
- On success: closes modal, refreshes list.

## API Calls

| Method | Endpoint | When | Response Shape |
|---|---|---|---|
| GET | `/organizations/{orgId}` | On init | `Organization` (for org name) |
| GET | `/web-admin/organizations/{orgId}/org-admins` | On init and after mutations | `OrgAdminUserResponse[]` |
| POST | `/web-admin/organizations/{orgId}/org-admins` | Register modal save | `OrgAdminUserResponse` |
| DELETE | `/web-admin/organizations/{orgId}/org-admins/{userId}` | Disable confirmation | `void` |

## Frontend Models

```typescript
// frontend/src/app/core/models/org-admin-user.model.ts
interface OrgAdminUserResponse {
  user_id: string;
  email: string;
  name: string;
  org_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  created_at: string;
}

interface CreateOrgAdminBody {
  email: string;
  name: string;
  temp_password: string;
}
```

## Services

```typescript
// frontend/src/app/features/web-admin/org-admins/org-admins.service.ts
getAll(orgId: string): Observable<OrgAdminUserResponse[]>
create(orgId: string, body: CreateOrgAdminBody): Observable<OrgAdminUserResponse>
disable(orgId: string, userId: string): Observable<void>

// OrganizationService (existing, injected for org name lookup)
getById(orgId: string): Observable<Organization>
```

## Form Validation Rules

1. `name` — required, shown as inline error "Name is required" if submitted blank.
2. `email` — required + valid format, inline errors per rule.
3. `temp_password` — required, inline error if blank.

## Component Test Matrix

| # | Test | Trigger / State | Expected DOM behavior |
|---|---|---|---|
| 1 | Shows spinner on init | both API calls pending | spinner visible |
| 2 | Shows org name in header | org API returns | "Acme Corp — Org Admins" in heading |
| 3 | Renders OrgAdmin list | API returns 2 users | names and emails visible |
| 4 | Shows Pending badge | `status: FORCE_CHANGE_PASSWORD` | yellow "Pending" badge |
| 5 | Shows Active badge | `status: CONFIRMED` | green "Active" badge |
| 6 | Shows Disabled badge, no Disable button | `status: DISABLED` | grey badge; Disable button absent |
| 7 | Shows empty state | API returns `[]` | "No org admins registered yet" visible |
| 8 | Shows error alert | API throws | danger alert with Retry |
| 9 | Back link present | on load | link to `/web-admin/organizations` visible |
| 10 | Opens register modal | Click "+ Register Org Admin" | modal visible, fields blank |
| 11 | Register button disabled when fields blank | any field empty | Register button `disabled` |
| 12 | Valid submit calls service with correct orgId | fill fields, click Register | `create(orgId, body)` called |
| 13 | 409 shows inline error | API returns 409 | "A user with this email already exists" in modal |
| 14 | Opens disable modal with user name+email | Click Disable | modal shows correct user info |
| 15 | Confirm disable calls service | Click Disable in modal | `disable(orgId, userId)` called; modal closes |

## Guard / Role Test Matrix

| Role | Expected behavior |
|---|---|
| WebAdmin | Route activates |
| OrgAdmin | Redirect to `/unauthorized` |
| Manager | Redirect to `/unauthorized` |
| Employee | Redirect to `/unauthorized` |
