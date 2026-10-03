import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

vi.mock('../../../../src/functions/shared/broadcasts/service.js', () => ({
  listActiveForCaller: vi.fn(),
  dismissBroadcast: vi.fn(),
}));
// Real group/sub parsing; only the WebAdmin DynamoDB lookup (used by withImpersonation) is stubbed.
vi.mock('../../../../src/functions/shared/auth.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/functions/shared/auth.js')>()),
  requireWebAdminWithLookup: vi.fn(),
}));

import type { ActiveBroadcastResponse } from '@daltime/contracts';
import { handler } from '../../../../src/functions/shared/broadcasts/handler.js';
import { NotFoundError } from '../../../../src/functions/shared/errors.js';
import {
  listActiveForCaller,
  dismissBroadcast,
} from '../../../../src/functions/shared/broadcasts/service.js';
import { requireWebAdminWithLookup } from '../../../../src/functions/shared/auth.js';

const BROADCAST_ID = '3f1c2b9e-8d7a-4c6b-9e5f-1a2b3c4d5e6f';

function buildApiGwEvent(
  opts: {
    method?: string;
    path?: string;
    groups?: string;
    pathParameters?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const method = opts.method ?? 'GET';
  const path = opts.path ?? '/employee/broadcasts/active';
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: { authorization: 'Bearer test-token', ...opts.headers },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: {
          claims: { sub: 'caller-sub', 'cognito:groups': opts.groups ?? '[Employee]' },
          scopes: null,
        },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'test-id',
      routeKey: `${method} ${path}`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: null,
    pathParameters: opts.pathParameters ?? {},
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

async function call(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  return (await handler(event)) as APIGatewayProxyStructuredResultV2;
}

const mockBroadcast: ActiveBroadcastResponse = {
  broadcast_id: BROADCAST_ID,
  message: 'DalTime maintenance is aware of an issue with setting availability.',
  severity: 'WARNING',
  created_at: '2026-09-29T00:00:00.000Z',
};

beforeEach(() => vi.resetAllMocks());

describe('OPTIONS', () => {
  it('returns 200 without calling the service', async () => {
    const result = await call(buildApiGwEvent({ method: 'OPTIONS' }));
    expect(result.statusCode).toBe(200);
    expect(listActiveForCaller).not.toHaveBeenCalled();
  });
});

describe('GET /{role}/broadcasts/active', () => {
  it.each([
    ['/employee/broadcasts/active', '[Employee]', 'Employee'],
    ['/manager/broadcasts/active', '[Manager]', 'Manager'],
    ['/org-admin/broadcasts/active', '[OrgAdmin]', 'OrgAdmin'],
    ['/web-admin/broadcasts/active', '[WebAdmin]', 'WebAdmin'],
  ])('%s serves the caller as %s', async (path, groups, role) => {
    vi.mocked(listActiveForCaller).mockResolvedValue([mockBroadcast]);
    const result = await call(buildApiGwEvent({ path, groups }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual([mockBroadcast]);
    expect(listActiveForCaller).toHaveBeenCalledWith('caller-sub', role);
  });

  it('returns 403 when the caller does not hold the route role', async () => {
    const result = await call(
      buildApiGwEvent({ path: '/org-admin/broadcasts/active', groups: '[Employee]' }),
    );
    expect(result.statusCode).toBe(403);
    expect(listActiveForCaller).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected error', async () => {
    vi.mocked(listActiveForCaller).mockRejectedValue(new Error('boom'));
    const result = await call(buildApiGwEvent());
    expect(result.statusCode).toBe(500);
  });
});

describe('PUT /{role}/broadcasts/{broadcastId}/dismissal', () => {
  const path = `/employee/broadcasts/${BROADCAST_ID}/dismissal`;

  it('dismisses and returns { success: true }', async () => {
    vi.mocked(dismissBroadcast).mockResolvedValue();
    const result = await call(
      buildApiGwEvent({ method: 'PUT', path, pathParameters: { broadcastId: BROADCAST_ID } }),
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ success: true });
    expect(dismissBroadcast).toHaveBeenCalledWith('caller-sub', 'Employee', BROADCAST_ID);
  });

  it('returns 400 for a non-UUID id', async () => {
    const result = await call(
      buildApiGwEvent({ method: 'PUT', path, pathParameters: { broadcastId: 'bad#id' } }),
    );
    expect(result.statusCode).toBe(400);
    expect(dismissBroadcast).not.toHaveBeenCalled();
  });

  it('returns 404 when the broadcast is not addressed to the caller', async () => {
    vi.mocked(dismissBroadcast).mockRejectedValue(new NotFoundError('not found'));
    const result = await call(
      buildApiGwEvent({ method: 'PUT', path, pathParameters: { broadcastId: BROADCAST_ID } }),
    );
    expect(result.statusCode).toBe(404);
  });

  it('returns 403 under impersonation (read-only) without dismissing', async () => {
    vi.mocked(requireWebAdminWithLookup).mockResolvedValue({
      sub: 'admin-sub',
      web_admin_id: 'WADMIN#1',
      email: 'a@example.com',
      status: 'ACTIVE',
    });
    const result = await call(
      buildApiGwEvent({
        method: 'PUT',
        path,
        groups: '[WebAdmin]',
        pathParameters: { broadcastId: BROADCAST_ID },
        headers: { 'x-impersonate-user': 'employee-sub' },
      }),
    );
    expect(result.statusCode).toBe(403);
    expect(dismissBroadcast).not.toHaveBeenCalled();
  });
});
