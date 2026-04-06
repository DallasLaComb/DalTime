# DalTime — Backend Rules (Lambda / Node.js)

## Project structure per feature
Each Lambda feature is a vertical slice:
```
backend/src/functions/<role>/<feature>/
  handler.ts   ← pure function, inject all deps
  service.ts   ← business logic, throws ValidationError
  db.ts        ← DynamoDB commands only, no business logic
```

## Handler isolation
- Handlers must be pure functions — inject `DynamoDBDocumentClient` (or Cognito client) via parameter, never import `docClient` directly inside handler logic
- All dependencies are mockable with `vi.mock()`

## Event shape contracts
- One test per API Gateway route shape the handler handles (GET, POST, PUT, DELETE, authorizer)
- Use a `buildApiGwEvent(overrides)` factory — never hardcode raw event JSON

## DynamoDB mocking
- Mock at the `@aws-sdk/lib-dynamodb` client level using `aws-sdk-client-mock`
- Assert on exact command types (`PutCommand`, `QueryCommand`, etc.) and their inputs — not just return values

## Error path coverage (required per handler)
Every handler test suite must include: happy path, invalid input (400), unauthorized (403), not found (404), DynamoDB/Cognito failure (500).

## Models
- Interfaces live in `backend/src/functions/shared/models/<role>/<feature>.model.ts`
- DynamoDB key fields (`PK`, `SK`, `GSI1PK`, `GSI1SK`) are included on the stored interface but stripped before returning to callers via `stripKeys()`
- Single-table key conventions: `PK = <TYPE>#<id>`, `SK = METADATA` (or sub-entity discriminator), `GSI1PK = <TYPE>`, `GSI1SK = <created_at ISO>`

## ESM
- All imports use `.js` extension
- `randomUUID()` from `node:crypto` for ID generation
- Timestamps: `new Date().toISOString()`
- Never hardcode table names — always `process.env.TABLE_NAME`

## Target coverage
≥80% branch coverage per handler.

## Test runner
Backend: `vitest` with `unit` and `integration` projects (see `backend/vitest.config.ts`).

## DynamoDB Conventions
- Single table: env var `TABLE_NAME`
- GSI: `GSI1` (env var `GSI1_INDEX`)
- All DynamoDB access goes through `db.ts` in the feature folder
- Strip `PK/SK/GSI1PK/GSI1SK` before returning to API consumers (use `stripKeys()`)
