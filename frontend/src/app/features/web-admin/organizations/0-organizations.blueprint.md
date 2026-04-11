# Spec: Organizations Component (Web Admin)

## Overview
Provides a full-page management UI for Organizations. A WebAdmin can list all organizations, see at a glance how many OrgAdmins each one has, create new orgs, edit existing ones, delete them, and navigate to the per-org OrgAdmin management page.

## Role Scope
**WebAdmin only.** Protected by `authGuard` + `roleGuard` with `data: { roles: ['WebAdmin'] }`.

## Route
`/web-admin/organizations` — lazy loaded via `loadComponent` in `app.routes.ts`.

## UI Behavior

### On load
- Calls `OrganizationService.getAll()` immediately.
- Shows a centered Bootstrap spinner while loading.
- On success: renders the organizations table/cards (or empty state if none exist).
- On error: danger alert with a **Retry** button.

### Organization table (non-empty state)
**Laptop/PC columns:** ID (monospace), Name, Address, Org Admins (count badge), Created, Actions.
**Mobile/tablet:** card layout — Name, Address, admin count badge, action buttons stacked.

- **Org Admins column:** shows `org_admin_count` as a badge. `0` → grey badge. `> 0` → blue badge.
- Each row/card has three action buttons:
  - **Edit** — opens the create/edit modal.
  - **Manage Admins** — navigates to `/web-admin/organizations/{orgId}/org-admins`.
  - **Delete** — opens the delete confirmation modal.

### Empty state
- "No organizations yet" message with instructional copy.

### Create / Edit modal
- Opened by **+ Create Organization** (create mode) or **Edit** (edit mode).
- Fields: **Name**, **Address**.
- Save button disabled while saving or either field is blank.
- On success: closes modal, refreshes list.
- Backdrop click closes the modal.

### Delete confirmation modal
- Opened by **Delete** on a row.
- If `org_admin_count > 0`: shows a warning — "This organization has active admins. Deleting it will not remove their Cognito accounts."
- On success: closes modal, refreshes list.

## API Calls

| Method | Endpoint | When | Response Shape |
|---|---|---|---|
| GET | `/organizations` | On init and after every mutating action | `Organization[]` |
| POST | `/organizations` | Modal save (create mode) | `Organization` |
| PUT | `/organizations/{orgId}` | Modal save (edit mode) | `Organization` |
| DELETE | `/organizations/{orgId}` | Delete confirmation | `void` |

## Frontend Model

```typescript
// frontend/src/app/core/models/organization.model.ts

interface Organization {
  org_id: string;
  name: string;
  address: string;
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  org_admin_count: number;  // maintained by org-admins Lambda, read-only here
}

interface CreateOrganizationBody {
  name: string;
  address: string;
}

interface UpdateOrganizationBody {
  name?: string;
  address?: string;
}
```

## Navigation

Clicking **Manage Admins** on a row uses Angular Router:
```ts
router.navigate(['/web-admin/organizations', org.org_id, 'org-admins']);
```
No modal — it's a full page navigation.

## Component Test Matrix

| # | Test | Trigger / State | Expected DOM behavior |
|---|---|---|---|
| 1 | Shows loading spinner on init | `getAll()` pending | spinner visible |
| 2 | Renders org list with admin count badge | 2 orgs returned | names, addresses, count badges visible |
| 3 | Count badge is grey for 0 admins | `org_admin_count: 0` | grey badge showing "0" |
| 4 | Count badge is blue for >0 admins | `org_admin_count: 2` | blue badge showing "2" |
| 5 | Shows empty state | `getAll()` returns `[]` | "No organizations yet" visible |
| 6 | Shows error alert on load failure | `getAll()` throws | danger alert with Retry button |
| 7 | Retry re-fetches | Click Retry | `getAll()` called second time |
| 8 | Opens create modal with blank fields | Click "+ Create Organization" | modal title "Create Organization"; fields blank |
| 9 | Opens edit modal pre-populated | Click Edit | modal title "Edit Organization"; fields have org values |
| 10 | Create — valid submit calls service | Fill fields, click Create | `create()` called; modal closes; list refreshes |
| 11 | Edit — valid submit calls service | Edit name, click Save | `update()` called; modal closes; list refreshes |
| 12 | Manage Admins navigates to org-admins route | Click Manage Admins | `router.navigate` called with correct orgId |
| 13 | Opens delete modal | Click Delete | delete modal visible with org name |
| 14 | Delete warning shown when org has admins | `org_admin_count: 2` | warning text visible in delete modal |
| 15 | Confirm delete calls service | Click Delete in modal | `delete()` called; modal closes; list refreshes |

## Guard / Role Test Matrix

| Role | Expected behavior |
|---|---|
| WebAdmin | Route activates |
| OrgAdmin | Redirect to `/unauthorized` |
| Manager | Redirect to `/unauthorized` |
| Employee | Redirect to `/unauthorized` |

## Known Gaps (resolved)

- [x] ~~No component/service tests~~ — added in gap-fill pass
- [x] ~~`ngModel`, no `OnPush`, no `data-testid`~~ — fixed in gap-fill pass
