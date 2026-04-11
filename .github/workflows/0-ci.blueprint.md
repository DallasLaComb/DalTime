# Blueprint: CI Workflow

## Overview
Continuous Integration pipeline that runs on every push to `dev`. Validates the codebase by running frontend and backend tests in parallel, builds deployable artifacts, and uploads them for CD to consume. CI only runs on `dev` — QA and main environments promote from the last successful dev artifacts without rebuilding or retesting.

## Trigger
- **Event:** `push`
- **Branch:** `dev` only

## Permissions
- `contents: read` — clone the repo
- `security-events: write` — CodeQL uploads results to the GitHub Security tab

## Jobs

### 1. Frontend Tests (`frontend`)
Runs Angular unit tests and produces a deployable build artifact.

| Step | What it does |
|---|---|
| Checkout | Clones the repo |
| Setup Node.js 24 | Installs Node and caches npm deps using `frontend/package-lock.json` |
| Install dependencies | `npm ci` — clean install from lockfile for reproducible builds |
| Run unit tests | `npm test` — executes Vitest against all `*.spec.ts` files via Angular's test builder |
| Build Angular app | `npm run build` — compiles with placeholder values (`__API_BASE_URL__`, `__VITE_COGNITO_*`) that CD replaces per environment |
| Upload artifact | Uploads `frontend/dist/frontend/browser/` as `frontend-build` (7-day retention) |

**Key behavior:** The build uses placeholders instead of real environment values. This allows the same artifact to be deployed to dev, qa, and main — CD does a `sed` replacement at deploy time.

### 2. Backend Tests (`backend`)
Runs Lambda unit and integration tests, then builds the SAM application.

| Step | What it does |
|---|---|
| Checkout | Clones the repo |
| Setup Node.js 24 | Installs Node and caches npm deps using `backend/package-lock.json` |
| Install dependencies | `npm ci` — clean install from lockfile |
| Run unit tests | `npm test` — runs tests from `backend/test/unit/` (no network, no AWS) |
| Run integration tests | `npm run test:integration` — runs tests from `backend/test/integration/` |
| Setup SAM CLI | Installs the AWS SAM CLI |
| Build SAM application | `sam build --template-file ../infra/template.yaml` — compiles Lambda functions. Adds `node_modules/.bin` to PATH so SAM can find esbuild |
| Upload artifact | Uploads `backend/.aws-sam/build/` as `sam-build` (7-day retention) |

**Key behavior:** The SAM template lives in `infra/template.yaml`, not inside `backend/`. The build runs from the `backend/` working directory but references the template one level up.

### 3. CodeQL Security Scan (`codeql`)
Static analysis for security vulnerabilities in TypeScript/JavaScript.

| Step | What it does |
|---|---|
| Checkout | Clones the repo |
| Initialize CodeQL | Sets up the JavaScript/TypeScript analyzer |
| Autobuild | Lets CodeQL detect and build the project automatically |
| Analyze | Runs the scan and uploads results to GitHub Security tab |

**Key behavior:** This job runs in parallel with frontend and backend tests. It does not block CD — it's informational. Results appear under the repo's Security → Code Scanning tab.

## Artifacts Produced

| Artifact | Contents | Used by |
|---|---|---|
| `frontend-build` | Compiled Angular app with placeholder env values | CD (all environments) |
| `sam-build` | Compiled SAM/Lambda build output | CD (all environments) |

Both artifacts have a 7-day retention. CD downloads these artifacts by run ID — the same build that passed CI is what gets deployed. No rebuild ever happens on promotion to qa or main.

## What This Workflow Does NOT Do
- Does not deploy anything — that's CD's job
- Does not run E2E tests — those run after CD deploys
- Does not run on qa or main branches — those environments promote from dev artifacts
- Does not fail if CodeQL finds issues — CodeQL is soft/informational
