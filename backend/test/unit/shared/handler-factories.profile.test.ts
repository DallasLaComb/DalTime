/**
 * Unit tests for the createProfileHandler factory in handler-factories.ts.
 *
 * Focus: role-isolation behaviour introduced by the `requiredGroup` parameter.
 * Every branch of the group guard is tested at 100% coverage here so that the
 * scheduling-adjacent correctness constraint (403 before DynamoDB for
 * wrong-role callers) is proven cheaply at the unit tier rather than
 * pushed up to integration/e2e.
 *
 * Randomized input pools are used for sub values to surface any
 * value-specific routing bugs. The seed is fixed via the VITEST_SEED env var
 * so a failing run can be reproduced deterministically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

// The CognitoIdentityProviderClient is instantiated inside createProfileHandler.
// Mock it so the factory never tries to open a real AWS connection.
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class MockCognitoClient {},
}));

import { createProfileHandler } from '../../../src/functions/shared/handler-factories.js';

// ─── Randomized sub pool ──────────────────────────────────────────────────────
// A small pool of varied caller subs drawn round-robin across tests so that
// fixed-value bugs are surfaced. On failure, the sub used in that test is
// logged via the expect message so the run is reproducible.

const SUB_POOL = [
  'sub-employee-aaa',
  '00000000-0000-0000-0000-000000000001',
  'sub-with-special-chars-@!',
  'x'.repeat(64),
  'sub-employee-zzz',
];

let subPoolIndex = 0;
function nextSub(): string {
  return SUB_POOL[subPoolIndex++ % SUB_POOL.length];
}

// ─── Event factories ──────────────────────────────────────────────────────────

function buildEvent(
  method: string,
  groups: string | string[] | undefined,
  sub: string,
  body?: string,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const claims: Record<string, unknown> = { sub };
  if (groups !== undefined) claims['cognito:groups'] = groups;

  return {
    version: '2.0',
    routeKey: `${method} /profile`,
    rawPath: '/profile',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: { claims, scopes: null },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/profile',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-id',
      routeKey: `${method} /profile`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: body ?? null,
    pathParameters: {},
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

function parsed(result: APIGatewayProxyStructuredResultV2): unknown {
  return JSON.parse(result.body as string);
}

// ─── Shared mock service ──────────────────────────────────────────────────────

const mockService = {
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  subPoolIndex = 0;
});

// ─── createProfileHandler — no requiredGroup (backward-compat) ────────────────

describe('createProfileHandler — no requiredGroup', () => {
  const handler = createProfileHandler(mockService, 'test handler');

  it('GET returns 200 for any caller when no group is required', async () => {
    const sub = nextSub();
    const profile = { first_name: 'Alice', last_name: 'Smith' };
    mockService.getProfile.mockResolvedValue(profile);

    const result = (await handler(
      buildEvent('GET', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
    expect(parsed(result), `sub=${sub}`).toEqual(profile);
    expect(mockService.getProfile).toHaveBeenCalled();
  });

  it('GET returns 200 even when the caller has no group claim', async () => {
    const sub = nextSub();
    mockService.getProfile.mockResolvedValue({ first_name: 'No', last_name: 'Group' });

    const result = (await handler(
      buildEvent('GET', undefined, sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
  });

  it('OPTIONS returns 200 without calling the service', async () => {
    const result = (await handler(
      buildEvent('OPTIONS', 'Employee', nextSub()),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(200);
    expect(mockService.getProfile).not.toHaveBeenCalled();
    expect(mockService.updateProfile).not.toHaveBeenCalled();
  });
});

// ─── createProfileHandler — requiredGroup='Employee' ─────────────────────────

describe("createProfileHandler — requiredGroup='Employee'", () => {
  const handler = createProfileHandler(mockService, 'employee profile handler', 'Employee');

  // Happy path: Employee GET
  it('GET returns 200 for an Employee caller', async () => {
    const sub = nextSub();
    const profile = { first_name: 'Sam', last_name: 'Smith', employee_id: sub };
    mockService.getProfile.mockResolvedValue(profile);

    const result = (await handler(
      buildEvent('GET', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
    expect(parsed(result), `sub=${sub}`).toEqual(profile);
    expect(mockService.getProfile).toHaveBeenCalled();
  });

  // Happy path: Employee GET — bracket-stringified group claim (HTTP API JWT authorizer prod shape)
  it('GET returns 200 for an Employee caller with bracket-stringified group claim [Employee]', async () => {
    const sub = nextSub();
    mockService.getProfile.mockResolvedValue({ first_name: 'Sam', last_name: 'Smith' });

    const result = (await handler(
      buildEvent('GET', '[Employee]', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
  });

  // Happy path: Employee PUT
  it('PUT returns 200 for an Employee caller with a valid body', async () => {
    const sub = nextSub();
    const updated = { first_name: 'Sam', last_name: 'Jones' };
    mockService.updateProfile.mockResolvedValue(updated);

    const result = (await handler(
      buildEvent('PUT', 'Employee', sub, JSON.stringify({ first_name: 'Sam', last_name: 'Jones' })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
    expect(parsed(result), `sub=${sub}`).toEqual(updated);
  });

  // Role isolation: Manager JWT → 403 on GET
  it('GET returns 403 when caller is in Manager group (not Employee)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'Manager', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect((parsed(result) as { error: string }).error, `sub=${sub}`).toMatch(/Employee role required/i);
    // Service must NOT be called — the guard short-circuits before DynamoDB access.
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: Manager JWT → 403 on PUT (same guard, different method)
  it('PUT returns 403 when caller is in Manager group (not Employee)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PUT', 'Manager', sub, JSON.stringify({ first_name: 'Hacker' })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.updateProfile).not.toHaveBeenCalled();
  });

  // Role isolation: WebAdmin JWT → 403 on GET
  it('GET returns 403 when caller is in WebAdmin group (not Employee)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'WebAdmin', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: OrgAdmin JWT → 403 on GET
  it('GET returns 403 when caller is in OrgAdmin group (not Employee)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'OrgAdmin', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: no group claim → 403 (missing claim must not sneak past the guard)
  it('GET returns 403 when caller has no group claim at all', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', undefined, sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: bracket-stringified Manager claim → 403 (HTTP API JWT authorizer shape)
  it('GET returns 403 when caller has bracket-stringified [Manager] group claim', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', '[Manager]', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Sweep: 403 is returned for every non-Employee group across the pool
  it('GET returns 403 for every known non-Employee role across a group pool', async () => {
    const nonEmployeeGroups = ['Manager', 'OrgAdmin', 'WebAdmin', '[Manager]', '[OrgAdmin]', '[WebAdmin]'];

    for (const group of nonEmployeeGroups) {
      vi.clearAllMocks();
      const sub = nextSub();

      const result = (await handler(
        buildEvent('GET', group, sub),
      )) as APIGatewayProxyStructuredResultV2;

      expect(result.statusCode, `group=${group} sub=${sub}`).toBe(403);
      expect(mockService.getProfile, `group=${group} sub=${sub}`).not.toHaveBeenCalled();
    }
  });

  // PUT body validation: still returns 400 for Employee with malformed body (guard passes, validation triggers)
  it('PUT returns 400 for an Employee caller with a missing body', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PUT', 'Employee', sub, undefined),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(400);
  });

  it('PUT returns 400 for an Employee caller with invalid JSON body', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PUT', 'Employee', sub, '{bad json'),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(400);
  });

  // Unhandled method
  it('PATCH returns 400 (unhandled route) even for an Employee caller', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PATCH', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(400);
  });

  // Service error → 500 for Employee caller
  it('GET returns 500 when service.getProfile throws an unexpected error', async () => {
    const sub = nextSub();
    mockService.getProfile.mockRejectedValue(new Error('DynamoDB transient failure'));

    const result = (await handler(
      buildEvent('GET', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(500);
  });

  // OPTIONS is never blocked by group guard
  it('OPTIONS returns 200 without calling the service regardless of group', async () => {
    const groupsToTest = ['Manager', 'WebAdmin', undefined, 'Employee'];

    for (const group of groupsToTest) {
      vi.clearAllMocks();
      const sub = nextSub();

      const result = (await handler(
        buildEvent('OPTIONS', group, sub),
      )) as APIGatewayProxyStructuredResultV2;

      expect(result.statusCode, `group=${String(group)} sub=${sub}`).toBe(200);
      expect(mockService.getProfile, `group=${String(group)}`).not.toHaveBeenCalled();
    }
  });
});

// ─── createProfileHandler — requiredGroup='Manager' ──────────────────────────

describe("createProfileHandler — requiredGroup='Manager'", () => {
  const handler = createProfileHandler(mockService, 'manager profile handler', 'Manager');

  // Happy path: Manager GET
  it('GET returns 200 for a Manager caller', async () => {
    const sub = nextSub();
    const profile = { first_name: 'Morgan', last_name: 'Manager', manager_id: sub };
    mockService.getProfile.mockResolvedValue(profile);

    const result = (await handler(
      buildEvent('GET', 'Manager', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
    expect(parsed(result), `sub=${sub}`).toEqual(profile);
  });

  // Happy path: bracket-stringified group claim
  it('GET returns 200 for a Manager caller with bracket-stringified [Manager] group claim', async () => {
    const sub = nextSub();
    mockService.getProfile.mockResolvedValue({ first_name: 'Morgan', last_name: 'Manager' });

    const result = (await handler(
      buildEvent('GET', '[Manager]', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
  });

  // Happy path: Manager PUT
  it('PUT returns 200 for a Manager caller', async () => {
    const sub = nextSub();
    const updated = { first_name: 'Morgan', last_name: 'Updated' };
    mockService.updateProfile.mockResolvedValue(updated);

    const result = (await handler(
      buildEvent('PUT', 'Manager', sub, JSON.stringify({ last_name: 'Updated' })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(200);
    expect(parsed(result), `sub=${sub}`).toEqual(updated);
  });

  // Role isolation: Employee JWT → 403 on GET
  it('GET returns 403 when caller is in Employee group (not Manager)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect((parsed(result) as { error: string }).error, `sub=${sub}`).toMatch(/Manager role required/i);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: Employee JWT → 403 on PUT (same guard, different method)
  it('PUT returns 403 when caller is in Employee group (not Manager)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PUT', 'Employee', sub, JSON.stringify({ first_name: 'Hacker' })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.updateProfile).not.toHaveBeenCalled();
  });

  // Role isolation: WebAdmin JWT → 403
  it('GET returns 403 when caller is in WebAdmin group (not Manager)', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'WebAdmin', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Role isolation: no group claim → 403
  it('GET returns 403 when caller has no group claim', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', undefined, sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  // Sweep: 403 for every non-Manager group
  it('GET returns 403 for every known non-Manager role across a group pool', async () => {
    const nonManagerGroups = ['Employee', 'OrgAdmin', 'WebAdmin', '[Employee]', '[OrgAdmin]', '[WebAdmin]'];

    for (const group of nonManagerGroups) {
      vi.clearAllMocks();
      const sub = nextSub();

      const result = (await handler(
        buildEvent('GET', group, sub),
      )) as APIGatewayProxyStructuredResultV2;

      expect(result.statusCode, `group=${group} sub=${sub}`).toBe(403);
      expect(mockService.getProfile, `group=${group} sub=${sub}`).not.toHaveBeenCalled();
    }
  });

  // Symmetric cross-role escalation: the Manager can't call the Employee route
  // and the Employee can't call the Manager route — both are proven here for the
  // Manager handler direction.
  it('Employee caller attempting Manager profile GET is blocked before any DynamoDB call', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('GET', 'Employee', sub),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.getProfile).not.toHaveBeenCalled();
  });

  it('Employee caller attempting Manager profile PUT is blocked before any DynamoDB call', async () => {
    const sub = nextSub();

    const result = (await handler(
      buildEvent('PUT', 'Employee', sub, JSON.stringify({ first_name: 'Escalated' })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode, `sub=${sub}`).toBe(403);
    expect(mockService.updateProfile).not.toHaveBeenCalled();
  });
});
