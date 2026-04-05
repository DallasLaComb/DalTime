import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

// Mock the service module before importing the handler
vi.mock('../../../../src/functions/web-admin/organizations/service.js', () => ({
  ValidationError: class ValidationError extends Error {},
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
}));

import { handler } from '../../../../src/functions/web-admin/organizations/handler.js';
import {
  ValidationError,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../../../../src/functions/web-admin/organizations/service.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function buildApiGwEvent(
  overrides: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> & {
    method?: string;
    routeKey?: string;
  } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const method = overrides.method ?? 'GET';
  return {
    version: '2.0',
    routeKey: overrides.routeKey ?? `${method} /organizations`,
    rawPath: '/organizations',
    rawQueryString: '',
    headers: { authorization: 'Bearer test-token' },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: {
        jwt: {
          claims: { 'cognito:groups': 'WebAdmin', sub: 'user-123' },
          scopes: null,
        },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/organizations',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: overrides.routeKey ?? `${method} /organizations`,
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

const mockOrg = {
  org_id: 'org-123',
  name: 'Acme Corp',
  address: '123 Main St',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  org_admin_ids: [],
};

function body(result: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(result.body as string);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPTIONS /organizations — CORS preflight', () => {
  it('returns 200 with empty body', async () => {
    const event = buildApiGwEvent({ method: 'OPTIONS', routeKey: 'OPTIONS /organizations' });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });
});

describe('GET /organizations — list', () => {
  it('returns 200 with array of organizations', async () => {
    vi.mocked(listOrganizations).mockResolvedValue([mockOrg]);
    const event = buildApiGwEvent({ method: 'GET', routeKey: 'GET /organizations' });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
    expect(body(result)).toEqual([mockOrg]);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(listOrganizations).mockRejectedValue(new Error('DynamoDB unavailable'));
    const event = buildApiGwEvent({ method: 'GET', routeKey: 'GET /organizations' });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

describe('POST /organizations — create', () => {
  it('returns 201 with created organization', async () => {
    vi.mocked(createOrganization).mockResolvedValue(mockOrg);
    const event = buildApiGwEvent({
      method: 'POST',
      routeKey: 'POST /organizations',
      body: JSON.stringify({ name: 'Acme Corp', address: '123 Main St' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(201);
    expect(body(result)).toEqual(mockOrg);
  });

  it('returns 400 when body is missing', async () => {
    const event = buildApiGwEvent({ method: 'POST', routeKey: 'POST /organizations' });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Request body is required' });
  });

  it('returns 400 when body is invalid JSON', async () => {
    const event = buildApiGwEvent({
      method: 'POST',
      routeKey: 'POST /organizations',
      body: '{not-valid-json',
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 when service throws ValidationError for missing name', async () => {
    vi.mocked(createOrganization).mockRejectedValue(new ValidationError('name is required'));
    const event = buildApiGwEvent({
      method: 'POST',
      routeKey: 'POST /organizations',
      body: JSON.stringify({ address: '123 Main St' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'name is required' });
  });

  it('returns 400 when service throws ValidationError for missing address', async () => {
    vi.mocked(createOrganization).mockRejectedValue(new ValidationError('address is required'));
    const event = buildApiGwEvent({
      method: 'POST',
      routeKey: 'POST /organizations',
      body: JSON.stringify({ name: 'Acme Corp' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'address is required' });
  });

  it('returns 500 when service throws an unexpected error', async () => {
    vi.mocked(createOrganization).mockRejectedValue(new Error('DynamoDB unavailable'));
    const event = buildApiGwEvent({
      method: 'POST',
      routeKey: 'POST /organizations',
      body: JSON.stringify({ name: 'Acme Corp', address: '123 Main St' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

describe('GET /organizations/{orgId} — get by ID', () => {
  it('returns 200 with the organization', async () => {
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    const event = buildApiGwEvent({
      method: 'GET',
      routeKey: 'GET /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
    expect(body(result)).toEqual(mockOrg);
  });

  it('returns 404 when organization does not exist', async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);
    const event = buildApiGwEvent({
      method: 'GET',
      routeKey: 'GET /organizations/{orgId}',
      pathParameters: { orgId: 'unknown-id' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "Organization 'unknown-id' not found" });
  });

  it('returns 400 when orgId path param is missing', async () => {
    const event = buildApiGwEvent({
      method: 'GET',
      routeKey: 'GET /organizations/{orgId}',
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'orgId path parameter is required' });
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(getOrganization).mockRejectedValue(new Error('DynamoDB unavailable'));
    const event = buildApiGwEvent({
      method: 'GET',
      routeKey: 'GET /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

describe('PUT /organizations/{orgId} — update', () => {
  it('returns 200 with updated organization', async () => {
    const updated = { ...mockOrg, name: 'Updated Name' };
    vi.mocked(updateOrganization).mockResolvedValue(updated);
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
    expect(body(result)).toEqual(updated);
  });

  it('returns 404 when organization does not exist', async () => {
    vi.mocked(updateOrganization).mockResolvedValue(null);
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      pathParameters: { orgId: 'unknown-id' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "Organization 'unknown-id' not found" });
  });

  it('returns 400 when body is missing', async () => {
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Request body is required' });
  });

  it('returns 400 when body is invalid JSON', async () => {
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
      body: '{bad-json',
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 when orgId path param is missing', async () => {
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'orgId path parameter is required' });
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(updateOrganization).mockRejectedValue(new Error('DynamoDB unavailable'));
    const event = buildApiGwEvent({
      method: 'PUT',
      routeKey: 'PUT /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});

describe('DELETE /organizations/{orgId} — delete', () => {
  it('returns 204 when organization is deleted', async () => {
    vi.mocked(deleteOrganization).mockResolvedValue(true);
    const event = buildApiGwEvent({
      method: 'DELETE',
      routeKey: 'DELETE /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(204);
  });

  it('returns 404 when organization does not exist', async () => {
    vi.mocked(deleteOrganization).mockResolvedValue(false);
    const event = buildApiGwEvent({
      method: 'DELETE',
      routeKey: 'DELETE /organizations/{orgId}',
      pathParameters: { orgId: 'unknown-id' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
    expect(body(result)).toEqual({ error: "Organization 'unknown-id' not found" });
  });

  it('returns 400 when orgId path param is missing', async () => {
    const event = buildApiGwEvent({
      method: 'DELETE',
      routeKey: 'DELETE /organizations/{orgId}',
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(400);
    expect(body(result)).toEqual({ error: 'orgId path parameter is required' });
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(deleteOrganization).mockRejectedValue(new Error('DynamoDB unavailable'));
    const event = buildApiGwEvent({
      method: 'DELETE',
      routeKey: 'DELETE /organizations/{orgId}',
      pathParameters: { orgId: 'org-123' },
    });
    const result = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(500);
    expect(body(result)).toEqual({ error: 'An unexpected error occurred' });
  });
});
