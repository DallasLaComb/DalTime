import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { ForbiddenError, NotFoundError } from '../../../../src/functions/shared/errors.js';

vi.mock('../../../../src/functions/shared/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    addContext: vi.fn(),
    appendKeys: vi.fn(),
    resetKeys: vi.fn(),
  },
  serializeError: vi.fn((e: unknown) => ({ error: String(e) })),
}));
vi.mock('../../../../src/functions/web-admin/broadcasts/service.js', () => ({
  createBroadcast: vi.fn(),
  listActiveBroadcasts: vi.fn(),
  deleteBroadcast: vi.fn(),
}));
vi.mock('../../../../src/functions/shared/auth.js', () => ({
  requireWebAdminWithLookup: vi.fn(),
  getCallerSub: vi.fn(() => ''),
  getCallerGroups: vi.fn(() => []),
}));

import { CreateBroadcastBody, type BroadcastResponse } from '@daltime/contracts';
import { contractErrorMessage } from '../../helpers/contract-error.js';
import { handler } from '../../../../src/functions/web-admin/broadcasts/handler.js';
import {
  createBroadcast,
  listActiveBroadcasts,
  deleteBroadcast,
} from '../../../../src/functions/web-admin/broadcasts/service.js';
import { requireWebAdminWithLookup } from '../../../../src/functions/shared/auth.js';

const mockCaller = {
  sub: 'web-admin-sub',
  web_admin_id: 'WADMIN#uuid-1',
  email: 'admin@example.com',
  status: 'ACTIVE' as const,
};

const BROADCAST_ID = '3f1c2b9e-8d7a-4c6b-9e5f-1a2b3c4d5e6f';

const mockBroadcast: BroadcastResponse = {
  broadcast_id: BROADCAST_ID,
  message: 'Scheduled maintenance tonight 9pm-10pm.',
  severity: 'WARNING',
  target_scope: 'ALL',
  expires_at: '2099-01-01T03:00:00.000Z',
  created_at: '2026-09-29T00:00:00.000Z',
  created_by_web_admin_id: 'WADMIN#uuid-1',
};

