import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  TABLE_NAME,
  getMetadataRecord,
  updateOrgAndMetadataRecord,
  setEntityStatus,
  getOrgEntityRecord,
  GSI1_INDEX,
} from '../../shared/dynamo.js';
import type { ManagerRecord } from '@daltime/contracts';
import { listEmployeesByOrg } from '../employees/db.js';

/** Resolve the caller's org_id and user_id from the reverse-lookup record. */
export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

/** List all managers for a given org by querying PK = ORG#<orgId>, SK begins_with MANAGER#. */
export async function listManagersByOrg(orgId: string): Promise<ManagerRecord[]> {
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
  return (result.Items ?? []) as ManagerRecord[];
}

/** Get a single manager by org + managerId. */
export async function getManager(orgId: string, managerId: string): Promise<ManagerRecord | null> {
  return getOrgEntityRecord<ManagerRecord>(orgId, 'MANAGER', managerId);
}

/** Fetch the reverse-lookup record for a manager. */
export async function getManagerReverseLookup(
  managerId: string,
): Promise<{ manager_id: string; org_id: string; email: string } | null> {
  return getMetadataRecord(managerId);
}

/** Write both the primary record and the reverse-lookup record. */
export async function createManager(manager: ManagerRecord): Promise<void> {
  const primary: ManagerRecord = {
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
): Promise<ManagerRecord | null> {
  return updateOrgAndMetadataRecord<ManagerRecord>(
    { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
    managerId,
    fields,
    updatedAt,
  );
}

/** Update status to DISABLED on the primary and reverse-lookup records. */
export async function disableManager(orgId: string, managerId: string): Promise<void> {
  await setEntityStatus({ PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` }, managerId, 'DISABLED');
}

/** Update status to CONFIRMED on the primary and reverse-lookup records (re-enable). */
export async function enableManager(
  orgId: string,
  managerId: string,
  status: string = 'CONFIRMED',
): Promise<void> {
  await setEntityStatus({ PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` }, managerId, status);
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
  await docClient
    .send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `USER#${orgAdminId}` },
        UpdateExpression: 'SET manager_count = if_not_exists(manager_count, :zero) - :dec',
        ConditionExpression: 'manager_count > :zero',
        ExpressionAttributeValues: { ':dec': 1, ':zero': 0 },
      }),
    )
    .catch(() => {
      // Condition failed means count is already 0 — safe to ignore.
    });
}

/**
 * Active (non-disabled) employees per manager, keyed by manager_id. Derived from the employees'
 * own `manager_id` — the source of truth — so it can never drift the way a stored counter did.
 */
export async function countEmployeesByManager(orgId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const e of await listEmployeesByOrg(orgId)) {
    if (!e.manager_id || e.status === 'DISABLED') continue;
    counts.set(e.manager_id, (counts.get(e.manager_id) ?? 0) + 1);
  }
  return counts;
}

/** Active (non-disabled) employees currently assigned to a manager. */
export async function countActiveEmployeesOfManager(
  orgId: string,
  managerId: string,
): Promise<number> {
  const employees = await listEmployeesByOrg(orgId);
  return employees.filter((e) => e.manager_id === managerId && e.status !== 'DISABLED').length;
}

/**
 * Shifts on a manager's schedule dated `fromDate` or later (one GSI1 range Query:
 * `GSI1PK = MANAGER#<id>`, `GSI1SK >= <date>`). The same key also carries shifts-needed (and
 * templates sort after every date), so keep only `SHIFT#` items and drop `draft_failed` sentinels.
 */
export async function countUpcomingShiftsOfManager(
  managerId: string,
  fromDate: string,
): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `MANAGER#${managerId}`,
          ':from': fromDate,
          ':to': '9999-12-31',
        },
        ExclusiveStartKey: lastKey,
      }),
    );
    count += (result.Items ?? []).filter(
      (i) => (i['SK'] as string).startsWith('SHIFT#') && i['status'] !== 'draft_failed',
    ).length;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return count;
}
