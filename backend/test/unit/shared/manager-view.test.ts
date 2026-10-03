/**
 * "View as manager": an OrgAdmin may use /manager/* routes as a manager only by asking for it
 * (X-View-As: manager) — and nobody else gets anything from that header.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { withManagerView } from '../../../src/functions/shared/manager-view.js';
import { withRequiredGroup } from '../../../src/functions/shared/require-group.js';
import { getCallerGroups, getCallerSub } from '../../../src/functions/shared/auth.js';

function event(
  path: string,
  groups: string[],
  headers: Record<string, string> = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    rawPath: path,
    headers,
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'admin-1', 'cognito:groups': groups }, scopes: null } },
      http: { method: 'GET' },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const seen: { groups: string[]; sub: string; headers: unknown; claims: Record<string, unknown> }[] =
  [];
const inner = vi.fn(async (e: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  seen.push({
    groups: getCallerGroups(e),
    sub: getCallerSub(e),
    headers: e.headers,
    claims: e.requestContext.authorizer.jwt.claims as Record<string, unknown>,
  });
  return { statusCode: 200, body: '' } as APIGatewayProxyStructuredResultV2;
});
// the real composition used by every manager handler
const handler = withManagerView(withRequiredGroup(inner, 'Manager', 'test'));
const run = async (e: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await handler(e)) as APIGatewayProxyStructuredResultV2;

describe('withManagerView', () => {
  it('lets an OrgAdmin who asks act as a Manager, keeping their own sub', async () => {
    seen.length = 0;
    const res = await run(event('/manager/shifts', ['OrgAdmin'], { 'X-View-As': 'manager' }));

    expect(res.statusCode).toBe(200);
    expect(seen[0].groups).toEqual(['Manager']);
    expect(seen[0].sub).toBe('admin-1');
    expect(seen[0].claims['act_role']).toBe('OrgAdmin');
  });

  it('does not leak the header to the handler and reads it case-insensitively', async () => {
    seen.length = 0;
    await run(event('/manager/shifts', ['OrgAdmin'], { 'x-view-as': 'Manager' }));
    expect(seen[0].headers).not.toHaveProperty('x-view-as');
  });

  it('refuses an OrgAdmin who has NOT asked — manager routes are not theirs by default', async () => {
    const res = await run(event('/manager/shifts', ['OrgAdmin']));
    expect(res.statusCode).toBe(403);
  });

  it.each(['Employee', 'WebAdmin'])('gives a %s nothing for sending the header', async (group) => {
    const res = await run(event('/manager/shifts', [group], { 'X-View-As': 'manager' }));
    expect(res.statusCode).toBe(403);
  });

  it('does not change a real Manager’s request', async () => {
    seen.length = 0;
    const res = await run(event('/manager/shifts', ['Manager'], { 'X-View-As': 'manager' }));
    expect(res.statusCode).toBe(200);
    expect(seen[0].claims).not.toHaveProperty('act_role');
  });

  it('only applies on /manager routes', async () => {
    const res = await run(event('/employee/schedule', ['OrgAdmin'], { 'X-View-As': 'manager' }));
    expect(res.statusCode).toBe(403);
  });

  it('ignores any value other than "manager"', async () => {
    const res = await run(event('/manager/shifts', ['OrgAdmin'], { 'X-View-As': 'webadmin' }));
    expect(res.statusCode).toBe(403);
  });
});
