import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { Manager } from '../../shared/models/org-admin/manager.model.js';

/** Resolve the caller's org_id and user_id from the reverse-lookup record. */
export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { org_id: string; user_id: string };
}

/** List all managers for a given org by querying PK = ORG#<orgId>, SK begins_with MANAGER#. */
export async function listManagersByOrg(orgId: string): Promise<Manager[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'MANAGER#',
      },
    }),
  );
  return (result.Items ?? []) as Manager[];
}

/** Get a single manager by org + managerId. */
export async function getManager(orgId: string, managerId: string): Promise<Manager | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
    }),
  );
  return (result.Item as Manager) ?? null;
}

/** Fetch the reverse-lookup record for a manager. */
export async function getManagerReverseLookup(
  managerId: string,
): Promise<{ manager_id: string; org_id: string; email: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${managerId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { manager_id: string; org_id: string; email: string };
}

/** Write both the primary record and the reverse-lookup record. */
export async function createManager(manager: Manager): Promise<void> {
  const primary: Manager = {
    ...manager,
    GSI1PK: 'MANAGER',
    GSI1SK: manager.created_at,
  };

  const reverseLookup = {
    PK: `USER#${manager.manager_id}`,
    SK: 'METADATA',
    manager_id: manager.manager_id,
    email: manager.email,
    first_name: manager.first_name,
    last_name: manager.last_name,
    org_id: manager.org_id,
    status: manager.status,
    created_at: manager.created_at,
  };

  await Promise.all([
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: primary })),
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: reverseLookup })),
  ]);
}

/** Update mutable fields on both the primary and reverse-lookup records. */
export async function updateManager(
  orgId: string,
  managerId: string,
  fields: { first_name?: string; last_name?: string; phone?: string },
  updatedAt: string,
): Promise<Manager | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const parts: string[] = ['#updated_at = :updated_at'];

  if (fields.first_name !== undefined) {
    names['#first_name'] = 'first_name';
    values[':first_name'] = fields.first_name;
    parts.push('#first_name = :first_name');
  }
  if (fields.last_name !== undefined) {
    names['#last_name'] = 'last_name';
    values[':last_name'] = fields.last_name;
    parts.push('#last_name = :last_name');
  }
  if (fields.phone !== undefined) {
    names['#phone'] = 'phone';
    values[':phone'] = fields.phone;
    parts.push('#phone = :phone');
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );

  // Also update the reverse-lookup record (best-effort, no return needed)
  const reverseParts: string[] = ['#updated_at = :updated_at'];
  const reverseNames: Record<string, string> = { '#updated_at': 'updated_at' };
  const reverseValues: Record<string, unknown> = { ':updated_at': updatedAt };

  if (fields.first_name !== undefined) {
    reverseNames['#first_name'] = 'first_name';
    reverseValues[':first_name'] = fields.first_name;
    reverseParts.push('#first_name = :first_name');
  }
  if (fields.last_name !== undefined) {
    reverseNames['#last_name'] = 'last_name';
    reverseValues[':last_name'] = fields.last_name;
    reverseParts.push('#last_name = :last_name');
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${managerId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${reverseParts.join(', ')}`,
      ExpressionAttributeNames: reverseNames,
      ExpressionAttributeValues: reverseValues,
    }),
  );

  return (result.Attributes as Manager) ?? null;
}

/** Update status to DISABLED on the primary record. */
export async function disableManager(orgId: string, managerId: string): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
        UpdateExpression: 'SET #status = :status, #updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':status': 'DISABLED', ':now': now },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${managerId}`, SK: 'METADATA' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'DISABLED' },
      }),
    ),
  ]);
}

/** Atomically increment manager_count on the OrgAdmin's user record. */
export async function incrementManagerCount(orgId: string, orgAdminId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `USER#${orgAdminId}` },
      UpdateExpression: 'ADD manager_count :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    }),
  );
}

/** Atomically decrement manager_count on the OrgAdmin's user record (floor at 0). */
export async function decrementManagerCount(orgId: string, orgAdminId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `USER#${orgAdminId}` },
      UpdateExpression: 'SET manager_count = if_not_exists(manager_count, :zero) - :dec',
      ConditionExpression: 'manager_count > :zero',
      ExpressionAttributeValues: { ':dec': 1, ':zero': 0 },
    }),
  ).catch(() => {
    // Condition failed means count is already 0 — safe to ignore.
  });
}
