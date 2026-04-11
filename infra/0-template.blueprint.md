# Blueprint: Backend SAM Template

## Overview
Defines the serverless backend — API Gateway HTTP API, Lambda functions, DynamoDB table, and supporting resources. Deployed per environment via the CD workflow after the foundation stack.

## Stack Name Convention
`daltime-backend-{environment}` (e.g. `daltime-backend-dev`)

## Resources

### API Gateway (HTTP API v2)
- **DalTimeHttpApi** — JWT authorizer via Cognito, CORS configured from `AllowedOrigin` parameter
- Access logging to CloudWatch with structured JSON format

### DynamoDB
- **DalTimeTable** — single-table design, on-demand billing
  - Keys: `PK` (hash), `SK` (range)
  - GSI1: `GSI1PK` (hash), `GSI1SK` (range), ALL projection

### Lambda Functions
Each function follows the pattern: handler → service → db layer, with `CodeUri: ../backend`.

| Function | Route Prefix | Purpose |
|----------|-------------|---------|
| OrganizationsFunction | `/organizations` | CRUD for organizations (WebAdmin) |
| OrgAdminsFunction | `/web-admin/organizations/{orgId}/org-admins` | Manage org admins (WebAdmin) |
| ManagersFunction | `/org-admin/managers` | Manage managers (OrgAdmin) |

All functions share:
- Runtime: Node.js 24 (ESM, esbuild)
- Architecture: parameterized (arm64 default)
- 30s timeout
- Dedicated CloudWatch log group (1-day retention)

### IAM Policies
- Each function gets `DynamoDBCrudPolicy` on the shared table
- Functions that manage Cognito users get explicit `cognito-idp:Admin*` permissions scoped to the user pool ARN

## Parameters

| Parameter | Purpose | Default |
|-----------|---------|---------|
| `AllowedOrigin` | CORS origin | `http://localhost:4200` |
| `CognitoUserPoolId` | JWT issuer pool | dev pool ID |
| `CognitoClientId` | JWT audience | dev client ID |
| `LambdaArchitecture` | arm64 or x86_64 | `arm64` |
| `DynamoDbEndpoint` | Local DynamoDB override | `""` (uses real AWS) |
| `TableName` | Table name override for local dev | `""` (uses stack resource) |

## Adding a New Lambda
1. Add a `LogGroup` resource
2. Add the `Function` resource with `DependsOn` on the log group
3. Set `CodeUri: ../backend`, `Handler`, `Events` (routes), and `Policies`
4. Add OPTIONS routes with `Auth: Authorizer: NONE` for CORS preflight
5. Add esbuild metadata with the entry point
