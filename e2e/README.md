# DalTime E2E / Smoke Suite

Post-deploy smoke tests for all three DalTime environments (dev, qa, prod).

## Seeded test user roster

All test users are created by `backend/scripts/seed-dev.mjs` — that file is the
source of truth for email addresses, names, and the seed organisation structure.
The same users must exist in the Cognito User Pool for **each environment** (dev,
qa, prod) before the suite can pass there.

| Role     | Email                           | Org / Notes                                                    |
| -------- | ------------------------------- | -------------------------------------------------------------- |
| WebAdmin | `robot-dev@daltime.com`         | Dedicated CI robot account — NOT `dallaslacombdrive@gmail.com` |
| OrgAdmin | `alex.admin@sunsetcafe.dev`     | Seed org: Sunset Cafe (`seed-org-sunsetcafe-001`)              |
| Manager  | `morgan.manager@sunsetcafe.dev` | Assigned to Main Street and Riverside locations                |
| Employee | `sam.smith@sunsetcafe.dev`      | Tier 4, 5-day full availability — most stable for smoke tests  |

**Shared password:** stored in GitHub Actions secret `E2E_SEED_USER_PASSWORD`.
Never hardcode this value in source code or CI YAML.

### Seeding requirement for qa and prod

The seed script (`backend/scripts/seed-dev.mjs`) targets the dev Cognito User Pool.
Before the smoke suite can run against qa or prod, the same user set must be seeded
into those pools. This is a prerequisite for devops-agent to document and fulfil
before enabling the post-deploy step on the qa and main branches in `cd.yml`.

Until those pools are seeded, the CD post-deploy step must be conditioned to skip
on qa/prod (or those environments must be seeded first).

## Required GitHub Actions secrets and variables

These are the **exact names** that devops-agent must wire into the post-deploy step
of `.github/workflows/cd.yml`. Values are environment-specific and must be stored
as Actions secrets or environment variables — never hardcoded.

| Name                     | Type               | Description                                                                                 |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| `FRONTEND_BASE_URL`      | variable or secret | CloudFront domain, e.g. `https://dev.daltime.com`                                           |
| `API_BASE_URL`           | variable or secret | API Gateway invoke URL (no trailing slash)                                                  |
| `COGNITO_CLIENT_ID`      | variable or secret | Cognito App Client ID (from foundation stack outputs)                                       |
| `COGNITO_USER_POOL_ID`   | variable or secret | Cognito User Pool ID (from foundation stack outputs)                                        |
| `COGNITO_REGION`         | variable           | AWS region, e.g. `us-east-1`                                                                |
| `E2E_SEED_USER_PASSWORD` | **secret**         | Shared password for all seeded test users — must be a GitHub secret, never a plain variable |

The `API_BASE_URL` and Cognito values are already resolved as outputs of the SAM
deploy step in `cd.yml` — devops-agent should capture them from the stack outputs
and pass them as environment variables to the `npm test` step rather than storing
them as static secrets where possible.

## How to run locally against dev

1. Install dependencies:

   ```sh
   cd e2e
   npm install
   ```

2. Export environment variables (substitute real values from the dev stack):

   ```sh
   export FRONTEND_BASE_URL=https://dev.daltime.com
   export API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
   export COGNITO_CLIENT_ID=<client-id>
   export COGNITO_USER_POOL_ID=us-east-1_kzQ806uSv
   export COGNITO_REGION=us-east-1
   export E2E_SEED_USER_PASSWORD=Password!12345
   ```

3. Run the suite:

   ```sh
   npm test
   ```

4. On failure, vitest prints the failing test name, the assertion error message
   (which includes the URL and diagnostic context), and exits with code 1.

## Suite structure

```
e2e/
  package.json          — Node 24, vitest, undici
  tsconfig.json         — strict TypeScript, ESM, NodeNext
  blueprint.md          — what the suite covers, design decisions
  README.md             — this file
  src/
    config.ts           — all process.env reads; throws on missing vars
    auth.ts             — getCognitoToken() — USER_PASSWORD_AUTH headless flow
    tests/
      smoke.test.ts     — all 7 smoke checks
```

## CI/CD placement

- **Unit and integration tests** run in the CI workflow on every PR (see
  `backend/package.json` scripts). The E2E suite does NOT run on PRs.
- **E2E smoke tests** run in a `post-deploy` job in `cd.yml` after every successful
  deploy to dev, qa, and prod. See devops-agent sub-issue #280 for the exact
  `cd.yml` wiring.
- **The suite must never run against a local SAM-local instance** — only against
  deployed environments with real Cognito User Pools.
- **The suite must never run against real organisations' data.** All calls target
  the seeded synthetic test users and the seed org (`seed-org-sunsetcafe-001`) only.
