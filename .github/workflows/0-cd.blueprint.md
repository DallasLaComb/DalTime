# Blueprint: CD Workflow

## Overview
Continuous Deployment pipeline that deploys the full stack (backend + frontend) to dev, qa, or main. After a successful deploy, runs Robot Framework E2E tests on dev and qa. The core principle is **build once, deploy many** — artifacts are built in CI on dev and promoted through environments without rebuilding.

## Trigger
- **Event:** `push`
- **Branches:** `dev`, `qa`, `main`

## Concurrency
- **Group:** `cd-<branch>` — only one CD run per branch at a time
- **Cancel in-progress:** yes — a new push cancels any running CD for that branch

## Permissions
- `id-token: write` — OIDC authentication with AWS
- `contents: read` — clone the repo
- `actions: read` — query workflow runs to find artifacts
- `deployments: write` — create GitHub deployment records
- `statuses: write` — update deployment status

## Promotion Model

```
dev push → CI runs → CI artifacts built → CD deploys to dev → E2E on dev
                                ↓
              PR dev→qa merged → CD deploys CI artifacts to qa → E2E on qa
                                                    ↓
                                  PR qa→main merged → CD deploys qa-verified artifacts to main
```

| Environment | Artifact source | Why |
|---|---|---|
| dev | Current CI run on this exact commit (polls until CI completes) | Ensures only tested code deploys |
| qa | Last successful CI run on dev | Promotes the exact build that passed dev CI |
| main | Last successful CD run on qa → traces back to the CI run it used | Promotes exactly what was deployed and E2E-verified on qa |

## Jobs

### 1. Deploy (`deploy`)

Runs in the GitHub environment matching the branch name (dev/qa/main), which provides environment-specific secrets and variables.

#### Artifact Resolution
Uses `actions/github-script` to determine which CI run to pull artifacts from:

- **dev:** Polls up to 60 attempts (10s apart, ~10 min max) waiting for CI to succeed on the current commit SHA. Fails if CI fails or times out.
- **qa:** Finds the most recent successful CI run on the `dev` branch. Fails if none exists.
- **main:** Finds the most recent successful CD run on `qa`, then traces back to the CI run whose artifacts that qa deployment used. Falls back to the most recent successful dev CI run if SHA matching fails.

#### Checkout
Checks out the exact commit SHA that was built in CI — not the branch HEAD. This ensures the deployed code matches the tested artifacts.

#### AWS Authentication
Uses OIDC via `aws-actions/configure-aws-credentials` with the role ARN from the environment's `AWS_ROLE_ARN` secret. No static credentials stored in GitHub.

#### Backend Deployment (SAM)

| Step | What it does |
|---|---|
| Download SAM artifact | Downloads `sam-build` from the resolved CI run |
| Setup SAM CLI | Installs SAM CLI on the runner |
| Get foundation outputs | Queries `daltime-foundation-<branch>` CloudFormation stack for S3 bucket, CloudFront distribution, Cognito pool/client IDs, Cognito domain/region |
| Deploy SAM stack | `sam deploy` with parameters: `AllowedOrigin`, `CognitoUserPoolId`, `CognitoClientId` from foundation outputs and environment variables |
| Get API URL | Reads `ApiEndpoint` output from the deployed SAM stack |

**Key behavior:** The backend stack depends on the foundation stack. Foundation must be deployed first (via the foundation workflow). SAM deploy uses `--no-fail-on-empty-changeset` so re-deploys with no changes don't fail.

#### Frontend Deployment

| Step | What it does |
|---|---|
| Download frontend artifact | Downloads `frontend-build` from the resolved CI run |
| Replace placeholders | `sed` replaces `__API_BASE_URL__`, `__VITE_COGNITO_*` placeholders in all `.html`, `.js`, and `.txt` files with real values from the SAM stack and foundation outputs |
| Sync to S3 | `aws s3 sync --delete` to the frontend bucket from foundation outputs |
| Invalidate CloudFront | Creates a `/*` invalidation so users get the new version immediately |

**Key behavior:** Placeholder replacement happens on the pre-built artifact — the Angular app is never rebuilt. This is what enables the build-once-deploy-many model.

#### Deployment Record
On success, creates a GitHub Deployment record with status `success` for the environment. This shows deployment history in the repo's Environments tab.

### 2. E2E Tests (`e2e`)

Runs after deploy succeeds. Only runs on dev and qa — main does not run E2E (it was already verified on qa).

| Step | What it does |
|---|---|
| Checkout | Clones the repo for Robot Framework test files |
| Setup Python 3.12 | Installs Python for Robot Framework |
| Install Robot Framework | `pip install -r robot/requirements.txt` then `rfbrowser init` (Playwright browser binaries) |
| Resolve env variables | Sets `base_url`, `web_admin_email`, `cognito_client_id` based on branch |
| Run E2E tests | Executes `robot robot/tests/` with environment-specific variables, headless mode, and Cognito auth credentials |
| Upload results | Uploads Robot Framework results to `robot-results-<branch>` artifact (14-day retention) |

**Environment-specific values:**

| Variable | dev | qa |
|---|---|---|
| `BASE_URL` | `https://dev.daltime.com` | `https://qa.daltime.com` |
| `WEB_ADMIN_EMAIL` | `robot-dev@daltime.com` | `robot-qa@daltime.com` |
| `COGNITO_CLIENT_ID` | dev client ID | qa client ID |

**Key behavior:** The `E2E_WEB_ADMIN_PASSWORD` comes from a GitHub environment secret. The workflow fails fast if it's not set. Tests run headless with `SLOW_MO:0ms` in CI.

## Required GitHub Environment Configuration

Each environment (dev, qa, main) must have:

| Name | Type | Description |
|---|---|---|
| `AWS_ROLE_ARN` | Secret | OIDC IAM role ARN (see `.github/iam/setup-guide.md`) |
| `SAM_STACK_NAME` | Variable | e.g. `daltime-dev` |
| `SAM_S3_BUCKET` | Variable | S3 bucket for SAM deployment artifacts |
| `ALLOWED_ORIGIN` | Variable | Frontend CloudFront URL for CORS headers |
| `E2E_WEB_ADMIN_PASSWORD` | Secret | Password for the Robot Framework test user (dev/qa only) |

Foundation values (S3 bucket name, CloudFront distribution ID, Cognito IDs) are read dynamically from the `daltime-foundation-<branch>` stack outputs — not stored as GitHub variables.

## What This Workflow Does NOT Do
- Does not build anything — artifacts come from CI
- Does not run unit or integration tests — that's CI's job
- Does not run E2E on main — main is promoted from qa which already passed E2E
- Does not deploy foundation infrastructure — that's the foundation workflow's job
