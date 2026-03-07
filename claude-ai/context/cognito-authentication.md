---
topic: Cognito Authentication & RBAC
project: shift-scheduler
created: 2026-02-23
status: draft
---

## Purpose / Goal

Implement role-based authentication and authorization across the full stack using AWS Cognito. Every API call and UI route must be gated by the caller's role and org scope. This is the security foundation — every other feature depends on it.

## Scope

**In-scope:**
- Cognito User Pool custom attributes, groups, and App Client configuration
- Frontend OIDC flow (login, logout, token management)
- Angular route guards protecting feature areas by role
- Angular HTTP interceptor injecting Bearer tokens on all API calls
- API Gateway Lambda authorizer validating Cognito JWTs and enforcing org/role scoping
- Role-based redirect after login to the correct feature area

**Out-of-scope:**
- The business logic inside each feature area (scheduling, availability, shift swaps)
- DynamoDB table schemas
- Email/notification delivery
- MFA configuration

## Current State

- Angular 21 frontend using `angular-auth-oidc-client` v21 implements OIDC authorization code flow
- `app.config.ts` configures the OIDC provider; `app.ts` handles login, logout, `GetUser`, `UpdateUserAttributes`, and group extraction from the ID token
- App clears local tokens on every login call to force fresh token + scope acquisition
- Cognito User Pool manually created and configured in dev; User Pool ID, Client ID, Region, and Domain are in GitHub Secrets as `VITE_COGNITO_*` variables
- Environment files use Vite build-time placeholder replacement — Cognito config is injected by CI via `sed`
- **No auth guards exist** — all routes are currently unprotected
- **No HTTP interceptor exists** — tokens are not injected on API calls
- **No Lambda authorizer exists** — the API Gateway is open
- Feature directories (`/features/web-admin`, `/features/org-admin`, `/features/manager`, `/features/employee`) are scaffolded but empty
- `/core/` directory is empty — intended for guards, interceptors, auth service
- Backend SAM template has one test Lambda and no Cognito or authorizer resources
- qa and prod User Pools do not yet exist

## Desired State

- All 4 roles can log in through the Cognito hosted UI and land on their role-specific feature area
- Angular route guards redirect unauthenticated or unauthorized users
- All HTTP requests to the API include the Cognito access token as a Bearer token automatically
- API Gateway rejects requests with invalid or missing JWTs (401) and valid requests outside the caller's org scope (403)
- Lambda authorizer decodes and validates the JWT, then passes `user_type` and `org_id` to downstream Lambda handlers via the request context
- Custom attributes (`custom:user_type`, `custom:org_id`, `custom:manager_id`) are correctly populated on user accounts and readable from the token

## Constraints

- **Auth provider:** AWS Cognito only — no third-party auth libraries on the backend
- **Login UI:** Cognito hosted login page — no custom Angular login form
- **Frontend:** Angular 21, standalone components, `angular-auth-oidc-client` v21
- **Backend:** Node.js 24.x Lambda (ESM), AWS SAM, HTTP API Gateway (not REST API)
- **Org scoping:** Every non-WebAdmin user is strictly limited to their own org's data at the API layer — the Lambda authorizer enforces this, not individual Lambda handlers
- **Token flow:** Authorization code flow only
- **Authorizer claims:** The Lambda authorizer must not make DynamoDB calls — authorization decisions rely solely on JWT claims
- **User Pool:** Manually provisioned (not in SAM template) for now

## Non-Goals / Anti-Requirements

- No custom login form — Cognito hosted UI handles all credential entry
- No role hierarchy — each role is discrete; a Manager is not also an Employee
- No silent token refresh — `silentRenew: false`; users re-authenticate when tokens expire
- WebAdmin has no `org_id` — do not apply org scoping logic to WebAdmin

## Key Domain Concepts / Glossary