function buildApiGwEvent(
  overrides: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> & { method?: string } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const method = overrides.method ?? 'GET';
  return {
    version: '2.0',
    routeKey: `${method} /web-admin/broadcasts`,
    rawPath: '/web-admin/broadcasts',
    rawQueryString: '',
    headers: { authorization: 'Bearer test-token' },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: {
        jwt: { claims: { 'cognito:groups': 'WebAdmin', sub: 'web-admin-sub' }, scopes: null },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/web-admin/broadcasts',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: `${method} /web-admin/broadcasts`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: null,
    pathParameters: undefined,
    ...overrides,
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

async function call(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  return (await handler(event)) as APIGatewayProxyStructuredResultV2;
}

function body(result: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(result.body as string);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireWebAdminWithLookup).mockResolvedValue(mockCaller);
});

describe('OPTIONS', () => {
  it('returns 200 without an auth check', async () => {
    const result = await call(buildApiGwEvent({ method: 'OPTIONS' }));
    expect(result.statusCode).toBe(200);
    expect(requireWebAdminWithLookup).not.toHaveBeenCalled();
  });
});

describe('authorization', () => {
  it.each(['POST', 'GET', 'DELETE'])(
    'returns 403 for a non-WebAdmin caller on %s',
    async (method) => {
      vi.mocked(requireWebAdminWithLookup).mockRejectedValue(
        new ForbiddenError('WebAdmin role required'),
      );
      const result = await call(
        buildApiGwEvent({
          method,
          body: JSON.stringify({ message: 'x', severity: 'INFO', target_scope: 'ALL' }),
          ...(method === 'DELETE' && { pathParameters: { broadcastId: BROADCAST_ID } }),
        }),
      );
      expect(result.statusCode).toBe(403);
      expect(createBroadcast).not.toHaveBeenCalled();
      expect(listActiveBroadcasts).not.toHaveBeenCalled();
      expect(deleteBroadcast).not.toHaveBeenCalled();
    },
  );
});

describe('POST /web-admin/broadcasts', () => {
  it.each([
    { message: 'All users', severity: 'INFO', target_scope: 'ALL' },
    { message: 'One org', severity: 'WARNING', target_scope: 'ORG', org_id: 'org-1' },
    {
      message: 'Org role',
      severity: 'CRITICAL',
      target_scope: 'ORG_ROLE',
      org_id: 'org-1',
      role: 'Manager',
    },
  ])('returns 201 for target $target_scope', async (input) => {
    vi.mocked(createBroadcast).mockResolvedValue(mockBroadcast);
    const result = await call(buildApiGwEvent({ method: 'POST', body: JSON.stringify(input) }));
    expect(result.statusCode).toBe(201);
    expect(body(result)).toEqual(mockBroadcast);
    expect(createBroadcast).toHaveBeenCalledWith(expect.objectContaining(input), 'WADMIN#uuid-1');
  });

  it.each([
    ['org_id missing for ORG', { message: 'x', severity: 'INFO', target_scope: 'ORG' }],
    [
      'role missing for ORG_ROLE',
      { message: 'x', severity: 'INFO', target_scope: 'ORG_ROLE', org_id: 'o' },
    ],
    ['blank message', { message: '   ', severity: 'INFO', target_scope: 'ALL' }],
    ['message over 500 chars', { message: 'a'.repeat(501), severity: 'INFO', target_scope: 'ALL' }],
    ['unknown severity', { message: 'x', severity: 'LOUD', target_scope: 'ALL' }],
    ['org_id with #', { message: 'x', severity: 'INFO', target_scope: 'ORG', org_id: 'a#b' }],
  ])('returns 400 for %s', async (_label, input) => {
    const result = await call(buildApiGwEvent({ method: 'POST', body: JSON.stringify(input) }));
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: contractErrorMessage(CreateBroadcastBody, input) });
    expect(createBroadcast).not.toHaveBeenCalled();
  });

  it('returns 404 when the service reports an unknown org', async () => {
    vi.mocked(createBroadcast).mockRejectedValue(
      new NotFoundError("Organization 'org-x' not found"),
    );
    const result = await call(
      buildApiGwEvent({
        method: 'POST',
        body: JSON.stringify({
          message: 'x',
          severity: 'INFO',
          target_scope: 'ORG',
          org_id: 'org-x',
        }),
      }),
    );
    expect(result.statusCode).toBe(404);
  });
});

describe('GET /web-admin/broadcasts', () => {
  it('returns 200 with the active list', async () => {
    vi.mocked(listActiveBroadcasts).mockResolvedValue([mockBroadcast]);
    const result = await call(buildApiGwEvent());
    expect(result.statusCode).toBe(200);
    expect(body(result)).toEqual([mockBroadcast]);
  });
});

describe('DELETE /web-admin/broadcasts/{broadcastId}', () => {
  it('returns 204 and passes the auditing web_admin_id', async () => {
    vi.mocked(deleteBroadcast).mockResolvedValue();
    const result = await call(
      buildApiGwEvent({ method: 'DELETE', pathParameters: { broadcastId: BROADCAST_ID } }),
    );
    expect(result.statusCode).toBe(204);
    expect(deleteBroadcast).toHaveBeenCalledWith(BROADCAST_ID, 'WADMIN#uuid-1');
  });

  it('returns 400 for a non-UUID id', async () => {
    const result = await call(
      buildApiGwEvent({ method: 'DELETE', pathParameters: { broadcastId: 'nope' } }),
    );
    expect(result.statusCode).toBe(400);
    expect(deleteBroadcast).not.toHaveBeenCalled();
  });

  it('returns 404 when the broadcast is not active', async () => {
    vi.mocked(deleteBroadcast).mockRejectedValue(new NotFoundError('not found'));
    const result = await call(
      buildApiGwEvent({ method: 'DELETE', pathParameters: { broadcastId: BROADCAST_ID } }),
    );
    expect(result.statusCode).toBe(404);
  });
});

it('returns 500 on an unexpected service error', async () => {
  vi.mocked(listActiveBroadcasts).mockRejectedValue(new Error('DynamoDB failure'));
  const result = await call(buildApiGwEvent());
  expect(result.statusCode).toBe(500);
});
