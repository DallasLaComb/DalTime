import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { OrgAdminUser } from '../../shared/models/web-admin/org-admin-user.model.js';

/** Write both the primary record and the reverse-lookup record in a single batch. */
export async function createOrgAdminUser(user: OrgAdminUser): Promise<void> {
  const primary: OrgAdminUser = {
    ...user,
    GSI1PK: 'ORG_ADMIN',
    GSI1SK: user.created_at,
  };

  const reverseLookup = {
    PK: `USER#${user.user_id}`,
    SK: 'METADATA',
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    org_id: user.org_id,
    status: user.status,
    created_at: user.created_at,
  };

  await Promise.all([
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: primary })),
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: reverseLookup })),
  ]);
}

/** List all OrgAdmins for a given org by querying PK = ORG#<orgId>, SK begins_with USER#. */
export async function listOrgAdminsByOrg(orgId: string): Promise<OrgAdminUser[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'USER#',
      },
    }),
  );
  return (result.Items ?? []) as OrgAdminUser[];
}

/** Fetch the reverse-lookup record to resolve org_id from userId alone. */
export async function getOrgAdminReverseLookup(
  userId: string,
): Promise<{ user_id: string; org_id: string; email: string; name: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { user_id: string; org_id: string; email: string; name: string };
}

/** Delete both the primary and reverse-lookup records. */
export async function deleteOrgAdminUser(orgId: string, userId: string): Promise<void> {
  await Promise.all([
    docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `ORG#${orgId}`, SK: `USER#${userId}` } })),
    docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'METADATA' } })),
  ]);
}

/** Atomically increment org_admin_count on the parent org record. */
export async function incrementOrgAdminCount(orgId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
      UpdateExpression: 'ADD org_admin_count :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    }),
  );
}

/** Atomically decrement org_admin_count on the parent org record (floor at 0). */
export async function decrementOrgAdminCount(orgId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
      UpdateExpression: 'SET org_admin_count = if_not_exists(org_admin_count, :zero) - :dec',
      ConditionExpression: 'org_admin_count > :zero',
      ExpressionAttributeValues: { ':dec': 1, ':zero': 0 },
    }),
  ).catch(() => {
    // Condition failed means count is already 0 — safe to ignore.
  });
}
