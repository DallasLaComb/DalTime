# Health — Blueprint

## Purpose

The `/health` endpoint is a public deployment heartbeat for CI/CD smoke tests.

After every deployment to dev, qa, or prod, the post-deploy pipeline sends a `GET /health` request to the API. If the endpoint returns HTTP 200 with `{ "status": "ok" }`, the pipeline knows the API Gateway stage is live, the Lambda runtime started cleanly, and the deployment succeeded. If it does not respond correctly, the pipeline fails the workflow immediately, before any real user traffic reaches the broken environment.

## What it does

- Accepts `GET /health` with no authentication required (public route, `Authorizer: NONE`).
- Returns HTTP 200 with JSON body `{ "status": "ok" }` every time.
- Also handles `OPTIONS /health` for CORS pre-flight requests (returns HTTP 200 with CORS headers, no body), consistent with all other routes in the API.
- Has no DynamoDB access and no Cognito dependency — it is a pure Lambda response with no external calls.

## What it does not do

- It does not check database connectivity, downstream service health, or any application state.
- It does not require or inspect authentication tokens.
- It is not intended to be a rich health check (no latency metrics, no dependency probes) — it is the minimal signal that the deployment landed and the Lambda cold-start path works.

## Who calls it

- The GitHub Actions post-deploy job (`e2e/` smoke suite) after every deployment.
- Bruno collection for manual verification during development.
- Anyone who needs a public, unauthenticated confirmation that the API is reachable.
