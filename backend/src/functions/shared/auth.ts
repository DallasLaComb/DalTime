import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from './errors.js';
import { getWebAdminLookup } from '../web-admin/shared/db.js';
import type { WebAdminCaller } from './models/web-admin/web-admin.model.js';

/**
 * Decode the JWT payload from a raw Authorization header value without
 * verifying the token signature.
 *
 * This is ONLY a SAM-local development fallback. In deployed environments
 * (dev/qa/prod), API Gateway's JWT authorizer verifies the token signature
 * before the Lambda runs, so `requestContext.authorizer.jwt.claims` already
 * contains trusted claims — this function is never reached there. SAM local
 * does not support HTTP API JWT authorizers and logs "Linking authorizer
 * skipped", leaving `requestContext.authorizer` absent, so this fallback is
 * the only way to identify the caller during local development.
 *
 * Accepts the raw `Authorization` header string (e.g. "Bearer <token>") so it
 * can be called by any web-admin Lambda handler that needs local-auth fallback
 * without coupling to the full event shape. Returns `null` on any parse
 * failure rather than throwing, so callers can handle the missing-auth case
 * explicitly.
 *
 * Convention: every web-admin Lambda handler that needs a local-auth fallback
 * should import and call this function rather than re-implementing the logic.
 * The name makes its local-only purpose unambiguous.
 */
