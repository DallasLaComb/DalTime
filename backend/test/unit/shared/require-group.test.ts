import { describe, it, expect, vi } from 'vitest';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { withRequiredGroup } from '../../../src/functions/shared/require-group.js';

function event(method: string, groups?: unknown): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    headers: {},
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'u1', 'cognito:groups': groups }, scopes: null } },
      http: { method },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

describe('withRequiredGroup', () => {
  const inner = vi.fn(async () => ({ statusCode: 200, body: '' }));
  const guarded = withRequiredGroup(inner, 'OrgAdmin', 'test');

  it('calls the handler when the caller is in the group', async () => {
    inner.mockClear();
    await guarded(event('GET', ['OrgAdmin']));
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('accepts the HTTP API bracket-string form of the groups claim', async () => {
    inner.mockClear();
    await guarded(event('POST', '[OrgAdmin]'));
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('returns 403 without calling the handler when the caller is a Manager', async () => {
    inner.mockClear();
    const res = (await guarded(event('POST', ['Manager']))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(403);
    expect(inner).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller has no groups', async () => {
    inner.mockClear();
    const res = (await guarded(event('GET'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(403);
    expect(inner).not.toHaveBeenCalled();
  });

  it('passes OPTIONS preflight through without a group', async () => {
    inner.mockClear();
    await guarded(event('OPTIONS'));
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
