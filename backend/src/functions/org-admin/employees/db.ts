import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  TABLE_NAME,
  getMetadataRecord,
  updateOrgAndMetadataRecord,
  setEntityStatus,
} from '../../shared/dynamo.js';
export { createEmployeeRecord as createEmployee } from '../../shared/dynamo.js';
import type { EmployeeRecord } from '@daltime/contracts';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listEmployeesByOrg(orgId: string): Promise<EmployeeRecord[]> {
  const items: EmployeeRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ORG#${orgId}`,
          ':skPrefix': 'EMPLOYEE#',
        },
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items ?? []) as EmployeeRecord[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function getEmployeeReverseLookup(
  employeeId: string,
): Promise<{ employee_id: string; org_id: string; email: string } | null> {
  return getMetadataRecord(employeeId);
}

export async function updateEmployee(
  orgId: string,
  employeeId: string,
  fields: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    manager_id?: string;
    employee_number?: string;
  },
  updatedAt: string,
): Promise<EmployeeRecord | null> {
  return updateOrgAndMetadataRecord<EmployeeRecord>(
    { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    employeeId,
    fields,
    updatedAt,
  );
}

export async function disableEmployee(orgId: string, employeeId: string): Promise<void> {
  await setEntityStatus(
    { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    employeeId,
    'DISABLED',
  );
}

export async function enableEmployee(
  orgId: string,
  employeeId: string,
  status: string = 'CONFIRMED',
): Promise<void> {
  await setEntityStatus(
    { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    employeeId,
    status,
  );
}
