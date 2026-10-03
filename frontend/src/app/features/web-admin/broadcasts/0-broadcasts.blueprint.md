# Broadcast Notifications (Frontend) — Blueprint

Issue: [#9](https://github.com/DallasLaComb/DalTime/issues/9). Backend + data design:
`backend/src/functions/web-admin/broadcasts/0-broadcasts.blueprint.md` (decisions D1–D5 live there).

Status: **Approved 2026-09-29** (see backend blueprint for the decisions as approved).

## 1. Summary

Two pieces:

1. **Compose page** (WebAdmin) at `/web-admin/broadcasts` — write a banner message, pick severity,
   target (all users / one org / one org + role), optional expiry, and send. The same page lists
   active broadcasts with a "Take down" action.
2. **Broadcast banner** (every signed-in role, WebAdmin included) — a shared component rendered in the app shell between the
   navbar and `<main>`, showing the highest-priority active, non-dismissed broadcast, with a dismiss
   button.

## 2. Types

All request/response types come from the generated contract via `ApiSchema<'…'>` — no hand-written
interfaces: `CreateBroadcastBody`, `BroadcastResponse`, `ActiveBroadcastListResponse`.

## 3. Compose page — `features/web-admin/broadcasts/`

```
broadcasts.service.ts   # WebAdminBroadcastsService — ApiClient: create, listActive, remove
broadcasts.ts           # standalone, OnPush, signals
broadcasts.html         # Tailwind only
broadcasts.spec.ts
```

- Route in `app.routes.ts`: `web-admin/broadcasts`, `canMatch: [authGuard, roleGuard]`,
  `data: { roles: ['WebAdmin'] }` — placed before the `web-admin` catch-all entry.
- Entry points: a card on `web-admin-dashboard.html` and a navbar link alongside the other WebAdmin links.
- Form (signals, not reactive-forms `BehaviorSubject`s):
  - `message` — `<textarea>` with live `n / 500` counter.
  - `severity` — Info / Warning / Critical.
  - `target` — radio: All users / One organization / One role in an organization.
  - `org` — `<select>` populated from the existing `services/organization.service.ts` list; shown for the org targets.
  - `role` — `<select>` OrgAdmin / Manager / Employee; shown for the org+role target.
  - `expires_at` — optional `datetime-local`, converted to ISO UTC; must be in the future.
  - Live **preview** of the banner using the same `<app-broadcast-banner>` presentation in preview mode.
- Every `<label>` has `for` → matching `id`; every control has `data-testid`.
- Submit via `<app-button>` (disabled while invalid or submitting). Success → toast-style confirmation
  and form reset; backend 400 → `<app-error-alert>` with the message.
- Page chrome: `<app-loading-spinner>`, `<app-empty-state>`, `<app-error-alert>`, `<app-confirmation-modal>` (take down) from `@common-daltime`.

## 4. Banner — `shared/components/broadcast-banner/`

```
broadcast-banner.ts     # presentational: input broadcast, input canDismiss, output dismissed
broadcast-banner.html   # root element has class="dt-debug"
broadcast-banner.spec.ts
```

Exported from `shared/components/index.ts` (`@common-daltime`).

State lives in a root service, `shared/broadcasts/broadcasts.service.ts`:

- `active = signal<BroadcastResponse[]>([])`; `current = computed(() => active()[0] ?? null)`
  (backend already sorts by priority).
- Path per effective role, literal-typed like `NOTIFICATIONS_PATH` in `notifications.service.ts`:
  `/{web-admin|org-admin|manager|employee}/broadcasts/active`. WebAdmins (not impersonating) get `ALL`
  broadcasts only.
- **Refresh triggers:** on login / effective-role change (an `effect` on
  `impersonationService.viewingAs()?.role ?? authService.roleSignal()`), on every `NavigationEnd`
  (throttled to once per 60 s), and every 5 min while `document.visibilityState === 'visible'`.
  Satisfies "next page load/poll" without hammering the 10 rps API throttle.
- **Dismiss:** optimistic — remove from `active` immediately, then
  `PUT /{role}/broadcasts/{broadcastId}/dismissal`; on failure restore it and log via `LoggerService`.
- After sending or taking down a broadcast, the composer calls `refreshCurrent()` so the WebAdmin's own
  banner updates immediately.
  The next broadcast in the list (if any) shows immediately.
- **Impersonating:** `canDismiss = false` (the backend rejects writes under impersonation; the
  WebAdmin should see the banner exactly as the user does without altering their state).

`app.ts` / `app.html`: import the banner, render `@if (broadcasts.current(); as b) { <app-broadcast-banner … /> }`
between `<app-navbar />` and `<main>`.

Presentation: full-width strip, Tailwind colour by severity (sky / amber / red, with dark-mode variants
matching existing tokens), severity icon, message text, dismiss `<app-button variant="ghost">` with
`aria-label="Dismiss announcement"`. `role="status"` for INFO/WARNING, `role="alert"` for CRITICAL.
Message is rendered as text (Angular interpolation), never `innerHTML`.

## 5. Tests

- `broadcasts.spec.ts` (compose): org/role fields show/hide per target; submit disabled while invalid;
  past expiry rejected; correct body per target; 400 surfaces in `<app-error-alert>`.
- `broadcast-banner.spec.ts`: renders message + severity styling; dismiss emits `dismissed`;
  dismiss button hidden when `canDismiss` is false; root has `dt-debug`.
- `broadcasts.service.spec.ts` (shared): correct path per role (incl. WebAdmin); no request when signed
  out; impersonated role + dismiss disabled; optimistic dismiss + rollback on error.
- Optional e2e (`e2e/`): WebAdmin sends org-wide broadcast → employee of that org sees banner → dismiss
  → reload → gone.

## 6. Out of scope

Rich text / links, scheduling a future start time, per-location targeting, surfacing broadcasts in
the `/notifications` inbox.
