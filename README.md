# DalTime

**Free shift scheduling for nonprofit teams.**

---

## Executive Summary

- **The problem:** Organizations like the YMCA rely heavily on part-time staff. Scheduling dozens of employees across multiple shifts, locations, and availability constraints is a logistical nightmare. Commercial scheduling software costs $3–10+ per user per month, which is out of reach for nonprofits on tight budgets.
- **The solution:** DalTime is a free, open-source shift-scheduling app built for community organizations. It runs on the web and as an iOS/Android app.
- **Why it stays free:** It runs on a fully serverless AWS stack that costs close to nothing when idle and scales automatically as more organizations join, with no servers to patch or capacity to plan. See [ADR-001: Serverless Architecture on AWS](docs/architecture/adr-001-serverless-architecture.md).
- **Who uses it:** One platform serves many organizations. Each has its own Org Admins, Managers, and Employees, and platform Web Admins oversee them all.

## Key Features

- **Multi-organization support:** one platform serves multiple YMCA branches or similar organizations.
- **Hierarchical user management:** Web Admins → Org Admins → Managers → Employees. Each level creates the accounts beneath it, so there is no open self-registration.
- **Availability-driven scheduling:** employees submit availability, managers define the shifts they need, and DalTime generates a draft schedule for review before it is published.
- **Shift swaps and pickups:** employees can post shifts they can't work and pick up open ones.
- **Notifications and announcements:** in-app notifications, plus platform-wide banner announcements (for example, planned maintenance) sent by Web Admins.
- **Web and mobile:** a responsive web app plus native iOS/Android builds via Capacitor.
- **Serverless architecture:** scales automatically with minimal hosting costs.

## User Roles

### Web Admin

Platform-level administrators who manage every organization in DalTime. They can create and manage organizations and their Org Admins, and can **view the app as any user** (read-only impersonation) to troubleshoot. They can also post banner announcements to all users, one organization, or one role within an organization.

### Org Admin

Organization administrators (for example, a YMCA branch director) who manage their own organization. They create manager accounts, manage locations, and have full oversight of every manager and employee in their organization.

### Manager

Managers create accounts for the employees they oversee. Key responsibilities include:

- Defining the shifts that need to be filled, optionally from reusable location schedule templates
- Setting scheduling constraints (e.g., max 8 hours/day, 40 hours/week per employee)
- Generating a schedule from employee availability and shift requirements
- Reviewing and adjusting the generated schedule before publishing it to employees

### Employee

Employees use DalTime to:

- Submit their availability
- View their published schedule (day, week, and month views)
- Post their shifts as available for others to pick up
- Pick up open shifts from other employees

New users receive a temporary password and set their own the first time they sign in.

## Architecture

![DalTime Architecture](docs/architecture/diagram/DalTime%20Architecture.drawio.png)

DalTime is fully serverless on AWS. The Angular front end is served from S3 through CloudFront, calls an API Gateway HTTP API protected by a Cognito JWT authorizer, and is backed by Node.js Lambda functions and a single DynamoDB table. All infrastructure is defined in AWS SAM/CloudFormation.

### Architecture Decision Records

| ADR                                                             | Decision                                                                                                                                                                        | Status   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [ADR-001](docs/architecture/adr-001-serverless-architecture.md) | Serverless architecture on AWS (CloudFront + S3, API Gateway, Lambda, DynamoDB, Cognito, SAM). Chosen to be affordable, low-maintenance, reliable, and scalable without effort. | Accepted |

ADRs live in [`docs/architecture/`](docs/architecture/). Add a new one whenever a decision changes the architecture or rules out a significant alternative.

### Tech Stack

| Layer          | Technology                                                |
| -------------- | --------------------------------------------------------- |
| Frontend       | Angular 21 (standalone components, signals, Tailwind)     |
| Mobile         | Capacitor (iOS and Android)                               |
| Backend        | AWS Lambda (Node.js 24, TypeScript), API Gateway HTTP API |
| Database       | DynamoDB (on-demand, single-table design)                 |
| Authentication | AWS Cognito (user pools, group-based roles)               |
| API contracts  | Zod schemas → OpenAPI (`contracts/`)                      |
| Infrastructure | AWS SAM / CloudFormation                                  |

