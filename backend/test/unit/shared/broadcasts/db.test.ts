import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest/extend';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../../../src/functions/shared/dynamo.js';
import {
  queryActiveByScope,
  getDismissedIds,
  putDismissal,
} from '../../../../src/functions/shared/broadcasts/db.js';

const ddbMock = mockClient(docClient as unknown as DynamoDBDocumentClient);

beforeEach(() => ddbMock.reset());

describe('queryActiveByScope()', () => {
  it('queries the scope partition for SK > now and follows LastEvaluatedKey', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ broadcast_id: 'a' }], LastEvaluatedKey: { PK: 'x' } })
      .resolvesOnce({ Items: [{ broadcast_id: 'b' }] });

    const items = await queryActiveByScope('BROADCAST#ALL', '2026-09-29T00:00:00.000Z');

    expect(items.map((i) => i.broadcast_id)).toEqual(['a', 'b']);
    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      KeyConditionExpression: 'PK = :pk AND SK > :now',
      ExpressionAttributeValues: { ':pk': 'BROADCAST#ALL', ':now': '2026-09-29T00:00:00.000Z' },
    });
    expect(ddbMock).toHaveReceivedNthCommandWith(QueryCommand, 2, {
      ExclusiveStartKey: { PK: 'x' },
    });
  });
});

describe('getDismissedIds()', () => {
  it('BatchGets USER#<sub> / BROADCAST_DISMISSAL#<id> keys', async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { [TABLE_NAME]: [{ broadcast_id: 'a' }] } });

    const ids = await getDismissedIds('sub1', ['a', 'b']);

    expect([...ids]).toEqual(['a']);
    expect(ddbMock).toHaveReceivedCommandWith(BatchGetCommand, {
      RequestItems: {
        [TABLE_NAME]: {
          Keys: [
            { PK: 'USER#sub1', SK: 'BROADCAST_DISMISSAL#a' },
            { PK: 'USER#sub1', SK: 'BROADCAST_DISMISSAL#b' },
          ],
          ProjectionExpression: 'broadcast_id',
        },
      },
    });
  });

  it('retries unprocessed keys', async () => {
    ddbMock
      .on(BatchGetCommand)
      .resolvesOnce({
        Responses: { [TABLE_NAME]: [{ broadcast_id: 'a' }] },
        UnprocessedKeys: {
          [TABLE_NAME]: { Keys: [{ PK: 'USER#sub1', SK: 'BROADCAST_DISMISSAL#b' }] },
        },
      })
      .resolvesOnce({ Responses: { [TABLE_NAME]: [{ broadcast_id: 'b' }] } });

    const ids = await getDismissedIds('sub1', ['a', 'b']);

    expect([...ids].sort()).toEqual(['a', 'b']);
    expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 2);
  });

  it('chunks more than 100 ids', async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { [TABLE_NAME]: [] } });
    await getDismissedIds(
      'sub1',
      Array.from({ length: 150 }, (_, i) => `id${i}`),
    );
    expect(ddbMock).toHaveReceivedCommandTimes(BatchGetCommand, 2);
  });
});

describe('putDismissal()', () => {
  it('puts under the user partition', async () => {
    ddbMock.on(PutCommand).resolves({});
    await putDismissal('sub1', {
      broadcast_id: 'a',
      dismissed_at: '2026-09-29T00:00:00.000Z',
      ttl: 5,
    });
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      Item: {
        PK: 'USER#sub1',
        SK: 'BROADCAST_DISMISSAL#a',
        broadcast_id: 'a',
        dismissed_at: '2026-09-29T00:00:00.000Z',
        ttl: 5,
      },
    });
  });
});
