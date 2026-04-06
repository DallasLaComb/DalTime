import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_INDEX } from '../../shared/dynamo.js';
import type { Organization } from '../../shared/models/web-admin/organization.model.js';

export async function listOrganizations() {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'ORG' },
    }),
  );
  return result.Items ?? [];
}

export async function getOrganizationById(orgId: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
    }),
  );
  return result.Item ?? null;
}

export async function createOrganization(org: Organization) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: org }));
}

export async function updateOrganization(
  orgId: string,
  fields: { name: string; address: string; updated_at: string },
) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
      UpdateExpression: 'SET #name = :name, address = :address, updated_at = :updated_at',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': fields.name,
        ':address': fields.address,
        ':updated_at': fields.updated_at,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return result.Attributes as Record<string, unknown>;
}

export async function deleteOrganization(orgId: string) {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `ORG#${orgId}`, SK: 'METADATA' } }),
  );
}
