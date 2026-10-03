# DalTime — Claude Code Instructions

Every new feature must include all four of the following.

## 1. OpenAPI contract

Create or update the API contract in `contracts/openapi.json` for every new or changed route (paths, request/response schemas, auth, error responses).

## 2. DynamoDB mapping

Update `docs/dynamodb-entity-map.md` with any new or changed record keys (PK/SK, GSIs, attributes, `ttl`). Follow `docs/dynamodb-best-practices.md` — no `Scan`, every read is a `GetItem` or a `Query` on a designed key.

## 3. Unit tests

Add or update unit tests for every new or changed backend service/handler and frontend component/service. Existing tests must keep passing.

## 4. Logging

Use the project logger so everything can be tracked in the logs. See `docs/logging.md` for the full policy, field dictionary, and PII rules.

- No `console.*` in the backend — use `logger` from `shared/logger.ts`
- Export every Lambda handler via `withLogging` — `export const handler = withLogging(handleRequest, 'role-feature')`
- Services log state-changing operations (create/update/delete/assign/publish) with one `logger.info` containing entity ids only — never emails, names, bodies, tokens, or DynamoDB items
- Frontend logging goes through `LoggerService`; components never call `console.*` directly
