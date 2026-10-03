import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { OrgAdminUser } from '../../shared/models/web-admin/org-admin-user.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function getOrgAdminRecord(
  orgId: string,
  userId: string,
): Promise<OrgAdminUser | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `USER#${userId}` },
    }),
  );
  return (result.Item as OrgAdminUser) ?? null;
}

export async function updateOrgAdminName(
  orgId: string,
  userId: string,
  name: string,
  updatedAt: string,
): Promise<void> {
  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `USER#${userId}` },
        UpdateExpression: 'SET #name = :name, #updated_at = :updated_at',
        ExpressionAttributeNames: { '#name': 'name', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':name': name, ':updated_at': updatedAt },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        UpdateExpression: 'SET #name = :name',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': name },
      }),
    ),
  ]);
}
