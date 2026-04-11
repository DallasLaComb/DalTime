# Spec: Manager Management Component (Org Admin)

## Overview
The primary page for OrgAdmins after login. Shows all Managers under their organization, lets the OrgAdmin register new managers, edit existing ones, and disable them. The OrgAdmin's org is resolved automatically from their JWT — no org selection needed.

## Role Scope
**OrgAdmin only.** Protected by `authGuard` + `roleGuard` with `data: { roles: ['OrgAdmin'] }`.

## Route
`/org-admin/managers` — lazy loaded via `loadComponent` in `app.routes.ts`.

## UI Behavior

### On load
- Calls `GET /org-admin/managers` to fetch all managers.
- Shows a centered spinner while loading.
- On success: renders the manager list.
- On error: danger alert with a Retry button.

### Page header
```
Managers    [+ Register Manager]
```

### Manager list (non-empty)
**Laptop/PC columns:** Name (first + last), Email, Phone, Status badge, Employees, Created, Actions.
**Mobile/tablet:** card layout.

- **Name** displays `first_name last_name`.
- **Status badge:** `FORCE_CHANGE_PASSWORD` → yellow "Pending" · `CONFIRMED` → green "Active" · `DISABLED` → grey "Disabled".
- **Employees** shows the `employee_count` value.
- Each active row has **Edit** and **Disable** buttons. Disabled rows show no action buttons.

### Empty state
- "No managers registered yet" with instructional copy.

### Register modal
- Opened by **+ Register Manager**.
- Fields:
  - **First Name** — text, required
  - **Last Name** — text, required
  - **Email** — email input, required
  - **Phone** — tel input, optional
  - **Temporary Password** — password input with show/hide toggle, required
- Inline field-level error messages.
- On 409: inline error — "A user with this email already exists."
- On other API error: inline error with the server's message.
- On success: closes modal, refreshes list.

### Edit modal
- Opened by clicking **Edit** on a manager row.
- Fields pre-populated with current values:
  - **First Name** — text, required
  - **Last Name** — text, required
  - **Phone** — tel input, optional
- Email is displayed but **not editable** (read-only display).
- Inline field-level error messages.
- On success: closes modal, refreshes list.

### Disable confirmation modal
- Shows the manager's full name and email.
- "This will prevent them from signing in. Their data is preserved."
- On success: closes modal, refreshes list.

## API Calls

| Method | Endpoint | When | Response Shape |
|---|---|---|---|
| GET | `/org-admin/managers` | On init and after mutations | `ManagerResponse[]` |
| POST | `/org-admin/managers` | Register modal save | `ManagerResponse` |
| PUT | `/org-admin/managers/{managerId}` | Edit modal save | `ManagerResponse` |
| DELETE | `/org-admin/managers/{managerId}` | Disable confirmation | `void` |

## Frontend Models

```typescript
// frontend/src/app/core/models/manager.model.ts
interface ManagerResponse {
  manager_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_admin_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

interface CreateManagerBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  temp_password: string;
}

interface UpdateManagerBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}
```

## Services

```typescript
// frontend/src/app/features/org-admin/managers/managers.service.ts
getAll(): Observable<ManagerResponse[]>
create(body: CreateManagerBody): Observable<ManagerResponse>
update(managerId: string, body: UpdateManagerBody): Observable<ManagerResponse>
disable(managerId: string): Observable<void>
```

## Form Validation Rules

### Register form
1. `first_name` — required, inline error "First name is required" if submitted blank.
2. `last_name` — required, inline error "Last name is required" if submitted blank.
3. `email` — required + valid format, inline errors per rule.
4. `temp_password` — required, inline error if blank.
5. `phone` — optional, no validation.

### Edit form
1. `first_name` — required, inline error "First name is required" if submitted blank.
2. `last_name` — required, inline error "Last name is required" if submitted blank.
3. `phone` — optional, no validation.

## Component Test Matrix

| # | Test | Trigger / State | Expected DOM behavior |
|---|---|---|---|
| 1 | Shows spinner on init | API call pending | spinner visible |
| 2 | Renders manager list | API returns 2 managers | names, emails, phones visible |
| 3 | Shows full name | API returns manager | "John Doe" displayed (first + last) |
| 4 | Shows Pending badge | `status: FORCE_CHANGE_PASSWORD` | yellow "Pending" badge |
| 5 | Shows Active badge | `status: CONFIRMED` | green "Active" badge |
| 6 | Shows Disabled badge, no action buttons | `status: DISABLED` | grey badge; Edit and Disable buttons absent |
| 7 | Shows employee count | `employee_count: 5` | "5" displayed in Employees column |
| 8 | Shows empty state | API returns `[]` | "No managers registered yet" visible |
| 9 | Shows error alert | API throws | danger alert with Retry visible |
| 10 | Opens register modal | Click "+ Register Manager" | modal visible, fields blank |
| 11 | Register — required field errors | submit with blank fields | inline errors shown, API not called |
| 12 | Register — valid submit calls service | fill required fields, click Register | `create(body)` called |
| 13 | Register — 409 shows inline error | API returns 409 | "A user with this email already exists" in modal |
| 14 | Opens edit modal with pre-populated fields | Click Edit on a row | modal shows current first name, last name, phone; email read-only |
| 15 | Edit — valid submit calls service | change first name, click Save | `update(managerId, body)` called |
| 16 | Edit — required field errors | clear first name, submit | inline error shown |
| 17 | Opens disable modal with manager info | Click Disable | modal shows full name and email |
| 18 | Confirm disable calls service | Click Disable in modal | `disable(managerId)` called; modal closes |

## Guard / Role Test Matrix

| Role | Expected behavior |
|---|---|
| WebAdmin | Redirect to `/unauthorized` |
| OrgAdmin | Route activates |
| Manager | Redirect to `/unauthorized` |
| Employee | Redirect to `/unauthorized` |