### Repository Layout

| Path         | Contents                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/`  | Angular app, and the Capacitor iOS/Android projects                                                                                   |
| `backend/`   | Lambda functions as vertical slices (`src/functions/<role>/<feature>/` with handler, service, and db layers) and their tests          |
| `contracts/` | Zod request/response schemas and the generated `openapi.json`, the single source of truth for the API ([README](contracts/README.md)) |
| `infra/`     | SAM template (`template.yaml`) and account foundation stack                                                                           |
| `e2e/`       | Post-deploy smoke tests run against each environment                                                                                  |
| `bruno/`     | Hand-runnable API requests ([README](bruno/README.md))                                                                                |
| `docs/`      | Architecture decisions, data model, logging, and operational guides                                                                   |

### Environments and Deployment

Code moves through three environments, each in its own AWS account. Each environment deploys from the branch of the same name:

| Branch | Environment                                      | How it deploys                                                       |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------- |
| `dev`  | dev ([dev.daltime.com](https://dev.daltime.com)) | Every push runs CI, then deploys to dev and runs smoke tests         |
| `qa`   | qa                                               | A merged `dev` → `qa` PR promotes the last successful dev CI build   |
| `main` | prod                                             | A merged `qa` → `main` PR promotes the build that was verified on qa |

Features are built on branches off `dev` and merged back through pull requests.

## Getting Started

### Prerequisites

You need four things before doing anything else: **Node.js 24+**, **Docker**, **AWS CLI v2**, and **AWS SAM CLI**. Pick your OS below.

<details open>
<summary><strong>macOS</strong></summary>

Install [Homebrew](https://brew.sh) first if you don't have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

The installer prints a "Next steps" block with a `brew shellenv` line. Run it (or open a new terminal) so `brew` is on your `PATH`. Then:

```bash
brew install node@24 awscli aws-sam-cli
brew install --cask docker   # Docker Desktop — launch it once from Applications after install
```

Verify:

```bash
node -v && aws --version && sam --version && docker --version
```

</details>

<details>
<summary><strong>Linux</strong></summary>

```bash
# Node.js 24+ (via nvm — works the same as on macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
\. "$HOME/.nvm/nvm.sh"
nvm install 24

# AWS CLI v2 (use awscli-exe-linux-aarch64.zip on arm64 machines)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# AWS SAM CLI (pipx keeps it isolated from system Python)
python3 -m pip install --user pipx && python3 -m pipx ensurepath
pipx install aws-sam-cli

# Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in after this so `docker` works without sudo
```

Verify:

```bash
node -v && aws --version && sam --version && docker --version
```

</details>

<details>
<summary><strong>Windows</strong></summary>

Native Windows works for the CLIs, but the VS Code tasks in `.vscode/tasks.json` are macOS/Linux shell scripts (Windows task support is on the roadmap). Until then, the easiest path is **WSL2**, then follow the Linux steps above inside it:

```powershell
wsl --install
```

Reboot, set up your Ubuntu user, then reopen VS Code with the [WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) and use the Linux instructions.

If you'd rather stay native (CLIs only, running the "Manual setup" commands below yourself instead of the VS Code tasks):

```powershell
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Amazon.AWSCLI
winget install -e --id Amazon.SAM-CLI
winget install -e --id Docker.DockerDesktop
```

Either way, install Docker Desktop and, if using WSL2, enable WSL2 integration for your distro under Docker Desktop → Settings → Resources → WSL Integration.

</details>

### One-time Account Setup

1. **Configure AWS SSO.** Ask an admin for the SSO start URL and the `daltime-dev` / `daltime-qa` / `daltime-prod` account IDs, then run:

   ```bash
   aws configure sso-session
   # Session name: daltime
   # SSO start URL: <provided by admin>
   # SSO region: us-east-1
   ```

   Repeat `aws configure sso` (or add profiles manually to `~/.aws/config`) for each of the three profiles (`daltime-dev`, `daltime-qa`, `daltime-prod`), attached to the `daltime` SSO session. Verify with:

   ```bash
   aws sso login --sso-session daltime
   aws sts get-caller-identity --profile daltime-dev
   ```

   See [`docs/aws-login.md`](docs/aws-login.md) for the daily login command once this is set up.

2. **Create `backend/env.local.json`.** This file is gitignored (it's per-developer) and tells SAM local which DynamoDB table and Cognito pool each Lambda should use:

   ```bash
   cp backend/env.local.json.example backend/env.local.json
   ```

   Fill in every `<your-dev-user-pool-id>` placeholder with the dev Cognito User Pool ID (`us-east-1_kzQ806uSv`). `TABLE_NAME` is already correct for every function. When a new Lambda is added, add its entry here too, or SAM local fails with `ResourceNotFoundException`.

### Local Development

> **Note:** Full local dev runs the backend as real Lambdas in Docker via `sam local start-api`, reading and writing the actual `daltime-dev` DynamoDB table over your AWS SSO session. There is no local database to seed separately. The frontend dev server talks to that local API.

**VS Code users (Mac):** Run `Tasks: Run Task` → `Start Full Stack (with install)` to install dependencies and launch both the backend (SAM local) and frontend dev servers. Use `Backend: Deploy to Dev` to push Lambda/infra changes to the shared dev stack. Windows support coming soon.

**Manual setup:**

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Log in (needed before backend can reach DynamoDB/Cognito)
aws sso login --sso-session daltime

# Start backend (SAM local API, backed by the real dev DynamoDB table)
cd backend && npm start

# In a second terminal, start the frontend
cd frontend && npm start

# Deploy backend changes to the shared dev stack
cd backend && sam build --parameter-overrides LambdaArchitecture=arm64 --template-file ../infra/template.yaml
sam deploy --template-file .aws-sam/build/template.yaml --stack-name daltime-backend-dev --s3-bucket daltime-sam-artifacts --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset --region us-east-1 --profile daltime-dev --parameter-overrides 'AllowedOrigins=http://localhost:4200,https://dev.daltime.com,https://localhost' CognitoUserPoolId=us-east-1_kzQ806uSv CognitoClientId=1nl13tbaqb47s8f0tfc07lc24m
```

**After changing an API contract**, run the sync script. It regenerates `openapi.json` and the frontend types, then typechecks both sides:

```bash
node contracts/scripts/contracts-sync.mjs
```

## Development Conventions

Contributor and AI-agent rules live in [`CLAUDE.md`](CLAUDE.md). The most important ones:

- **Blueprint first:** every feature starts with a `0-<feature>.blueprint.md` in its slice folder, approved before implementation.
- **End-to-end or not done:** a feature must work locally (SAM local), on dev, on qa, and on prod.
- **DynamoDB:** no `Scan`; every read is a `GetItem` or a `Query` on a designed key. See [`docs/dynamodb-best-practices.md`](docs/dynamodb-best-practices.md) and [`docs/dynamodb-entity-map.md`](docs/dynamodb-entity-map.md).
- **Logging:** no `console.*` in the backend, and every handler is wrapped in `withLogging`. See [`docs/logging.md`](docs/logging.md).
- **Frontend:** standalone components and signals, Tailwind only, and shared UI from `@common-daltime`.

## Testing

| Type            | Framework | Location                                                |
| --------------- | --------- | ------------------------------------------------------- |
| Unit (Backend)  | Vitest    | `backend/test/unit/`                                    |
| Unit (Frontend) | Vitest    | Co-located with each component/service (`*.spec.ts`)    |
| Integration     | Vitest    | `backend/test/integration/`                             |
| E2E / smoke     | Vitest    | `e2e/`, run after each deploy ([README](e2e/README.md)) |

