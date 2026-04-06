import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

vi.mock('../../../../src/functions/web-admin/org-admins/service.js', () => ({
  ValidationError: class ValidationError extends Error {},
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  listOrgAdmins: vi.fn(),
  createOrgAdmin: vi.fn(),
  disableOrgAdmin: vi.fn(),
  deleteOrgAdmin: vi.fn(),
}));

// Prevent the real CognitoIdentityProviderClient from being instantiated.
// Must use a class (not arrow function) — arrow functions can't be used with `new`.
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class MockCognitoClient {
    send = vi.fn();
  },
  AdminCreateUserCommand: vi.fn(),
  AdminAddUserToGroupCommand: vi.fn(),
  AdminDeleteUserCommand: vi.fn(),
  AdminGetUserCommand: vi.fn(),
  UsernameExistsException: class UsernameExistsException extends Error {},
  InvalidPasswordException: class InvalidPasswordException extends Error {},
}));

import { handler } from '../../../../src/functions/web-admin/org-admins/handler.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  listOrgAdmins,
  createOrgAdmin,
  disableOrgAdmin,
  deleteOrgAdmin,
} from '../../../../src/functions/web-admin/org-admins/service.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function buildApiGwEvent(
  overrides: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> & { method?: string } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const method = overrides.method ?? 'GET';
  const routeKey = overrides.routeKey ?? `${method} /web-admin/organizations/{orgId}/org-admins`;
  return {
    version: '2.0',
    routeKey,
    rawPath: '/web-admin/organizations/org-123/org-admins',
    rawQueryString: '',
    headers: { authorization: 'Bearer test-token' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: { claims: { 'cognito:groups': 'WebAdmin', sub: 'admin-sub' }, scopes: null },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/web-admin/organizations/org-123/org-admins',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-id',
      routeKey,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: null,
    pathParameters: { orgId: 'org-123' },
    ...overrides,
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const mockUser = {
  user_id: 'user-sub-123',
  email: 'admin@acme.com',
  name: 'Jane Admin',
  org_id: 'org-123',
  status: 'FORCE_CHANGE_PASSWORD',
  created_at: '2025-01-01T00:00:00.000Z',
};

function body(result: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(result.body as string);
}

beforeEach(() => vi.clearAllMocks());

// ─── OPTIONS ─────────────────────────────────────────────────────────────────

describe('OPTIONS — CORS preflight', () => {
  it('returns 200', async () => {
    const result = (await handler(
      buildApiGwEvent({ method: 'OPTIONS', routeKey: 'OPTIONS /web-admin/organizations/{orgId}/org-admins' }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });
});

// ─── GET /web-admin/organizations/{orgId}/org-admins ─────────────────────────

describe('GET /web-admin/organizations/{orgId}/org-admins — list', () => {
  it('returns 200 with array of org admins', async () => {
    vi.mocked(listOrgAdmins).mockResolvedValue([mockUser]);
    const result = (await handler(buildApiGwEvent())) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
    expect(body(result)).toEqual([mockUser]);
  });

  it('returns 400 when orgId is missing', async () => {
    const result = (await handler(
      buildApiGwEvent({ pathParameters: undefined }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'orgId path parameter is required' });
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(listOrgAdmins).mockRejectedValue(new Error('DynamoDB failure'));
    const result = (await handler(buildApiGwEvent())) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

// ─── POST /web-admin/organizations/{orgId}/org-admins ────────────────────────

describe('POST /web-admin/organizations/{orgId}/org-admins — create', () => {
  const validBody = JSON.stringify({ email: 'admin@acme.com', name: 'Jane Admin', temp_password: 'Temp@1234' });

  it('returns 201 with the created user', async () => {
    vi.mocked(createOrgAdmin).mockResolvedValue(mockUser);
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(201);
    expect(body(result)).toEqual(mockUser);
  });

  it('returns 400 when body is missing', async () => {
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins' }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Request body is required' });
  });

  it('returns 400 when body is invalid JSON', async () => {
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: '{bad' }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 when service throws ValidationError for missing email', async () => {
    vi.mocked(createOrgAdmin).mockRejectedValue(new ValidationError('email is required'));
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'email is required' });
  });

  it('returns 400 when service throws ValidationError for invalid email', async () => {
    vi.mocked(createOrgAdmin).mockRejectedValue(new ValidationError('email must be a valid email address'));
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'email must be a valid email address' });
  });

  it('returns 404 when org is not found', async () => {
    vi.mocked(createOrgAdmin).mockRejectedValue(new NotFoundError("Organization 'org-123' not found"));
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "Organization 'org-123' not found" });
  });

  it('returns 409 when email already exists', async () => {
    vi.mocked(createOrgAdmin).mockRejectedValue(new ConflictError('A user with this email already exists'));
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(409);
    expect(body(result)).toEqual({ error: 'A user with this email already exists' });
  });

  it('returns 500 when service throws an unexpected error', async () => {
    vi.mocked(createOrgAdmin).mockRejectedValue(new Error('Cognito failure'));
    const result = (await handler(
      buildApiGwEvent({ method: 'POST', routeKey: 'POST /web-admin/organizations/{orgId}/org-admins', body: validBody }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

// ─── DELETE /web-admin/organizations/{orgId}/org-admins/{userId} ─────────────

describe('DELETE /web-admin/organizations/{orgId}/org-admins/{userId} — delete', () => {
  it('returns 204 when user is deleted', async () => {
    vi.mocked(deleteOrgAdmin).mockResolvedValue(undefined);
    const result = (await handler(
      buildApiGwEvent({
        method: 'DELETE',
        routeKey: 'DELETE /web-admin/organizations/{orgId}/org-admins/{userId}',
        pathParameters: { orgId: 'org-123', userId: 'user-sub-123' },
      }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(204);
  });

  it('returns 400 when userId is missing', async () => {
    const result = (await handler(
      buildApiGwEvent({
        method: 'DELETE',
        routeKey: 'DELETE /web-admin/organizations/{orgId}/org-admins/{userId}',
        pathParameters: { orgId: 'org-123' },
      }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'userId path parameter is required' });
  });

  it('returns 404 when user is not found', async () => {
    vi.mocked(deleteOrgAdmin).mockRejectedValue(new NotFoundError("User 'user-sub-123' not found"));
    const result = (await handler(
      buildApiGwEvent({
        method: 'DELETE',
        routeKey: 'DELETE /web-admin/organizations/{orgId}/org-admins/{userId}',
        pathParameters: { orgId: 'org-123', userId: 'user-sub-123' },
      }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "User 'user-sub-123' not found" });
  });

  it('returns 500 when service throws an unexpected error', async () => {
    vi.mocked(deleteOrgAdmin).mockRejectedValue(new Error('Cognito failure'));
    const result = (await handler(
      buildApiGwEvent({
        method: 'DELETE',
        routeKey: 'DELETE /web-admin/organizations/{orgId}/org-admins/{userId}',
        pathParameters: { orgId: 'org-123', userId: 'user-sub-123' },
      }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});