| Term | Meaning |
|---|---|
| **WebAdmin** | Platform developer/maintainer. Manages all organizations. No org scope. |
| **OrgAdmin** | Org-level admin. Created by a WebAdmin only. Manages managers and employees within their org. Multiple OrgAdmins per org allowed. |
| **Manager** | Invited by an OrgAdmin. Creates schedules, sets availability requirements, invites employees, gets notified of shift swaps. |
| **Employee** | Invited by a Manager. Views schedule, submits availability, requests shift swaps. |
| **org_id** | `custom:org_id` on Cognito. Present on all users except WebAdmin. Ties a user to one organization. |
| **manager_id** | `custom:manager_id` on Cognito. Present on employees only. Stores the UUID of the Manager who invited them. Set at invite time, not modifiable by the employee. |
| **user_type** | `custom:user_type` on Cognito. One of: `WebAdmin`, `OrgAdmin`, `Manager`, `Employee`. Primary claim used by the Lambda authorizer. |
| **Cognito Groups** | JWT claim `cognito:groups`. Each user is in the group matching their role. |
| **Hosted UI** | Cognito's self-managed login page. App redirects to it; Cognito redirects back to `/sso` with an auth code. |
| **Lambda Authorizer** | Lambda attached to API Gateway. Validates the JWT and injects `user_type`/`org_id` into the Lambda request context. |
| **Org Scope** | Constraint that a non-WebAdmin user can only read/write data for their own `org_id`. Enforced by the authorizer, not individual handlers. |

## Relevant Architecture / Components

```
User → CloudFront → S3 (Angular app)
           ↓
       Cognito Hosted UI  (OIDC authorization code flow)
           ↓
       Angular app  (holds access token + ID token)
           ↓
       HTTP Interceptor  (attaches Bearer token to every API call)
           ↓
       API Gateway (HTTP API)
           ↓
       Lambda Authorizer
         - Validates JWT against Cognito JWKS endpoint
         - Extracts custom:user_type, custom:org_id
         - Injects claims into Lambda request context
           ↓
       Lambda Handler (Node.js)
         - Reads user_type, org_id from request context
         - Does not re-validate auth
           ↓
       DynamoDB
```

**Token usage:**
- Access token — `aws.cognito.signin.user.admin` scope enables `GetUser`/`UpdateUserAttributes` calls from the frontend
- ID token — `cognito:groups` claim used by frontend for role detection and post-login routing
- Both tokens contain `custom:user_type`, `custom:org_id`, `custom:manager_id` (employees only)

## Important Files, Folders, and Entry Points

| Path | Purpose |
|---|---|
| `frontend/src/app/app.ts` | OIDC login/logout, GetUser, token extraction, group detection |
| `frontend/src/app/app.config.ts` | OIDC provider configuration (authority, redirect URLs, scopes) |
| `frontend/src/app/app.routes.ts` | Routing — guards go here |
| `frontend/src/environments/environment.ts` | Dev Cognito config (Vite placeholders, replaced at build time) |
| `frontend/src/app/core/` | Empty — target location for `AuthGuard`, `AuthInterceptor`, `AuthService` |
| `frontend/src/app/features/{role}/` | Empty — one directory per role |
| `backend/template.yaml` | SAM template — Lambda authorizer resource goes here |
| `.github/workflows/deploy.yml` | CI/CD — `VITE_COGNITO_*` vars injected here at build time |

## External Dependencies and Integrations

- **`angular-auth-oidc-client` v21** — handles OIDC flow, token storage, callback detection. Misconfiguration produces silent auth failures.
- **`@aws-sdk/client-cognito-identity-provider` v3** — used for `GetUser` and `UpdateUserAttributes`. Requires valid access token with `aws.cognito.signin.user.admin` scope; no IAM credentials needed.
- **Cognito JWKS endpoint** — `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json` — Lambda authorizer fetches public keys here to verify JWTs. Must be reachable from Lambda; should be cached.
- **Cognito Hosted UI** — callback URL (`/sso`) must be registered on the App Client exactly (protocol + domain + path).
- **API Gateway HTTP API** — not REST API. Authorizer behavior and error response formats differ from REST API.

## Known Pitfalls / Gotchas / Failure Modes

