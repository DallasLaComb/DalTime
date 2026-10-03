import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { OrgAdminUser } from '../../shared/models/web-admin/org-admin-user.model.js';

/**
 * Write both the primary record and the reverse-lookup record in parallel.
 * Stamps `modified_by_web_admin_id` on both items so the creating WebAdmin is
 * captured for audit purposes.
 */
export async function createOrgAdminUser(user: OrgAdminUser, webAdminId: string): Promise<void> {
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
    modified_by_web_admin_id: webAdminId,
  };

  await Promise.all([
    docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...primary, modified_by_web_admin_id: webAdminId },
      }),
    ),
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
  return getMetadataRecord(userId);
}

/**
 * Update status to DISABLED on both the primary and reverse-lookup records.
 * Stamps `modified_by_web_admin_id` on both items to record which WebAdmin
 * triggered the disable action. Written inline rather than through `setEntityStatus`
 * so the audit field can be included without changing the shared helper.
 */
export async function disableOrgAdminUser(
  orgId: string,
  userId: string,
  webAdminId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const auditExpr = ', modified_by_web_admin_id = :webAdminId';
  const auditValues = { ':webAdminId': webAdminId };

  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `USER#${userId}` },
        UpdateExpression: `SET #status = :status, #updated_at = :now${auditExpr}`,
        ExpressionAttributeNames: { '#status': 'status', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':status': 'DISABLED', ':now': now, ...auditValues },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        UpdateExpression: `SET #status = :status${auditExpr}`,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'DISABLED', ...auditValues },
      }),
    ),
  ]);
}

/**
 * Update status to CONFIRMED on both the primary and reverse-lookup records
 * (re-enable a previously disabled OrgAdmin). Stamps `modified_by_web_admin_id`
 * on both items for audit purposes.
 */
export async function enableOrgAdminUser(
  orgId: string,
  userId: string,
  webAdminId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const auditExpr = ', modified_by_web_admin_id = :webAdminId';
  const auditValues = { ':webAdminId': webAdminId };

  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `USER#${userId}` },
        UpdateExpression: `SET #status = :status, #updated_at = :now${auditExpr}`,
        ExpressionAttributeNames: { '#status': 'status', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':status': 'CONFIRMED', ':now': now, ...auditValues },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        UpdateExpression: `SET #status = :status${auditExpr}`,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'CONFIRMED', ...auditValues },
      }),
    ),
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
  await docClient
    .send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
        UpdateExpression: 'SET org_admin_count = if_not_exists(org_admin_count, :zero) - :dec',
        ConditionExpression: 'org_admin_count > :zero',
        ExpressionAttributeValues: { ':dec': 1, ':zero': 0 },
      }),
    )
    .catch(() => {
      // Condition failed means count is 0 or the attribute is missing — safe to ignore in both cases.
    });
}
