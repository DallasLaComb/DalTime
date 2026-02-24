import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type {
  Organization,
  CreateOrganizationBody,
  UpdateOrganizationBody,
} from '../../shared/models/web-admin/organization.model.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  internalError,
} from '../../shared/response.js';
import { docClient, TABLE_NAME, GSI1_INDEX, stripKeys } from '../../shared/dynamo.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const routeKey = event.routeKey; // format: "METHOD /path"
  const orgId = event.pathParameters?.orgId;

  console.log('routeKey:', routeKey, '| orgId:', orgId);

  // Handle CORS preflight — SAM Local does not process the API Gateway
  // CorsConfiguration, so the Lambda must respond to OPTIONS itself.
  if (event.requestContext.http.method === 'OPTIONS') {
    return ok('');
  }

  try {
    // ------------------------------------------------------------------ //
    // GET /organizations — list all organizations
    // ------------------------------------------------------------------ //
    if (routeKey === 'GET /organizations') {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: GSI1_INDEX,
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': 'ORG' },
        }),
      );
      return ok((result.Items ?? []).map(stripKeys));
    }

    // ------------------------------------------------------------------ //
    // POST /organizations — create a new organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'POST /organizations') {
      if (!event.body) {
        return badRequest('Request body is required');
      }

      let body: CreateOrganizationBody;
      try {
        body = JSON.parse(event.body) as CreateOrganizationBody;
      } catch {
        return badRequest('Invalid JSON body');
      }

      if (!body.name?.trim()) return badRequest('name is required');
      if (!body.address?.trim()) return badRequest('address is required');

      const id = randomUUID();
      const now = new Date().toISOString();
      const org: Organization = {
        PK: `ORG#${id}`,
        SK: 'METADATA',
        GSI1PK: 'ORG',
        GSI1SK: now,
        org_id: id,
        name: body.name.trim(),
        address: body.address.trim(),
        created_at: now,
        updated_at: now,
        org_admin_ids: [],
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: org }));
      return created(stripKeys(org));
    }

    // ------------------------------------------------------------------ //
    // GET /organizations/{orgId} — fetch one organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'GET /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');

      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
        }),
      );

      if (!result.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }
      return ok(stripKeys(result.Item));
    }

    // ------------------------------------------------------------------ //
    // PUT /organizations/{orgId} — update an existing organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'PUT /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');
      if (!event.body) return badRequest('Request body is required');

      let body: UpdateOrganizationBody;
      try {
        body = JSON.parse(event.body) as UpdateOrganizationBody;
      } catch {
        return badRequest('Invalid JSON body');
      }

      // Confirm record exists before attempting update
      const existing = await docClient.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { PK: `ORG#${orgId}`, SK: 'METADATA' } }),
      );
      if (!existing.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }

      const now = new Date().toISOString();

      // 'name' is a DynamoDB reserved word — must alias with ExpressionAttributeNames
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
          UpdateExpression:
            'SET #name = :name, address = :address, updated_at = :updated_at',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: {
            ':name': body.name?.trim() ?? existing.Item['name'],
            ':address': body.address?.trim() ?? existing.Item['address'],
            ':updated_at': now,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      return ok(stripKeys(result.Attributes as Record<string, unknown>));
    }

    // ------------------------------------------------------------------ //
    // DELETE /organizations/{orgId} — delete an organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'DELETE /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');

      // Confirm record exists — return 404 rather than silent no-op
      const existing = await docClient.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { PK: `ORG#${orgId}`, SK: 'METADATA' } }),
      );
      if (!existing.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }

      await docClient.send(
        new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `ORG#${orgId}`, SK: 'METADATA' } }),
      );

      return noContent();
    }

    return badRequest(`Unhandled route: ${routeKey}`);
  } catch (error) {
    console.error('Unhandled error in organizations handler:', error);
    return internalError('An unexpected error occurred');
  }
};
