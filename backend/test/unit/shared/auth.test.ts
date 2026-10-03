import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import {
  decodeLocalJwtPayload,
  getCallerSub,
  getCallerGroups,
  isWebAdmin,
  requireWebAdmin,
  requireWebAdminWithLookup,
} from '../../../src/functions/shared/auth.js';
import { ForbiddenError } from '../../../src/functions/shared/errors.js';

// Mock the web-admin db lookup so auth.test.ts has no DynamoDB dependency.
vi.mock('../../../src/functions/web-admin/shared/db.js', () => ({
  getWebAdminLookup: vi.fn(),
}));

import { getWebAdminLookup } from '../../../src/functions/web-admin/shared/db.js';

// ─── Factories ────────────────────────────────────────────────────────────────

/** Builds a minimal event with claims injected via requestContext (production shape). */
function eventWithClaims(
  claims: Record<string, unknown>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    headers: {},
    requestContext: { authorizer: { jwt: { claims } } },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

/** Builds a minimal event with no authorizer claims, only an Authorization header (SAM-local shape). */
function eventWithBearerToken(payload: Record<string, unknown>): APIGatewayProxyEventV2WithJWTAuthorizer {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `header.${encoded}.signature`;
  return {
    headers: { authorization: `Bearer ${token}` },
    requestContext: {},
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

/** Builds an event for a WebAdmin caller with a given sub. */
function webAdminEvent(sub = 'web-admin-sub'): APIGatewayProxyEventV2WithJWTAuthorizer {
  return eventWithClaims({ 'cognito:groups': 'WebAdmin', sub });
}

// ─── getCallerSub ─────────────────────────────────────────────────────────────

describe('getCallerSub', () => {
  it('reads sub from requestContext.authorizer.jwt.claims when present (prod path)', () => {
    const event = eventWithClaims({ sub: 'prod-sub' });
    expect(getCallerSub(event)).toBe('prod-sub');
  });

  it('falls back to decoding the Authorization header when claims are absent (SAM-local path)', () => {
    const event = eventWithBearerToken({ sub: 'local-sub' });
    expect(getCallerSub(event)).toBe('local-sub');
  });

  it('returns empty string when neither claims nor a bearer token are present', () => {
    const event = { headers: {}, requestContext: {} } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
    expect(getCallerSub(event)).toBe('');
  });
});

// ─── getCallerGroups ──────────────────────────────────────────────────────────

describe('getCallerGroups', () => {
  it('normalizes a real array claim (prod path, rare shape)', () => {
    const event = eventWithClaims({ 'cognito:groups': ['WebAdmin', 'Manager'] });
    expect(getCallerGroups(event)).toEqual(['WebAdmin', 'Manager']);
  });

  it('normalizes a comma-joined string claim (prod path, common HTTP API flattening)', () => {
    const event = eventWithClaims({ 'cognito:groups': 'WebAdmin,Manager' });
    expect(getCallerGroups(event)).toEqual(['WebAdmin', 'Manager']);
  });

  it('normalizes a space-joined string claim', () => {
    const event = eventWithClaims({ 'cognito:groups': 'WebAdmin Manager' });
    expect(getCallerGroups(event)).toEqual(['WebAdmin', 'Manager']);
  });

  it('normalizes a bracket-stringified single-group claim (HTTP API JWT authorizer production shape)', () => {
    // The HTTP API JWT authorizer serialises a single-element groups array as
    // the literal string "[WebAdmin]" rather than "WebAdmin". This is the exact
    // shape confirmed in CloudWatch logs for the dev environment.
    const event = eventWithClaims({ 'cognito:groups': '[WebAdmin]' });
    expect(getCallerGroups(event)).toEqual(['WebAdmin']);
  });

  it('normalizes a bracket-stringified multi-group claim', () => {
    const event = eventWithClaims({ 'cognito:groups': '[WebAdmin, OrgAdmin]' });
    expect(getCallerGroups(event)).toEqual(['WebAdmin', 'OrgAdmin']);
  });

  it('returns an empty array when the claim is missing', () => {
    const event = eventWithClaims({ sub: 'no-groups-sub' });
    expect(getCallerGroups(event)).toEqual([]);
  });

  it('falls back to decoding the Authorization header (SAM-local path), array shape', () => {
    const event = eventWithBearerToken({ 'cognito:groups': ['WebAdmin'] });
    expect(getCallerGroups(event)).toEqual(['WebAdmin']);
  });

  it('falls back to decoding the Authorization header (SAM-local path), string shape', () => {
    const event = eventWithBearerToken({ 'cognito:groups': 'WebAdmin,Employee' });
    expect(getCallerGroups(event)).toEqual(['WebAdmin', 'Employee']);
  });

  it('ignores non-string entries in an array claim defensively', () => {
    const event = eventWithClaims({ 'cognito:groups': ['WebAdmin', 42, null] });
    expect(getCallerGroups(event)).toEqual(['WebAdmin']);
  });
});

// ─── isWebAdmin ───────────────────────────────────────────────────────────────

describe('isWebAdmin', () => {
  it('returns true when WebAdmin is among the caller groups', () => {
    expect(isWebAdmin(eventWithClaims({ 'cognito:groups': 'WebAdmin' }))).toBe(true);
  });

  it('returns false when the caller has a different group', () => {
    expect(isWebAdmin(eventWithClaims({ 'cognito:groups': 'Employee' }))).toBe(false);
  });

  it('returns false when the caller has no group claim', () => {
    expect(isWebAdmin(eventWithClaims({ sub: 'no-groups' }))).toBe(false);
  });
});

// ─── requireWebAdmin ──────────────────────────────────────────────────────────

describe('requireWebAdmin', () => {
  it('does not throw for a WebAdmin caller', () => {
    expect(() => requireWebAdmin(eventWithClaims({ 'cognito:groups': 'WebAdmin' }))).not.toThrow();
  });

  it('throws ForbiddenError for a non-WebAdmin caller', () => {
    expect(() => requireWebAdmin(eventWithClaims({ 'cognito:groups': 'Employee' }))).toThrow(
      ForbiddenError,
    );
  });

  it('throws ForbiddenError when there is no group claim at all', () => {
    expect(() => requireWebAdmin(eventWithClaims({ sub: 'no-groups' }))).toThrow(ForbiddenError);
  });
});

// ─── requireWebAdminWithLookup ────────────────────────────────────────────────

describe('requireWebAdminWithLookup', () => {
  const activeCaller = {
    sub: 'web-admin-sub',
    web_admin_id: 'WADMIN#uuid-1',
    email: 'admin@example.com',
    status: 'ACTIVE' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) returns the WebAdminCaller when the caller is in the WebAdmin group and has an ACTIVE record', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue(activeCaller);
    const result = await requireWebAdminWithLookup(webAdminEvent('web-admin-sub'));
    expect(result).toEqual(activeCaller);
    expect(getWebAdminLookup).toHaveBeenCalledWith('web-admin-sub');
  });

  it('(a) throws ForbiddenError when the caller is not in the WebAdmin group — no DynamoDB lookup', async () => {
    const event = eventWithClaims({ 'cognito:groups': 'OrgAdmin', sub: 'org-admin-sub' });
    await expect(requireWebAdminWithLookup(event)).rejects.toThrow(ForbiddenError);
    // The Cognito group check must short-circuit before any DynamoDB call.
    expect(getWebAdminLookup).not.toHaveBeenCalled();
  });

  it('(a) throws ForbiddenError when the caller has no group claim at all — no DynamoDB lookup', async () => {
    const event = eventWithClaims({ sub: 'no-group-sub' });
    await expect(requireWebAdminWithLookup(event)).rejects.toThrow(ForbiddenError);
    expect(getWebAdminLookup).not.toHaveBeenCalled();
  });

  it('(b) throws ForbiddenError when the caller is in the WebAdmin group but has no DynamoDB record', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue(null);
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow(ForbiddenError);
  });

  it('(b) error message for missing record is "WebAdmin record not found"', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue(null);
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow('WebAdmin record not found');
  });

  it('(c) throws ForbiddenError when the caller has a DynamoDB record but status is DISABLED', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue({ ...activeCaller, status: 'DISABLED' });
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow(ForbiddenError);
  });

  it('(c) error message for DISABLED record is "WebAdmin account is disabled"', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue({ ...activeCaller, status: 'DISABLED' });
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow('WebAdmin account is disabled');
  });

  it('(c2) throws ForbiddenError when the DynamoDB record is ACTIVE but web_admin_id is missing', async () => {
    // A partially-written or migrated record could have status=ACTIVE but no
    // web_admin_id attribute. TypeScript types it as non-optional but DynamoDB
    // makes no such guarantee at runtime. Returning a caller with
    // web_admin_id === undefined would silently produce null audit stamps on
    // every subsequent mutation — we must fail closed here instead.
    const callerWithoutId = { ...activeCaller, web_admin_id: '' };
    vi.mocked(getWebAdminLookup).mockResolvedValue(callerWithoutId);
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow(ForbiddenError);
  });

  it('(c2) error message for missing web_admin_id is "WebAdmin record is missing web_admin_id"', async () => {
    const callerWithoutId = { ...activeCaller, web_admin_id: '' };
    vi.mocked(getWebAdminLookup).mockResolvedValue(callerWithoutId);
    await expect(requireWebAdminWithLookup(webAdminEvent())).rejects.toThrow(
      'WebAdmin record is missing web_admin_id',
    );
  });

  it('(d) happy path — returns caller with all expected fields', async () => {
    vi.mocked(getWebAdminLookup).mockResolvedValue(activeCaller);
    const result = await requireWebAdminWithLookup(webAdminEvent('web-admin-sub'));
    expect(result.sub).toBe('web-admin-sub');
    expect(result.web_admin_id).toBe('WADMIN#uuid-1');
    expect(result.email).toBe('admin@example.com');
    expect(result.status).toBe('ACTIVE');
  });

  it('(e) SAM-local fallback path — resolves correctly when claims come from Authorization header instead of requestContext', async () => {
    // SAM local does not inject JWT claims into requestContext; auth must decode the
    // Authorization header directly. Verify requireWebAdminWithLookup still reaches
    // the DynamoDB lookup (and succeeds) via that fallback path.
    vi.mocked(getWebAdminLookup).mockResolvedValue(activeCaller);
    const samLocalEvent = eventWithBearerToken({
      sub: 'web-admin-sub',
      'cognito:groups': 'WebAdmin',
    });
    const result = await requireWebAdminWithLookup(samLocalEvent);
    expect(result).toEqual(activeCaller);
    // The sub decoded from the bearer token must be passed to the lookup.
    expect(getWebAdminLookup).toHaveBeenCalledWith('web-admin-sub');
  });

  it('(f) DynamoDB transient error during METADATA lookup propagates as a thrown error (not silently converted to 403)', async () => {
    // If DynamoDB throws (e.g. a 503 or network timeout), the error must NOT be
    // swallowed or re-wrapped as a ForbiddenError. It should propagate so that the
    // handler's catch block can map it to a 500.
    const dbError = new Error('DynamoDB ServiceUnavailableException');
    vi.mocked(getWebAdminLookup).mockRejectedValue(dbError);
    const event = webAdminEvent('web-admin-sub');
    await expect(requireWebAdminWithLookup(event)).rejects.toThrow('DynamoDB ServiceUnavailableException');
    // Must NOT be a ForbiddenError — that would be the wrong status code.
    await expect(requireWebAdminWithLookup(event)).rejects.not.toThrow(ForbiddenError);
  });

  it('(g) Employee/Manager caller attempting a WebAdmin route is rejected before any DynamoDB call', async () => {
    // Role-escalation: a user in the Employee group tries to call requireWebAdminWithLookup.
    const employeeEvent = eventWithClaims({ 'cognito:groups': 'Employee', sub: 'employee-sub' });
    await expect(requireWebAdminWithLookup(employeeEvent)).rejects.toThrow(ForbiddenError);
    expect(getWebAdminLookup).not.toHaveBeenCalled();
  });

  it('(g) Manager caller attempting a WebAdmin route is rejected before any DynamoDB call', async () => {
    const managerEvent = eventWithClaims({ 'cognito:groups': 'Manager', sub: 'manager-sub' });
    await expect(requireWebAdminWithLookup(managerEvent)).rejects.toThrow(ForbiddenError);
    expect(getWebAdminLookup).not.toHaveBeenCalled();
  });

  it('(h) getWebAdminLookup is called with the correct sub regardless of which sub pool entry is used', async () => {
    // Use varied sub values to confirm the sub is forwarded accurately, not hardcoded.
    const subs = ['sub-alpha', 'sub-beta-99', '00000000-1111-2222-3333-444444444444'];
    for (const sub of subs) {
      vi.clearAllMocks();
      vi.mocked(getWebAdminLookup).mockResolvedValue({ ...activeCaller, sub });
      await requireWebAdminWithLookup(webAdminEvent(sub));
      expect(getWebAdminLookup).toHaveBeenCalledWith(sub);
    }
  });
});

