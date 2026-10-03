/**
 * Role rule: an org admin OVERSEES the organization; shifts are scheduled by managers (an admin
 * does that through "View as Manager" on /manager/*). So /org-admin/shifts-needed is read-only, enforced
 * here on the server, not just by hiding buttons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

vi.mock('../../../../src/functions/org-admin/shifts-needed/service.js', () => ({
  listShiftsNeeded: vi.fn(),
}));

import { handler } from '../../../../src/functions/org-admin/shifts-needed/handler.js';
import * as service from '../../../../src/functions/org-admin/shifts-needed/service.js';

function event(method: string, groups: string, path = '/org-admin/shifts-needed') {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: { authorization: 'Bearer t' },
    queryStringParameters: { month: '2026-07' },
    pathParameters: path.includes('/org-admin/shifts-needed/') ? { shiftId: 's1' } : undefined,
    body: method === 'GET' ? undefined : '{}',
    requestContext: {
      accountId: '1',
      apiId: 'a',
      authorizer: { jwt: { claims: { 'cognito:groups': groups, sub: 'admin-sub' }, scopes: null } },
      domainName: 'd',
      domainPrefix: 'd',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '1.1.1.1', userAgent: 't' },
      requestId: 'r',
      routeKey: `${method} ${path}`,
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const call = async (e: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await handler(e)) as APIGatewayProxyStructuredResultV2;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(service.listShiftsNeeded).mockResolvedValue([]);
});

describe('/org-admin/shifts-needed is read-only', () => {
  it('lets an OrgAdmin list the org’s shifts-needed', async () => {
    const res = await call(event('GET', 'OrgAdmin'));
    expect(res.statusCode).toBe(200);
    expect(service.listShiftsNeeded).toHaveBeenCalledWith('admin-sub', '2026-07');
  });

  it.each([
    ['POST', '/org-admin/shifts-needed'],
    ['PUT', '/org-admin/shifts-needed/s1'],
    ['DELETE', '/org-admin/shifts-needed/s1'],
  ])(
    'refuses %s with 405 — creating/editing/deleting shifts is manager work',
    async (method, path) => {
      const res = await call(event(method, 'OrgAdmin', path));
      expect(res.statusCode).toBe(405);
      expect(service.listShiftsNeeded).not.toHaveBeenCalled();
    },
  );

  it('still requires the OrgAdmin group (a Manager cannot use the org-wide list)', async () => {
    const res = await call(event('GET', 'Manager'));
    expect(res.statusCode).toBe(403);
    expect(service.listShiftsNeeded).not.toHaveBeenCalled();
  });
});