- **`aws.cognito.signin.user.admin` scope** must be explicitly allowed on the App Client under OAuth 2.0 scopes. If missing, `GetUser` returns 401 with no useful error message.
- **`logoffLocal()` before `authorize()`** in `app.ts` is intentional. It forces fresh token acquisition. Removing it causes stale tokens without required scopes to be reused silently.
- **Custom attributes need explicit read/write permission on the App Client.** Defining them on the User Pool is not enough — check each `custom:*` attribute under App Client → Read/Write attributes.
- **Custom attributes always carry the `custom:` prefix** when read from the token or via `GetUser` (e.g., `custom:org_id`, not `org_id`).
- **HTTP API Lambda authorizer type matters** — a JWT authorizer (built-in) is simpler but does not pass custom claims downstream to Lambda handlers. If handlers need `user_type`/`org_id` from context, a REQUEST-type Lambda authorizer is required.
- **JWKS caching** — fetching the JWKS endpoint on every authorizer invocation adds ~200 ms and risks Cognito rate limits. Cache it in the Lambda execution context (module-level variable).
- **`/sso` route** is the OIDC callback path. It must match the registered callback URL in the App Client exactly, including trailing slash if present.
- **Silent renew is disabled** — no background token refresh; users must re-login when tokens expire.

## Decisions Already Made + Rationale

| Decision | Rationale | Rejected Alternatives |
|---|---|---|
| AWS Cognito | Entire stack is serverless AWS; no server to run a custom auth service | Auth0, Firebase Auth — added cost and external dependency |
| Cognito Hosted UI | No credentials UI to build or maintain, Cognito handles password policy | Custom Angular login form — more work, more attack surface |
| Authorization code flow | Tokens never appear in the URL | Implicit flow — deprecated, tokens in URL |
| `custom:user_type` + Cognito Groups in JWT | Authorizer can check role without a DB call | DynamoDB lookup in authorizer — extra latency, extra failure point |
| `custom:manager_id` on Employee's Cognito account | Direct lookup, no join needed | Separate DynamoDB relation — extra query per request |
| Org scoping in Lambda authorizer | Centralized enforcement — individual handlers don't each re-implement it | Per-handler scoping — error-prone, easy to miss in new handlers |
| `manager_id` set at invite time by Manager | Manager invites Employee → Employee's account is created with Manager's UUID as `manager_id` | OrgAdmin assigns manager — extra step, more coordination |

## Acceptance Criteria / Success Metrics

- WebAdmin logs in → lands on `/web-admin` → can read data across all orgs → no `org_id` on their token
- OrgAdmin logs in → lands on `/org-admin` → API returns only their org's data → request targeting another org's resource returns 403
- Manager logs in → lands on `/manager` → can invite employees → cannot reach `/org-admin` or `/web-admin` routes
- Employee logs in → lands on `/employee` → sees own schedule only → cannot read another employee's data
- Unauthenticated navigation to any protected route redirects to Cognito login
- Navigation to a route outside the user's role redirects to an unauthorized page
- API Gateway with missing or invalid JWT returns 401
- API Gateway with valid JWT but wrong org returns 403
- `custom:org_id`, `custom:user_type` present on all non-WebAdmin tokens; `custom:manager_id` present on Employee tokens

## Open Questions

1. **IaC for User Pool** — Should the Cognito User Pool be added to the SAM template for qa/prod, or remain manually provisioned? Blocker: whether IaC-managed user pool fits the manual invite/admin-create workflow.
2. **qa/prod User Pools** — Need to be created before those environments can be deployed. Blocked by question 1.
3. **OrgAdmin account creation** — When a WebAdmin creates an OrgAdmin, how is the Cognito account provisioned? (`AdminCreateUser` Lambda called from the WebAdmin dashboard? Manual console action?)
4. **Manager account creation** — Same question for OrgAdmin creating a Manager.
5. **Deleted manager** — If a Manager is removed from the org, what happens to employees whose `custom:manager_id` points to that Manager's UUID? Is reassignment required?
6. **HTTP API authorizer type** — Built-in JWT authorizer (simpler, no Lambda) vs. REQUEST-type Lambda authorizer (required if handlers need `user_type`/`org_id` in request context). Decision needed before backend implementation begins.

## Revision Notes