// ─── decodeLocalJwtPayload ────────────────────────────────────────────────────
// Tests for the shared helper directly — not only via getCallerSub/getCallerGroups
// — so it is validated as independently usable by any future web-admin handler.

/**
 * Build a raw Authorization header string with an embedded JWT whose payload
 * is the given object (no real signature — decodeLocalJwtPayload does not
 * verify signatures, matching its local-dev-only contract).
 */
function bearerHeader(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `Bearer ${header}.${body}.fakesig`;
}

describe('decodeLocalJwtPayload', () => {
  it('is importable as a named export from shared/auth.ts', () => {
    // Verifies the export was not accidentally removed or renamed.
    expect(typeof decodeLocalJwtPayload).toBe('function');
  });

  it('parses a valid Bearer JWT and returns the payload as a Record', () => {
    const payload = { sub: 'test-sub', 'cognito:groups': ['WebAdmin'], email: 'a@b.com' };
    const result = decodeLocalJwtPayload(bearerHeader(payload));

    expect(result).not.toBeNull();
    expect(result!['sub']).toBe('test-sub');
    expect(result!['email']).toBe('a@b.com');
  });

  it('returns an object (not null) when the payload has no sub claim — deterministic on missing sub', () => {
    // Callers (getCallerSub etc.) are responsible for handling missing sub; the
    // decoder itself must succeed and return what it decoded, not null.
    const payload = { 'cognito:groups': ['WebAdmin'] };
    const result = decodeLocalJwtPayload(bearerHeader(payload));

    expect(result).not.toBeNull();
    expect(result!['sub']).toBeUndefined();
  });

  it('returns null when the header is not Bearer-prefixed', () => {
    expect(decodeLocalJwtPayload('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null when the header string is empty', () => {
    expect(decodeLocalJwtPayload('')).toBeNull();
  });

  it('returns null when the token has no dots (single segment, not a valid JWT)', () => {
    expect(decodeLocalJwtPayload('Bearer notavalidjwt')).toBeNull();
  });

  it('returns null when the token has only a header segment and no payload segment', () => {
    // "Bearer header." — the payload segment is empty string (falsy)
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    expect(decodeLocalJwtPayload(`Bearer ${header}.`)).toBeNull();
  });

  it('returns null when the payload segment is not valid JSON after base64 decode', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    const badPayload = Buffer.from('not-json-!!!').toString('base64url');
    expect(decodeLocalJwtPayload(`Bearer ${header}.${badPayload}.fakesig`)).toBeNull();
  });

  it('returns null for a header containing only "Bearer " with no token', () => {
    // Edge: "Bearer " prefix is present but the token part is empty.
    expect(decodeLocalJwtPayload('Bearer ')).toBeNull();
  });

  it('handles a payload with unicode characters without crashing', () => {
    const payload = { sub: 'sub-unicode', name: 'José Martínez', org: '日本語テスト' };
    const result = decodeLocalJwtPayload(bearerHeader(payload));
    expect(result).not.toBeNull();
    expect(result!['name']).toBe('José Martínez');
    expect(result!['org']).toBe('日本語テスト');
  });

  it('works across a pool of varied payloads without returning null (positive sweeptest)', () => {
    // Randomised sweep — surfaces value-specific decode bugs.
    const payloads: Record<string, unknown>[] = [
      { sub: 'aaa', 'cognito:groups': 'WebAdmin' },
      { sub: '00000000-1111-2222-3333-444444444444', nested: { a: 1 } },
      { sub: 'sub-with-special-chars-@#$%', roles: ['r1', 'r2'] },
      { sub: '', 'cognito:groups': [] },
      { sub: 'x'.repeat(300) },
    ];

    for (const payload of payloads) {
      const result = decodeLocalJwtPayload(bearerHeader(payload));
      expect(result, `payload=${JSON.stringify(payload)}`).not.toBeNull();
      expect(result!['sub'], `payload=${JSON.stringify(payload)}`).toBe(payload['sub']);
    }
  });
});
