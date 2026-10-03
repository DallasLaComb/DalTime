import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { BroadcastRecord } from '@daltime/contracts';
import { docClient, GSI1_INDEX, TABLE_NAME } from '../../shared/dynamo.js';

/** GSI1 partition holding every broadcast, for the WebAdmin active list. */
export const BROADCAST_GSI1PK = 'BROADCAST';

/** True if `ORG#<orgId>` / `METADATA` exists. */
export async function organizationExists(orgId: string): Promise<boolean> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
      ProjectionExpression: 'PK',
    }),
  );
  return result.Item !== undefined;
}

/** Persist a new broadcast record. */
export async function putBroadcast(record: BroadcastRecord): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));
}

/**
 * Every broadcast whose expiry is after `nowIso`, soonest-expiring first.
 *
 * Bounded: expiry leads GSI1SK, so expired broadcasts are never read; only active
 * WebAdmin-authored broadcasts (a handful) remain. Paginates anyway (R6).
 */
export async function queryActiveBroadcasts(nowIso: string): Promise<BroadcastRecord[]> {
  const items: BroadcastRecord[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX,
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK > :now',
        ExpressionAttributeValues: { ':pk': BROADCAST_GSI1PK, ':now': nowIso },
        ExclusiveStartKey,
      }),
    );
    items.push(...((page.Items ?? []) as BroadcastRecord[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Delete a broadcast by its full key. */
export async function deleteBroadcast(pk: string, sk: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }));
}
