import type { BroadcastRecord } from '@daltime/contracts';
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest/extend';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../../../src/functions/shared/dynamo.js';
import {
  organizationExists,
  putBroadcast,
  queryActiveBroadcasts,
  deleteBroadcast,
} from '../../../../src/functions/web-admin/broadcasts/db.js';

const ddbMock = mockClient(docClient as unknown as DynamoDBDocumentClient);

beforeEach(() => ddbMock.reset());

const record: BroadcastRecord = {
  PK: 'BROADCAST#ALL',
  SK: '9999-12-31T23:59:59.999Z#b1',
  GSI1PK: 'BROADCAST',
  GSI1SK: '9999-12-31T23:59:59.999Z#b1',
  broadcast_id: 'b1',
  message: 'm',
  severity: 'INFO',
  target_scope: 'ALL',
  created_at: '2026-09-01T00:00:00.000Z',
  created_by_web_admin_id: 'WADMIN#1',
};

describe('organizationExists()', () => {
  it('GetItems ORG#<id> / METADATA', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { PK: 'ORG#o1' } });
    expect(await organizationExists('o1')).toBe(true);
    expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
      Key: { PK: 'ORG#o1', SK: 'METADATA' },
    });
  });

  it('returns false when absent', async () => {
    ddbMock.on(GetCommand).resolves({});
    expect(await organizationExists('o1')).toBe(false);
  });
});

describe('putBroadcast()', () => {
  it('puts the record as-is', async () => {
    ddbMock.on(PutCommand).resolves({});
    await putBroadcast(record);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, { Item: record });
  });
});

describe('queryActiveBroadcasts()', () => {
  it('queries GSI1 for GSI1SK > now and follows LastEvaluatedKey', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [record], LastEvaluatedKey: { PK: 'x' } })
      .resolvesOnce({ Items: [{ ...record, broadcast_id: 'b2' }] });

    const items = await queryActiveBroadcasts('2026-09-29T00:00:00.000Z');

    expect(items.map((i) => i.broadcast_id)).toEqual(['b1', 'b2']);
    expect(ddbMock).toHaveReceivedCommandTimes(QueryCommand, 2);
    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK > :now',
      ExpressionAttributeValues: { ':pk': 'BROADCAST', ':now': '2026-09-29T00:00:00.000Z' },
    });
    expect(ddbMock).toHaveReceivedNthCommandWith(QueryCommand, 2, {
      ExclusiveStartKey: { PK: 'x' },
    });
  });
});

describe('deleteBroadcast()', () => {
  it('deletes by full key', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    await deleteBroadcast('BROADCAST#ALL', 'sk');
    expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
      Key: { PK: 'BROADCAST#ALL', SK: 'sk' },
    });
  });
});
