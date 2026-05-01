You are writing Robot Framework E2E tests for DalTime.

## Rules

- **Always use token-based auth** via the `Login With Tokens` keyword from `resources/auth.robot` for Suite Setup. Never use UI login for non-auth tests.
- **Never use Sleep.** Use `Wait For Elements State`, `Wait Until Keyword Succeeds`, or `Wait For Load State` instead.
- **Always use `data-testid` attributes** to locate elements. Use the format `[data-testid="element-name"]`. Never locate by CSS class, tag name alone, or XPath.
- **Use `text=` selectors** only for clicking nav links or buttons where `data-testid` is not available.
- **Suite Teardown** must always include `Close Browser`.

## File Structure

```
robot/
├── resources/
│   ├── env.robot             # Environment variables (BASE_URL, credentials, HEADLESS, SLOW_MO)
│   ├── auth.robot            # Login Via UI, Login With Tokens keywords
│   └── cognito_auth.py       # Python helper for Cognito InitiateAuth
└── tests/
    ├── auth/                 # Login UI tests (only suite that uses Login Via UI)
    └── <role>/               # Role-specific test suites (web-admin, org-admin, manager, employee)
```

## Test Template

```robot
*** Settings ***
Documentation    <Description of what this suite tests>.
Library          Browser
Resource         ../../resources/auth.robot

Suite Setup      Login With Tokens
Suite Teardown   Close Browser

*** Test Cases ***
<Test Name>
    [Documentation]    <What this test verifies>.
    <steps using data-testid selectors>
    Wait For Elements State    [data-testid="element"]    visible    timeout=10s
```

## Waiting Patterns

- **Wait for element to appear:** `Wait For Elements State    [data-testid="x"]    visible    timeout=10s`
- **Wait for element to disappear:** `Wait For Elements State    [data-testid="x"]    hidden    timeout=10s`
- **Wait for URL change:** `Wait For Elements State    [data-testid="page-heading"]    visible    timeout=10s` then `Get Url    contains    /expected-path`
- **Wait for dynamic content:** Use `Wait Until Keyword Succeeds    10s    500ms    <Custom Keyword>` with a helper keyword that asserts the condition.
- **After navigation:** `Wait For Load State    networkidle` then assert on a `data-testid` element.

## Variables Available

- `${BASE_URL}` — environment base URL
- `${WEB_ADMIN_EMAIL}` — test user email
- `${WEB_ADMIN_PASSWORD}` — test user password
- `${HEADLESS}` — true in CI, false locally
- `${SLOW_MO}` — 500ms locally, 0ms in CI
- `${COGNITO_REGION}` — Cognito region
- `${COGNITO_CLIENT_ID}` — Cognito app client ID

## Conventions

- One test file per feature area (e.g. `tests/web-admin/organizations.robot`)
- Test names should be descriptive sentences
- Use `[Documentation]` on every test case
- Check both mobile (card) and desktop (table) layouts using `data-testid` selectors that exist in both views (e.g. `[data-testid="org-row"]`)
