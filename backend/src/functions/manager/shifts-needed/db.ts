import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, GSI1_INDEX, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { ShiftNeeded } from '../../shared/models/manager/shift-needed.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; manager_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listShifts(managerId: string, month: string): Promise<ShiftNeeded[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :month)',
      ExpressionAttributeValues: {
        ':pk': `MANAGER#${managerId}`,
        ':month': month,
      },
    }),
  );
  // A manager's shifts and shifts-needed share `GSI1PK = MANAGER#<id>` (and `GSI1SK = <date>`), so
  // this range Query also returns ordinary shifts. Keep only shifts-needed: a shift has no
  // `employee_count`, which turned the scheduler's open-slot sum into NaN (serialised as null).
  return (result.Items ?? []).filter((item) =>
    (item['SK'] as string).startsWith('SHIFT_NEEDED#'),
  ) as ShiftNeeded[];
}

export async function getShift(orgId: string, shiftId: string): Promise<ShiftNeeded | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT_NEEDED#${shiftId}` },
    }),
  );
  return (result.Item as ShiftNeeded) ?? null;
}

export async function createShift(shift: ShiftNeeded): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: shift }));
}

export async function updateShift(
  orgId: string,
  shiftId: string,
  fields: {
    date?: string;
    start_time?: string;
    end_time?: string;
    employee_count?: number;
    location_id?: string;
    location_name?: string;
    notes?: string | null;
  },
  updatedAt: string,
): Promise<ShiftNeeded | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const parts: string[] = ['#updated_at = :updated_at'];

  const stringFields = ['date', 'start_time', 'end_time', 'location_id', 'location_name'] as const;
  for (const f of stringFields) {
    if (fields[f] !== undefined) {
      names[`#${f}`] = f;
      values[`:${f}`] = fields[f];
      parts.push(`#${f} = :${f}`);
    }
  }

  if (fields.employee_count !== undefined) {
    names['#employee_count'] = 'employee_count';
    values[':employee_count'] = fields.employee_count;
    parts.push('#employee_count = :employee_count');
  }

  if (fields.notes !== undefined) {
    names['#notes'] = 'notes';
    if (fields.notes === null || fields.notes === '') {
      parts.push('#notes = :notes');
      values[':notes'] = '';
    } else {
      values[':notes'] = fields.notes;
      parts.push('#notes = :notes');
    }
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT_NEEDED#${shiftId}` },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );

  return (result.Attributes as ShiftNeeded) ?? null;
}

export async function deleteShift(orgId: string, shiftId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT_NEEDED#${shiftId}` },
    }),
  );
}

export { clearFailedMarker } from '../../shared/failed-marker.js';
