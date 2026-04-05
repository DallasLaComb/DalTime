# Spec: Organizations Component (Web Admin)

## Overview
Provides a full-page management UI for Organizations — the top-level multi-tenant boundary for DalTime. A WebAdmin user can list all organizations, create new ones, edit existing ones, and delete them. The page is the primary entry point for provisioning the tenants that OrgAdmins, Managers, and Employees will be scoped to.

## Role Scope
**WebAdmin only.** Route is protected by `authGuard` + `roleGuard` with `data: { roles: ['WebAdmin'] }`. All other roles are redirected to `/unauthorized`.

## Route
`/web-admin/organizations` — lazy loaded via `loadComponent` in `app.routes.ts`.

## UI Behavior

### On load
- Calls `OrganizationService.getAll()` immediately in the constructor.
- Shows a centered Bootstrap spinner while loading.
- On success: renders the organizations table (or empty state if none exist).
- On error: shows a dismissible danger alert with a **Retry** button that re-triggers the load.

### Organization table (non-empty state)
- Columns: ID (monospace `<code>`), Name (semibold), Address, Created (formatted date), Actions.
- Each row has an **Edit** button and a **Delete** button.
- **Edit** opens the create/edit modal pre-populated with the org's current `name` and `address`.
- **Delete** opens the delete confirmation modal.

### Empty state
- Shown when the API returns an empty array.
- Displays a centered message: "No organizations yet" + instructional sub-copy.

### Create / Edit modal
- Opened by the **+ Create Organization** button (create mode) or a row's **Edit** button (edit mode).
- Title reads "Create Organization" in create mode and "Edit Organization" in edit mode.
- Two fields: **Name** and **Address**.
- **Save** / **Create** button is disabled while `saving` is true or either field is blank after trimming.
- Shows a spinner inside the save button while `saving` is true.
- On success: closes the modal and refreshes the list.
- On API error: logs to console, clears `saving` state (modal stays open — no inline error shown).
- Backdrop click closes the modal.

### Delete confirmation modal
- Opened by a row's **Delete** button.
- Displays the org name in bold and a "This action cannot be undone" warning.
- **Delete** button is disabled while `saving` is true.
- On success: closes the modal and refreshes the list.
- Backdrop click closes the modal.

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
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
  org_admin_ids: string[]; // future use — not displayed in current UI
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

## Service

```typescript
// frontend/src/app/services/organization.service.ts
// Injectable({ providedIn: 'root' })

getAll(): Observable<Organization[]>
getById(orgId: string): Observable<Organization>
create(body: CreateOrganizationBody): Observable<Organization>
update(orgId: string, body: UpdateOrganizationBody): Observable<Organization>
delete(orgId: string): Observable<void>
```

All methods prepend `environment.api.baseUrl + '/organizations'`. The `authInterceptor` attaches the Bearer token to every request automatically.

## Form Validation Rules

1. `name` must be non-empty after trimming — enforced by disabling the save button.
2. `address` must be non-empty after trimming — enforced by disabling the save button.
3. No inline error messages are shown (silent disable). This is a known UX gap — see Known Gaps.

## Component Test Matrix

| # | Test | Trigger / State | Expected DOM behavior |
|---|---|---|---|
| 1 | Shows loading spinner on init | `getAll()` pending | spinner visible; table and error absent |
| 2 | Renders org table on success | `getAll()` returns 2 orgs | table rows show correct name, address, formatted date |
| 3 | Shows empty state | `getAll()` returns `[]` | "No organizations yet" message visible; table absent |
| 4 | Shows error alert on load failure | `getAll()` throws | danger alert visible with "Failed to load organizations" |
| 5 | Retry button re-fetches | Click Retry in error state | `getAll()` called a second time |
| 6 | Opens create modal | Click "+ Create Organization" | modal title is "Create Organization"; fields are blank |
| 7 | Opens edit modal pre-populated | Click Edit on a row | modal title is "Edit Organization"; fields contain org values |
| 8 | Save button disabled when fields blank | Clear name in modal | Save button has `disabled` attribute |
| 9 | Create — valid submit calls service | Fill fields, click Create | `create()` called with `{ name, address }`; modal closes; list refreshes |
| 10 | Edit — valid submit calls service | Edit name, click Save Changes | `update()` called with new name; modal closes; list refreshes |
| 11 | Save shows spinner while saving | Click save, API pending | spinner inside save button visible |
| 12 | Opens delete modal | Click Delete on a row | delete modal visible with org name in bold |
| 13 | Confirm delete calls service | Click Delete in confirm modal | `delete()` called with correct `org_id`; modal closes; list refreshes |
| 14 | Backdrop click closes create/edit modal | Click backdrop | modal hidden |
| 15 | Backdrop click closes delete modal | Click backdrop | delete modal hidden |

## Guard / Role Test Matrix

| Role | Expected behavior |
|---|---|
| WebAdmin | Route activates — component renders |
| OrgAdmin | `roleGuard` redirects to `/unauthorized` |
| Manager | `roleGuard` redirects to `/unauthorized` |
| Employee | `roleGuard` redirects to `/unauthorized` |
| Unauthenticated | `authGuard` triggers `auth.login()` |

## Known Gaps (to address)

- [ ] **No component tests** — `organizations.component.spec.ts` does not exist
- [ ] **No service tests** — `organization.service.spec.ts` does not exist
- [ ] **`ChangeDetectionStrategy.OnPush` not set** — component should declare `changeDetection: ChangeDetectionStrategy.OnPush`
- [ ] **`ngModel` used instead of Signals or reactive forms** — `formName` and `formAddress` are plain class properties; project convention requires Signals or reactive forms
- [ ] **No `data-testid` attributes** — template has no `data-testid` on buttons, inputs, or status elements, making ATL tests harder to write correctly
- [ ] **No inline form error messages** — validation silently disables the button; user gets no feedback about which field is missing
- [ ] **Edit/delete API errors are silent** — save errors clear the spinner but show no feedback in the modal
