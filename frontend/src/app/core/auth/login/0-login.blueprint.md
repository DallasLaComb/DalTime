# Spec: Custom Login & Force Change Password

## Overview
Replace the Cognito Hosted UI redirect with a custom login page and force-change-password page. Users sign in with email + password directly in the app. When a user is created by a web-admin with a temporary password, Cognito returns a `NEW_PASSWORD_REQUIRED` challenge — the force-change-password page handles that. This gives full UI control while keeping Cognito as the identity provider.

## Role Scope
Public — no auth required. All roles use the same login flow.

## Routes
- `/login` — custom sign-in form (public)
- `/change-password` — force change temporary password (public, only reachable via login challenge)

## Architecture Changes

### Remove `angular-auth-oidc-client`
The OIDC library is replaced entirely. Auth is handled via direct Cognito SDK calls (`InitiateAuth`, `RespondToAuthChallenge`, `GetUser`). Tokens are stored in `sessionStorage` (not `localStorage` — important for shared computers).

### AuthService rewrite
- `initialize()` — check `sessionStorage` for existing tokens, validate expiry, hydrate state
- `login(email, password)` — call `InitiateAuth` with `USER_PASSWORD_AUTH`, handle `NEW_PASSWORD_REQUIRED` challenge
- `completeNewPassword(newPassword)` — call `RespondToAuthChallenge` with `NEW_PASSWORD_REQUIRED`
- `logout()` — clear `sessionStorage`, clear state, redirect to Cognito `/logout` to kill session cookie
- Token storage: `accessToken`, `idToken`, `refreshToken` in `sessionStorage`
- Role extraction: same as current (decode access token → `cognito:groups`)

### Auth interceptor
- Read access token from `AuthService` directly instead of `OidcSecurityService`

### Auth guard
- Check `AuthService.isAuthenticatedSignal()` — if false, redirect to `/login` instead of triggering Hosted UI

### Cognito User Pool Client
- Add `ALLOW_USER_PASSWORD_AUTH` to `ExplicitAuthFlows` in `infra/foundation.yaml`

## UI Behavior

### Login Page (`/login`)
- Email + password form, centered card layout
- "Sign In" button with loading spinner
- Error messages: invalid credentials, user not found, generic error
- On success: store tokens, extract role, navigate to role dashboard
- On `NEW_PASSWORD_REQUIRED`: store challenge session, navigate to `/change-password`

### Force Change Password Page (`/change-password`)
- New password + confirm password form, centered card layout
- "Set Password" button with loading spinner
- Validation: passwords must match, minimum length
- On success: store tokens, extract role, navigate to role dashboard
- If accessed without a pending challenge: redirect to `/login`

## API Calls (Cognito SDK — client-side)
| Method | SDK Command | When | Response |
|---|---|---|---|
| Sign in | `InitiateAuth` (`USER_PASSWORD_AUTH`) | Login form submit | Tokens or challenge |
| Complete challenge | `RespondToAuthChallenge` (`NEW_PASSWORD_REQUIRED`) | Change password submit | Tokens |
| Get user attributes | `GetUser` | After successful auth | User attributes |

## Component Test Matrix

### Login
| Test | Action / State | Expected DOM behavior |
|---|---|---|
| Renders login form | on load | email input, password input, sign in button visible |
| Shows error on invalid credentials | wrong password | error alert visible |
| Shows loading state | form submitted | spinner visible, button disabled |
| Navigates to dashboard | successful auth | router.navigate called with role dashboard |
| Navigates to change-password | NEW_PASSWORD_REQUIRED | router.navigate called with /change-password |

### Force Change Password
| Test | Action / State | Expected DOM behavior |
|---|---|---|
| Renders form | on load with pending challenge | new password + confirm inputs visible |
| Redirects to login | no pending challenge | router.navigate to /login |
| Shows mismatch error | passwords don't match | error message visible |
| Shows loading state | form submitted | spinner visible, button disabled |
| Navigates to dashboard | successful password change | router.navigate called with role dashboard |

## Guard / Role Test Matrix
| Role | `/login` | `/change-password` |
|---|---|---|
| Unauthenticated | allowed | allowed (with challenge) |
| Any authenticated role | redirect to dashboard | redirect to dashboard |
