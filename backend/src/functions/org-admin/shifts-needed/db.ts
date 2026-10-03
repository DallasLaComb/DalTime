import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { ShiftNeeded } from '../../shared/models/manager/shift-needed.model.js';

export async function getCallerLookup(userId: string): Promise<{ org_id: string } | null> {
  return getMetadataRecord(userId);
}

/**
 * Every shift-needed in the org dated in `month` (YYYY-MM): one paginated Query on the org
 * partition (`begins_with(SK, 'SHIFT_NEEDED#')`), month-filtered on `date` (not a key attribute).
 */
export async function listShiftsNeededByOrg(orgId: string, month: string): Promise<ShiftNeeded[]> {
  const items: ShiftNeeded[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'begins_with(#date, :month)',
        ExpressionAttributeNames: { '#date': 'date' },
        ExpressionAttributeValues: {
          ':pk': `ORG#${orgId}`,
          ':skPrefix': 'SHIFT_NEEDED#',
          ':month': month,
        },
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items ?? []) as ShiftNeeded[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}