export function decodeLocalJwtPayload(authorizationHeader: string): Record<string, unknown> | null {
  if (!authorizationHeader.startsWith('Bearer ')) return null;

  try {
    const payloadSegment = authorizationHeader.slice(7).split('.')[1];
    if (!payloadSegment) return null;
    return JSON.parse(Buffer.from(payloadSegment, 'base64url').toString()) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

/**
 * Extract the caller's Cognito sub from the event.
 *
 * Production: API Gateway injects verified claims into
 * event.requestContext.authorizer.jwt.claims before Lambda is invoked.
 *
 * SAM local: JWT authorizer claims are not injected, so we decode the
 * Authorization header directly as a fallback (no signature verification
 * needed — the token is only used to identify the caller locally).
 */
export function getCallerSub(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const fromClaims = event.requestContext?.authorizer?.jwt?.claims?.['sub'];
  if (fromClaims) return fromClaims as string;

  // SAM-local fallback: authorizer is absent locally, decode the header directly.
  const authHeader = event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '';
  const payload = decodeLocalJwtPayload(authHeader);
  return (payload?.['sub'] as string) ?? '';
}

/**
 * Extract the caller's Cognito group memberships (e.g. 'WebAdmin',
 * 'OrgAdmin', 'Manager', 'Employee') from the event, normalized to a
 * string array regardless of how the claim arrived.
 *
 * Production: API Gateway's JWT-claims-to-string-map flattening can deliver
 * 'cognito:groups' as either a real JSON array (rare) or a comma/space
 * joined string (the common case for HTTP API JWT authorizers) — we check
 * both shapes defensively rather than assuming one.
 *
 * SAM local: same Authorization-header decode fallback as getCallerSub, for
 * local-dev parity (the JWT authorizer claims object isn't populated when
 * running under `sam local start-api`).
 */
export function getCallerGroups(event: APIGatewayProxyEventV2WithJWTAuthorizer): string[] {
  const fromClaims = event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'];
  if (fromClaims !== undefined) return normalizeGroupsClaim(fromClaims);

  // SAM-local fallback: authorizer is absent locally, decode the header directly.
  const authHeader = event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '';
  const payload = decodeLocalJwtPayload(authHeader);
  return normalizeGroupsClaim(payload?.['cognito:groups']);
}

/**
 * Normalize the 'cognito:groups' claim to a string array no matter which
 * shape it arrived in:
 *
 *   - A real JS array (SAM local / SDK direct call): ["WebAdmin"]
 *   - A bracket-stringified array (HTTP API JWT authorizer with a single group
 *     or multiple groups): "[WebAdmin]" or "[WebAdmin, OrgAdmin]"
 *   - A comma/space-delimited string (some HTTP API JWT authorizer versions):
 *     "WebAdmin" or "WebAdmin OrgAdmin"
 *   - Missing entirely
 *
 * The HTTP API JWT authorizer flattens the JWT's array claim into a single
 * string using bracket notation (e.g. "[WebAdmin]"), which is why we must
 * strip leading/trailing brackets before splitting.
 */
function normalizeGroupsClaim(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === 'string' && g.length > 0);
  }
  if (typeof raw === 'string' && raw.length > 0) {
    // Strip bracket notation produced by the HTTP API JWT authorizer:
    // "[WebAdmin]" → "WebAdmin", "[WebAdmin, OrgAdmin]" → "WebAdmin, OrgAdmin"
    const stripped = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
    return stripped
      .split(/[,\s]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }
  return [];
}

/**
 * Returns true if the caller belongs to the WebAdmin Cognito group.
 * Used to gate every web-admin/* handler so that any authenticated user
 * (not just a WebAdmin) can no longer reach web-admin-only data/actions —
 * the API Gateway JWT authorizer only verifies the token is well-signed and
 * from the right user pool, it does not check group membership, so each
 * handler must enforce this itself.
 */
export function isWebAdmin(event: APIGatewayProxyEventV2WithJWTAuthorizer): boolean {
  return getCallerGroups(event).includes('WebAdmin');
}

/**
 * Guard for every web-admin/* handler entrypoint: throws a ForbiddenError
 * (mapped to an HTTP 403 by mapHandlerError) if the caller is not a member
 * of the WebAdmin Cognito group. Call this immediately after the OPTIONS
 * short-circuit and before any routing/business logic, so a non-WebAdmin
 * caller never reaches a query or mutation — fail closed, not "filtered by
 * the frontend."
 */
export function requireWebAdmin(event: APIGatewayProxyEventV2WithJWTAuthorizer): void {
  if (!isWebAdmin(event)) {
    throw new ForbiddenError('WebAdmin role required');
  }
}

/**
 * Data-driven guard for web-admin/* handlers that enforces two layers of
 * authorization:
 *
 *   1. Cognito group check — same as `requireWebAdmin`. Throws ForbiddenError
 *      if the caller is not in the WebAdmin group.
 *   2. DynamoDB record check — resolves the caller's `USER#<sub>/METADATA`
 *      item via `getWebAdminLookup`. Throws ForbiddenError (fail closed) if
 *      no record is found, meaning the Cognito user exists but has not been
 *      provisioned as a WebAdmin in the application database. Also throws
 *      ForbiddenError if the record's status is DISABLED — disabling a
 *      WebAdmin in DynamoDB immediately blocks all API access without needing
 *      to revoke the Cognito user.
 *
 * Returns a `WebAdminCaller` containing `{ sub, web_admin_id, email, status }`
 * for the caller. Handlers should thread `web_admin_id` into every mutating
 * service call so that `modified_by_web_admin_id` can be stamped on affected
 * DynamoDB items for audit purposes.
 *
 * This function is async because it performs a DynamoDB GetItem. Call it
 * with `await` immediately after the OPTIONS short-circuit.
 */
export async function requireWebAdminWithLookup(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<WebAdminCaller> {
  // Step 1: Cognito group check — same fail-closed guard as requireWebAdmin.
  requireWebAdmin(event);

  // Step 2: Extract the caller's Cognito sub from verified JWT claims (or the
  // SAM-local fallback path handled inside getCallerSub).
  const sub = getCallerSub(event);

  // Step 3: DynamoDB lookup — fail closed if no provisioned record exists.
  const caller = await getWebAdminLookup(sub);
  if (!caller) {
    throw new ForbiddenError('WebAdmin record not found');
  }

  // Step 4: Reject callers with a DISABLED record — disabling in DynamoDB
  // takes effect immediately without a Cognito token revocation.
  if (caller.status !== 'ACTIVE') {
    throw new ForbiddenError('WebAdmin account is disabled');
  }

  // Step 5: Fail closed if the record exists but has no web_admin_id attribute.
  // TypeScript types web_admin_id as non-optional, but a DynamoDB item could
  // theoretically be stored without it (e.g. a partially-written record or a
  // data migration that never completed). Returning a caller with
  // web_admin_id === undefined would silently write null audit stamps on every
  // subsequent mutation — catching it here makes the failure explicit and
  // prevents corrupt audit data from reaching the database.
  if (!caller.web_admin_id) {
    throw new ForbiddenError('WebAdmin record is missing web_admin_id');
  }

  return caller;
}
