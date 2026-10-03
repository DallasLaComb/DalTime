# Web-Admin Profile Page

## What it is

The Web-Admin Profile page lets a logged-in Web-Admin view and edit their own account details. It is accessible at `/web-admin/profile` and is protected so only users in the `WebAdmin` Cognito group can reach it.

## What it shows

When the page loads it fetches the authenticated web-admin's profile from the backend (`GET /web-admin/profile`) and displays:

- **Email** — read-only; the web-admin's account email address.
- **First Name** — editable.
- **Last Name** — editable.
- **Phone** — displayed as "—" because web-admin accounts have no phone field.

A "Dashboard" button in the header navigates back to `/web-admin`.

## Editing

Clicking "Edit" opens an inline edit form pre-populated with the current first and last name. The user can change either or both fields and click "Save". The form validates that neither field is blank before submitting. On success, the form closes and the updated name is displayed. On failure, an inline error message is shown and the form stays open so the user can retry.

## How it fits into the app

The page reuses the shared `<app-profile-page>` component for its layout and form logic, and extends `ProfileComponentBase` for loading/saving/error state management — the same pattern used by the Manager and Employee profile pages. The web-admin-specific difference is that the backend response has no `phone` field, so the service maps it to an empty string before passing data to the shared component.

The global navbar automatically computes the profile link as `/web-admin/profile` for users whose role is `WebAdmin`, so no additional nav change is needed.
