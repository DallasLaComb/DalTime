# DalTime — Project Context

## Architecture

| Layer | Technology |
|---|---|
| CDN / Static Hosting | CloudFront + S3 |
| Frontend | Angular 21 (Standalone Components, Signals) |
| API | API Gateway V2 (HTTP API) + JWT Authorizer |
| Backend | AWS Lambda (Node.js 24, ESM) |
| Database | DynamoDB (single-table design) |
| Auth | Amazon Cognito |
| IaC | AWS SAM (`backend/template.yaml`) |
| CI/CD | GitHub Actions |

## Environments

| Name | Purpose |
|---|---|
| `local` | SAM local + DynamoDB local (Docker) |
| `dev` | Auto-deploys on merge to `master` |
| `qa` | Release gate — manual approval |
| `prod` | Production — manual approval after QA |

## Roles

There are exactly 4 roles. Every auth guard, route, and API test must cover all of them.

| Role | Cognito Group | Route Prefix |
|---|---|---|
| `WebAdmin` | `WebAdmin` | `/web-admin` |
| `OrgAdmin` | `OrgAdmin` | `/org-admin` |
| `Manager` | `Manager` | `/manager` |
| `Employee` | `Employee` | `/employee` |

## Project Structure

```
backend/
  src/functions/
    shared/           # dynamo.ts, response.ts, models/
    web-admin/        # one folder per Lambda feature
    org-admin/
    manager/
    employee/
  test/
    unit/             # vitest — no AWS, no network
    integration/      # vitest — requires LocalStack or SAM local
  template.yaml       # SAM template
frontend/
  src/app/
    core/             # auth, guards, interceptors, models, navbar
    features/         # vertical slice per role
    shared/           # reusable UI components
docs/
  testing-philosophy.md   # full testing strategy — read before writing tests
specs/                # spec documents (created before implementation)
  lambda/
  component/
```

## Spec-Driven Development Workflow

**Every feature starts with a spec.** No implementation code before a spec is written and confirmed.

Use the saved prompts:
- `@new-lambda` — spec then implement a Lambda vertical slice
- `@new-component` — spec then implement an Angular vertical slice
- `@spec-review` — audit an existing implementation against its spec

The spec lives in `specs/lambda/<name>.spec.md` or `specs/component/<name>.spec.md`.

## Library Rules

Before using any library, look up its current LTS version. This is a greenfield project — always pin to LTS, never install outdated versions.
