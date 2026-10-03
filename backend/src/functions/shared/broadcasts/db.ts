import {
  BatchGetCommand,
  PutCommand,
  QueryCommand,
  type BatchGetCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import type { BroadcastDismissalRecord, BroadcastRecord } from '@daltime/contracts';
import { docClient, TABLE_NAME } from '../dynamo.js';

/** DynamoDB's BatchGetItem key limit. */
const BATCH_GET_LIMIT = 100;

/** SK of a user's dismissal of one broadcast. */
export function dismissalSortKey(broadcastId: string): string {
  return `BROADCAST_DISMISSAL#${broadcastId}`;
}

/**
 * Broadcasts stored under one scope partition that expire after `nowIso`.
 *
 * Bounded: expiry leads the SK, so only active WebAdmin-authored broadcasts are
 * read (a handful per scope). Paginates anyway (R6).
 */
export async function queryActiveByScope(
  partitionKey: string,
  nowIso: string,
): Promise<BroadcastRecord[]> {
  const items: BroadcastRecord[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK > :now',
        ExpressionAttributeValues: { ':pk': partitionKey, ':now': nowIso },
        ExclusiveStartKey,
      }),
    );
    items.push(...((page.Items ?? []) as BroadcastRecord[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** The subset of `broadcastIds` the user has dismissed. */
export async function getDismissedIds(sub: string, broadcastIds: string[]): Promise<Set<string>> {
  const dismissed = new Set<string>();
  for (let i = 0; i < broadcastIds.length; i += BATCH_GET_LIMIT) {
    let keys: Record<string, unknown>[] | undefined = broadcastIds
      .slice(i, i + BATCH_GET_LIMIT)
      .map((id) => ({ PK: `USER#${sub}`, SK: dismissalSortKey(id) }));

    // Retry anything DynamoDB returns as unprocessed (throttling / size limits).
    while (keys && keys.length > 0) {
      const result: BatchGetCommandOutput = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: { Keys: keys, ProjectionExpression: 'broadcast_id' },
          },
        }),
      );
      for (const item of result.Responses?.[TABLE_NAME] ?? []) {
        dismissed.add((item as Pick<BroadcastDismissalRecord, 'broadcast_id'>).broadcast_id);
      }
      keys = result.UnprocessedKeys?.[TABLE_NAME]?.Keys;
    }
  }
  return dismissed;
}

/** Record that the user dismissed a broadcast. Idempotent — a repeat overwrites. */
export async function putDismissal(
  sub: string,
  record: Omit<BroadcastDismissalRecord, 'PK' | 'SK'>,
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `USER#${sub}`, SK: dismissalSortKey(record.broadcast_id), ...record },
    }),
  );
}
