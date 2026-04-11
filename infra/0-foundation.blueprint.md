# Blueprint: Foundation Infrastructure

## Overview
Shared, environment-agnostic infrastructure deployed once per environment (dev, qa, prod). Manages the frontend hosting pipeline (S3 + CloudFront), authentication (Cognito), and the IAM glue between them. Deployed via the `Deploy Foundation` GitHub Actions workflow before the backend SAM stack.

## Stack Name Convention
`daltime-foundation-{environment}` (e.g. `daltime-foundation-dev`)

## Resources

### S3 — Frontend Hosting
- **FrontendBucket** — private bucket, SSE-AES256, all public access blocked
- **FrontendBucketPolicy** — grants CloudFront service principal `s3:GetObject` via OAC
- `DeletionPolicy: Retain` — bucket survives stack deletion to preserve assets

### CloudFront
- **OriginAccessControl** — sigv4 OAC for S3 origin (no legacy OAI)
- **FrontendDistribution** — HTTPS-only, HTTP/2, custom domain with ACM cert
  - Managed cache policy: `CachingOptimized`
  - SPA routing: 403/404 → `/index.html` with 200 status (Angular handles routing)
- `DeletionPolicy: Retain` — distribution survives stack deletion

### Cognito
- **UserPool** — `daltime-{environment}`, `DeletionProtection: ACTIVE`, `DeletionPolicy: Retain`
  - Password policy: 8+ chars, upper/lower/number/symbol
  - MFA: OFF
  - Custom attributes: `org_id`, `manager_id`, `user_type`
  - Auth behaviour parameterized per environment (email vs username login, admin-only vs self-registration)
- **UserPoolDomain** — Cognito hosted UI domain prefix
- **UserPoolClient** — `daltime-{environment}`
  - OAuth2 authorization code flow
  - Token validity: access/id 60 min, refresh 5 days
  - Callback URLs include localhost for dev, custom domain for all environments
  - `PreventUserExistenceErrors: ENABLED`
- **User Groups** (4 roles, precedence order):
  - `WebAdmin` (0) — platform-wide admin
  - `OrgAdmin` (1) — organization admin
  - `Manager` (2) — team manager
  - `Employee` (3) — end user

### IAM
- **CognitoSNSRole** — conditional, only created when `CognitoSNSExternalId` is provided (SMS-enabled environments)

## Parameters

| Parameter | Purpose | Dev | QA/Prod |
|-----------|---------|-----|---------|
| `Environment` | Stack environment name | `dev` | `qa` / `main` |
| `CustomDomain` | CloudFront alias | `dev.daltime.com` | `qa.daltime.com` / `daltime.com` |
| `AcmCertificateArn` | HTTPS cert (must be us-east-1) | per-env | per-env |
| `FrontendBucketName` | S3 bucket name | per-env | per-env |
| `CognitoDomainPrefix` | Hosted UI prefix | `daltime-dev` | `daltime-qa` / `daltime` |
| `CognitoUsernameAttributes` | Login identifier | `""` (username) | `email` |
| `CognitoAdminCreateUserOnly` | Disable self-registration | `false` | `true` |
| `CognitoAutoVerifiedAttributes` | Auto-verified attribute | `phone_number` | `email` |
| `LocalCallbackUrl` | Localhost callback | `http://localhost:4200` | `""` |
| `CognitoSNSExternalId` | Enable SMS/SNS | set if SMS needed | `""` |

## Outputs / Cross-Stack Exports

| Output | Export Name | Consumed By |
|--------|------------|-------------|
| `BucketName` | `{stack}-BucketName` | CI/CD frontend deploy |
| `DistributionId` | `{stack}-DistributionId` | CI/CD CloudFront invalidation |
| `DistributionDomainName` | `{stack}-DistributionDomainName` | DNS configuration |
| `UserPoolId` | `{stack}-UserPoolId` | Backend SAM stack |
| `UserPoolClientId` | `{stack}-UserPoolClientId` | Backend SAM stack + frontend config |
| `CognitoDomain` | `{stack}-CognitoDomain` | Frontend auth config |
| `CognitoRegion` | `{stack}-CognitoRegion` | Frontend auth config |

## Deployment Order
1. Foundation stack (this template) — creates S3, CloudFront, Cognito
2. Backend SAM stack — references Cognito outputs via parameters
3. Frontend build — deployed to S3, CloudFront invalidated

## Key Design Decisions
- **Retain policies** on S3, CloudFront, and UserPool — prevents accidental data loss on stack deletion
- **Parameterized auth behaviour** — dev uses username login for flexibility, qa/prod use email-only with admin-created users
- **Single template, multiple environments** — same CloudFormation template deployed with different parameter files per environment
- **No WAF** — cost optimization for nonprofit; can be added later if needed
- **SMS conditional** — SNS role and SMS config only created when explicitly enabled, avoiding unnecessary IAM resources
