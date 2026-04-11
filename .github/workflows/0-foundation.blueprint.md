# Blueprint: Foundation Workflow

## Overview
Deploys the foundation infrastructure stack (S3, CloudFront, Cognito) to a single environment. This is a manually triggered workflow — run it once per environment before the first CD deploy, and re-run whenever `infra/foundation.yaml` changes. The foundation stack provides the shared resources that both the backend (SAM) and frontend depend on.

## Trigger
- **Event:** `workflow_dispatch` (manual only)
- **Input:** `environment` — choice of `dev`, `qa`, or `main`

This workflow never runs automatically. It is intentionally manual because foundation changes (Cognito config, CloudFront distribution, S3 bucket) are infrequent and high-impact — you want a human deciding when to apply them.

## Permissions
- `id-token: write` — OIDC authentication with AWS
- `contents: read` — clone the repo

## Jobs

### 1. Deploy Foundation (`deploy-foundation`)

Runs in the GitHub environment matching the selected input, which provides environment-specific secrets and variables.

#### Steps

| Step | What it does |
|---|---|
| Checkout | Clones the repo |
| Configure AWS credentials | OIDC auth using the environment's `AWS_ROLE_ARN` secret |
| Checkov scan | Static security scan of `infra/foundation.yaml` before deploying |
| Deploy stack | `aws cloudformation deploy` of `infra/foundation.yaml` |
| Show outputs | Prints the stack outputs table for verification |

#### Checkov Security Scan
Runs Bridgecrew Checkov against the CloudFormation template before deployment. Uses `soft_fail: true` so findings don't block the deploy — they're informational.

**Suppressed checks (with rationale):**

| Check | Why suppressed |
|---|---|
| `CKV_AWS_111` | `sns:Publish *` is required for Cognito SMS — the ARN is dynamic at runtime |
| `CKV_AWS_21` | S3 versioning adds cost with no value for a static site bucket that gets `--delete` synced |
| `CKV_AWS_18` | S3 access logging requires a second bucket — overkill for this project |
| `CKV_AWS_68` | CloudFront WAF costs per-request — not appropriate for a nonprofit project |
| `CKV_AWS_86` | CloudFront logging requires a second bucket — overkill for this project |

#### CloudFormation Deploy
Deploys `infra/foundation.yaml` as stack `daltime-foundation-<environment>`.

**Parameters passed:**

| Parameter | Source | Example |
|---|---|---|
| `Environment` | workflow input | `dev` |
| `CustomDomain` | `vars.CUSTOM_DOMAIN` | `dev.daltime.com` |
| `AcmCertificateArn` | `vars.ACM_CERTIFICATE_ARN` | ACM cert ARN in us-east-1 |
| `FrontendBucketName` | `vars.FRONTEND_BUCKET_NAME` | `daltime-frontend-dev` |
| `CognitoDomainPrefix` | `vars.COGNITO_DOMAIN_PREFIX` | `daltime-dev` |
| `CognitoUsernameAttributes` | hardcoded | `email` |
| `CognitoAutoVerifiedAttributes` | hardcoded | `email` |
| `CognitoAdminCreateUserOnly` | hardcoded | `true` |

**Cognito configuration rationale:**
- `UsernameAttributes: email` — users sign in with email, not a separate username
- `AutoVerifiedAttributes: email` — Cognito auto-verifies email on signup
- `AdminCreateUserOnly: true` — no self-registration; managers invite employees via invite codes

**Deploy flags:**
- `--capabilities CAPABILITY_NAMED_IAM` — the template creates named IAM roles
- `--no-fail-on-empty-changeset` — re-running with no changes is a no-op, not an error

## Stack Outputs

The foundation stack exports values that CD reads at deploy time:

| Output | Used by | Purpose |
|---|---|---|
| `BucketName` | CD — frontend S3 sync | Target bucket for `aws s3 sync` |
| `DistributionId` | CD — CloudFront invalidation | Which distribution to invalidate after deploy |
| `UserPoolId` | CD — SAM deploy parameter | Cognito user pool for backend auth |
| `UserPoolClientId` | CD — SAM deploy parameter + frontend placeholder replacement | Cognito app client ID |
| `CognitoDomain` | CD — frontend placeholder replacement | Cognito hosted UI domain |
| `CognitoRegion` | CD — frontend placeholder replacement | Region where Cognito lives |

CD reads these dynamically via `aws cloudformation describe-stacks` — they are not duplicated as GitHub variables.

## Required GitHub Environment Configuration

Each environment (dev, qa, main) must have:

| Name | Type | Description |
|---|---|---|
| `AWS_ROLE_ARN` | Secret | OIDC IAM role ARN (see `.github/iam/setup-guide.md`) |
| `CUSTOM_DOMAIN` | Variable | e.g. `dev.daltime.com` |
| `ACM_CERTIFICATE_ARN` | Variable | ACM certificate ARN in us-east-1 for the custom domain |
| `FRONTEND_BUCKET_NAME` | Variable | e.g. `daltime-frontend-dev` |
| `COGNITO_DOMAIN_PREFIX` | Variable | e.g. `daltime-dev` |

## Relationship to Other Workflows

```
Foundation (manual, run first)
    ↓ exports S3 bucket, CloudFront, Cognito IDs
CI (automatic on dev push)
    ↓ produces build artifacts
CD (automatic on dev/qa/main push)
    ↓ reads foundation outputs, deploys artifacts, runs E2E
```

Foundation must be deployed before the first CD run for an environment. If foundation outputs change (e.g. new Cognito pool), CD will pick up the new values automatically on its next run.

## What This Workflow Does NOT Do
- Does not run automatically — always manual dispatch
- Does not build or deploy application code — that's CI/CD's job
- Does not run tests of any kind
- Does not create the OIDC provider or IAM role — those are set up manually per `.github/iam/setup-guide.md`