```bash
cd backend && npm test        # backend unit tests
cd frontend && npm test       # frontend unit tests
```

## Code Quality and Security Checks

Every push and PR runs through several automated checks.

### Before You Commit

Run the linters on the files you changed. CI enforces them, and touching a file means fixing all of its existing lint errors, not just the lines you changed:

```bash
cd backend && npx eslint src
cd frontend && npx eslint src
```

See [`CLAUDE.md`](CLAUDE.md) for the most common ESLint violations in this codebase.

### Runs in CI

| Check                    | Tool                                                       | Trigger                                                | Notes                                                                                                   |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Unit/integration tests   | Vitest                                                     | Every push to `dev`/`main`                             | `ci.yml`                                                                                                |
| Contract drift check     | `contracts` generate + route check                         | Every push to `dev`/`main`                             | Fails if `openapi.json` is stale or a SAM route has no contract                                         |
| `npm audit`              | npm                                                        | Every push                                             | Backend blocks on high severity; frontend is `continue-on-error` pending an Angular 22 upgrade          |
| SAST                     | [CodeQL](https://codeql.github.com/)                       | Every push to `dev`/`main`, and PRs                    | GitHub-native, results in the repo's Security tab. New alerts in a PR's changes fail its `CodeQL` check |
| Template lint            | [cfn-lint](https://github.com/aws-cloudformation/cfn-lint) | Every push                                             | Lints `infra/template.yaml` and `infra/foundation.yaml`                                                 |
| IaC security scan        | [Checkov](https://www.checkov.io/)                         | Every push                                             | Soft-fail (report-only) against `infra/`                                                                |
| Dependency/SAST/IaC scan | [Snyk](https://snyk.io/)                                   | PRs to `dev`/`qa`/`main`, push to `main`, weekly sweep | Report-only for now (`\|\| true`); needs `SNYK_TOKEN`/`SNYK_ORG_ID` configured as GitHub secrets/vars   |
| Code quality dashboard   | [SonarCloud](https://sonarcloud.io/)                       | Push to `main` only                                    | Free-tier limitation: analyzes only the main branch, not every commit; needs `SONAR_TOKEN`              |

**Snyk and SonarCloud are intentionally CI-only.** Both require an authenticated account tied to this project's org (`SNYK_ORG_ID` / `sonar.organization=dallaslacomb` in `sonar-project.properties`), so there's no meaningful way to run them locally from a fresh clone. To run Snyk scans locally against your own account before pushing:

```bash
brew install snyk-cli   # or: npm install -g snyk
snyk auth               # opens browser to log in — no token to paste anywhere
snyk test                                                    # dependency scan
snyk code test                                                # SAST
snyk iac test infra/template.yaml infra/foundation.yaml       # IaC scan
```

To run the infra checks locally before pushing:

```bash
brew install cfn-lint checkov
cfn-lint infra/template.yaml infra/foundation.yaml
checkov -d infra/ --framework cloudformation
```

## Further Documentation

| Document                                                                                 | What it covers                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [ADR-001: Serverless Architecture](docs/architecture/adr-001-serverless-architecture.md) | Why DalTime is fully serverless on AWS, and the alternatives rejected |
| [DynamoDB best practices](docs/dynamodb-best-practices.md)                               | Query and cost rules, PR checklist, known violations                  |
| [DynamoDB entity map](docs/dynamodb-entity-map.md)                                       | Every record type, its keys, and deletion cascades                    |
| [Logging](docs/logging.md)                                                               | Logging policy, PII rules, and Logs Insights queries                  |
| [PostHog guide](docs/posthog-guide.md)                                                   | UX analytics setup and privacy defaults                               |
| [AWS login](docs/aws-login.md)                                                           | Daily SSO login                                                       |
| [Contracts](contracts/README.md)                                                         | How API contracts are defined and generated                           |

## Contributing

This project is built to help nonprofits. Contributions welcome!

## License

MIT

---

_Built with ❤️ for community organizations by [Dallas LaComb](https://github.com/dallaslacomb)._
