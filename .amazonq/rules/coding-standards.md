# DalTime Coding Standards

## Backend (Lambda / Node.js)
- Handler → service → db. No business logic in handlers, no DynamoDB in services.
- Inject `docClient`, never import directly in handler.
- No `any`. All ESM imports use `.js` extension. Table name from `process.env.TABLE_NAME`.
- Blueprints at `backend/src/functions/<role>/<feature>/0-<feature>.blueprint.md`.

## Frontend (Angular)
- Standalone components only. Signals for state, not `BehaviorSubject`. Bootstrap 5 for layout/styling.
- No `any`. `data-testid` on all interactive elements. Tests query by role/label/testid, not CSS.
- Blueprints at `frontend/src/app/features/<role>/<feature>/0-<feature>.blueprint.md`.

## Models
- Backend: `backend/src/functions/shared/models/<role>/<feature>.model.ts`
- Frontend: `frontend/src/app/core/models/<feature>.model.ts`
- No loose `Record<string, any>`. Update `docs/dynamodb-entity-map.md` when models change.
