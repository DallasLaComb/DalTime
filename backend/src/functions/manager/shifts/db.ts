import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  GSI1_INDEX,
  TABLE_NAME,
  getMetadataRecord,
  getOrgEntityRecord,
} from '../../shared/dynamo.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; manager_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function getEmployee(orgId: string, employeeId: string): Promise<Employee | null> {
  return getOrgEntityRecord<Employee>(orgId, 'EMPLOYEE', employeeId);
}

export async function listShiftsByManager(managerId: string, month: string): Promise<Shift[]> {
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

export async function getShift(orgId: string, shiftId: string): Promise<Shift | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT#${shiftId}` },
    }),
  );
  return (result.Item as Shift) ?? null;
}

export async function createShift(shift: Shift): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: shift }));
}

export async function updateShift(
  orgId: string,
  shiftId: string,
  fields: {
    employee_id?: string;
    employee_name?: string;
    location_id?: string;
    location_name?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    type?: string;
    manager_id?: string;
  },
  updatedAt: string,
): Promise<Shift | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const parts: string[] = ['#updated_at = :updated_at'];

  for (const field of [
    'employee_id',
    'employee_name',
    'location_id',
    'location_name',
    'date',
    'start_time',
    'end_time',
    'type',
  ] as const) {
    if (fields[field] !== undefined) {
      names[`#${field}`] = field;
      values[`:${field}`] = fields[field];
      parts.push(`#${field} = :${field}`);
    }
  }

  // Keep the GSI1 keys (manager + month listing) in step with the fields they are derived from.
  if (fields.date !== undefined) {
    names['#GSI1SK'] = 'GSI1SK';
    values[':GSI1SK'] = fields.date;
    parts.push('#GSI1SK = :GSI1SK');
  }
  if (fields.manager_id !== undefined) {
    names['#manager_id'] = 'manager_id';
    names['#GSI1PK'] = 'GSI1PK';
    values[':manager_id'] = fields.manager_id;
    values[':GSI1PK'] = `MANAGER#${fields.manager_id}`;
    parts.push('#manager_id = :manager_id', '#GSI1PK = :GSI1PK');
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT#${shiftId}` },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );

  return (result.Attributes as Shift) ?? null;
}

export async function deleteShift(orgId: string, shiftId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `SHIFT#${shiftId}` },
    }),
  );
}

export { clearFailedMarker } from '../../shared/failed-marker.js';
