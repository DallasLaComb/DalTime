import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, GSI1_INDEX, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';

export interface ScheduleMeta {
  PK: string;
  SK: string;
  org_id: string;
  manager_id: string;
  month: string;
  draft_count: number;
  updated_at: string;
}

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; manager_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function getEmployeeAvailability(
  employeeId: string,
): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'AVAILABILITY' },
    }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

export async function getEmployeeAvailabilityOverrides(
  employeeId: string,
): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'AVAILABILITY_OVERRIDES' },
    }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

export async function listDraftShiftsByManager(managerId: string, month: string): Promise<Shift[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :month)',
      FilterExpression: '#status = :draft',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `MANAGER#${managerId}`,
        ':month': month,
        ':draft': 'draft',
      },
    }),
  );
  return (result.Items ?? []) as Shift[];
}

export async function listAllShiftsByManager(managerId: string, month: string): Promise<Shift[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :month)',
      ExpressionAttributeValues: { ':pk': `MANAGER#${managerId}`, ':month': month },
    }),
  );
  return (result.Items ?? []).filter((item) =>
    (item['SK'] as string).startsWith('SHIFT#'),
  ) as Shift[];
}

export async function getScheduleMeta(
  orgId: string,
  managerId: string,
  month: string,
): Promise<ScheduleMeta | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SCHEDULE_META#${managerId}#${month}` },
    }),
  );
  return (result.Item as ScheduleMeta) ?? null;
}

export async function upsertScheduleMeta(
  orgId: string,
  managerId: string,
  month: string,
  draftCount: number,
  now: string,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SCHEDULE_META#${managerId}#${month}` },
      UpdateExpression:
        'SET draft_count = :count, org_id = :orgId, manager_id = :managerId, #m = :month, updated_at = :now',
      ExpressionAttributeNames: { '#m': 'month' },
      ExpressionAttributeValues: {
        ':count': draftCount,
        ':orgId': orgId,
        ':managerId': managerId,
        ':month': month,
        ':now': now,
      },
    }),
  );
}

export async function createShift(shift: Shift): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: shift }));
}

export async function publishShift(
  orgId: string,
  shiftId: string,
  updatedAt: string,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT#${shiftId}` },
      UpdateExpression: 'SET #status = :published, updated_at = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':published': 'published', ':updatedAt': updatedAt },
    }),
  );
}

export { clearFailedMarker } from '../../shared/failed-marker.js';
