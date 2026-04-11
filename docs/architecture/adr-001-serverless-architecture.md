# ADR-001: Serverless Architecture on AWS

**Status:** Accepted  
**Date:** 2025-04-06

## Context

DalTime is a free shift-scheduling app for nonprofits. It is built and maintained by a solo developer. The architecture must be:

1. **Cheap** — nonprofits can't afford hosting costs, and the app may sit idle for long stretches
2. **Low maintenance** — no servers to patch, no clusters to manage, no capacity planning
3. **Reliable** — users depend on published schedules; downtime erodes trust
4. **Scalable without effort** — if adoption grows from one YMCA branch to dozens, the infrastructure must handle it without re-architecture

## Decision

Use a fully serverless AWS stack:

| Layer | Service | Why |
|-------|---------|-----|
| CDN / Hosting | CloudFront + S3 | Static Angular build served at the edge. No origin server. Pennies per month at low traffic. |
| API | API Gateway V2 (HTTP API) | Pay-per-request, built-in JWT authorizer, CORS, no idle cost. |
| Compute | Lambda (Node.js) | Zero cost at zero traffic. Scales to thousands of concurrent requests automatically. |
| Database | DynamoDB (on-demand) | Single-digit-ms latency, zero capacity planning, pay-per-request. Single-table design keeps costs minimal. |
| Auth | Cognito | Managed user pools, JWT issuance, group-based RBAC. Free tier covers 50,000 MAUs. |
| IaC | AWS SAM / CloudFormation | Infrastructure defined in code, reproducible across environments. |

## Consequences

### Benefits

- **Near-zero idle cost** — with no traffic, the only cost is S3 storage and CloudFront's free tier. Lambda, API Gateway, and DynamoDB on-demand all bill at $0 when idle.
- **No operational burden** — no EC2 instances, no ECS clusters, no RDS patching, no auto-scaling groups to configure. AWS manages availability, patching, and scaling.
- **Automatic scaling** — every service in the stack scales independently and automatically. A sudden spike in users doesn't require intervention.
- **High availability by default** — S3, DynamoDB, Lambda, and API Gateway are all multi-AZ by design. No redundancy configuration needed.
- **Solo-developer friendly** — one person can deploy, monitor, and maintain the entire stack. SAM CLI handles local development and deployments.

### Tradeoffs

- **Cold starts** — Lambda cold starts add latency on the first request after idle. Acceptable for this use case; users won't notice 200-500ms on an infrequent page load.
- **Vendor lock-in** — deeply tied to AWS services (Cognito, DynamoDB, Lambda). Migrating to another cloud would require significant rewrite. Acceptable given the cost and maintenance benefits.
- **DynamoDB modeling complexity** — single-table design requires upfront access pattern planning. Worth it for the performance and cost savings at scale.
- **Limited local development parity** — SAM local + DynamoDB local don't perfectly replicate cloud behavior. Mitigated by pointing local Lambda at dev cloud services.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| EC2 + RDS | Always-on cost ($30-100+/mo minimum), requires patching, scaling config, and monitoring — too much overhead for a solo maintainer |
| ECS Fargate + RDS | Lower ops than EC2 but still has idle cost and RDS maintenance burden |
| Vercel/Netlify + Supabase | Simpler DX but less control, potential cost surprises at scale, and splits infrastructure across vendors |
| Firebase | Good serverless option but weaker IAM model, no native IaC like CloudFormation, and less flexibility for complex auth flows |
