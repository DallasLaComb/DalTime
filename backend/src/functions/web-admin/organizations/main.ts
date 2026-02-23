import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type {
  Organization,
  CreateOrganizationBody,
  UpdateOrganizationBody,
} from '../../shared/models/organization.model.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  internalError,
} from '../../shared/response.js';

// Initialised once outside handler — reused across warm invocations
const dynamoConfig = process.env.DYNAMODB_ENDPOINT
  ? { endpoint: process.env.DYNAMODB_ENDPOINT, region: process.env.AWS_DEFAULT_REGION ?? 'us-east-1' }
  : {};
console.log('DynamoDB config:', JSON.stringify(dynamoConfig));

const client = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ORGANIZATIONS_TABLE!;

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
        new ScanCommand({ TableName: TABLE_NAME }),
      );
      return ok(result.Items ?? []);
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

      const now = new Date().toISOString();
      const org: Organization = {
        org_id: randomUUID(),
        name: body.name.trim(),
        address: body.address.trim(),
        created_at: now,
        updated_at: now,
        org_admin_ids: [],
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: org }));
      return created(org);
    }

    // ------------------------------------------------------------------ //
    // GET /organizations/{orgId} — fetch one organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'GET /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');

      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { org_id: orgId },
        }),
      );

      if (!result.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }
      return ok(result.Item);
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
        new GetCommand({ TableName: TABLE_NAME, Key: { org_id: orgId } }),
      );
      if (!existing.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }

      const now = new Date().toISOString();

      // 'name' is a DynamoDB reserved word — must alias with ExpressionAttributeNames
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { org_id: orgId },
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

      return ok(result.Attributes);
    }

    // ------------------------------------------------------------------ //
    // DELETE /organizations/{orgId} — delete an organization
    // ------------------------------------------------------------------ //
    if (routeKey === 'DELETE /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');

      // Confirm record exists — return 404 rather than silent no-op
      const existing = await docClient.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { org_id: orgId } }),
      );
      if (!existing.Item) {
        return notFound(`Organization '${orgId}' not found`);
      }

      await docClient.send(
        new DeleteCommand({ TableName: TABLE_NAME, Key: { org_id: orgId } }),
      );

      return noContent();
    }

    return badRequest(`Unhandled route: ${routeKey}`);
  } catch (error) {
    console.error('Unhandled error in organizations handler:', error);
    return internalError('An unexpected error occurred');
  }
};
