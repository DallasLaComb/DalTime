import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  GSI1_INDEX,
  TABLE_NAME,
  getMetadataRecord,
  listOrgLocations,
} from '../../shared/dynamo.js';
import { listManagersByOrg } from '../managers/db.js';
import { listEmployeesByOrg } from '../employees/db.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';
import type { ShiftNeeded } from '../../shared/models/manager/shift-needed.model.js';

export { listManagersByOrg, listEmployeesByOrg, listOrgLocations };

export async function getCallerLookup(userId: string): Promise<{ org_id: string } | null> {
  return getMetadataRecord(userId);
}

/**
 * One manager's shifts and shifts-needed dated in `[from, to]` (YYYY-MM-DD, inclusive).
 *
 * Both entity types carry `GSI1PK = MANAGER#<id>` and `GSI1SK = <date>`, so a single GSI1 range
 * Query returns them together (template rows sort under `TEMPLATE#…`, outside a date range).
 * They are told apart by the base-table SK prefix.
 */
export async function listManagerWindow(
  managerId: string,
  from: string,
  to: string,
): Promise<{ shifts: Shift[]; needed: ShiftNeeded[] }> {
  const shifts: Shift[] = [];
  const needed: ShiftNeeded[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to',
        ExpressionAttributeValues: { ':pk': `MANAGER#${managerId}`, ':from': from, ':to': to },
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of result.Items ?? []) {
      const sk = item['SK'] as string;
      if (sk.startsWith('SHIFT_NEEDED#')) needed.push(item as ShiftNeeded);
      else if (sk.startsWith('SHIFT#')) shifts.push(item as Shift);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return { shifts, needed };
}

/** Open shift-swap listings in the org (GSI1 `ORG_SWAP#<org>` / `STATUS#open#…`), counted not fetched. */
export async function countOpenSwaps(orgId: string): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `ORG_SWAP#${orgId}`, ':prefix': 'STATUS#open#' },
        Select: 'COUNT',
        ExclusiveStartKey: lastKey,
      }),
    );
    count += result.Count ?? 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return count;
}
