import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { UserLocation } from '../../shared/models/org-admin/user-location.model.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';
import type { Location } from '../../shared/models/manager/location.model.js';

/** Resolve the caller's org_id and user_id from their reverse-lookup record. */
export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

/** Get an employee by org + employeeId (primary record). */
export async function getEmployee(orgId: string, employeeId: string): Promise<Employee | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    }),
  );
  return (result.Item as Employee) ?? null;
}

/** Get a location by org + locationId. */
export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
    }),
  );
  return (result.Item as Location) ?? null;
}

/** List all location assignments for an employee. */
export async function listEmployeeLocations(employeeId: string): Promise<UserLocation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${employeeId}`,
        ':prefix': 'LOCATION#',
      },
    }),
  );
  return (result.Items ?? []) as UserLocation[];
}

/** Get a single employee–location assignment. */
export async function getEmployeeLocation(
  employeeId: string,
  locationId: string,
): Promise<UserLocation | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: `LOCATION#${locationId}` },
    }),
  );
  return (result.Item as UserLocation) ?? null;
}

/** Write an employee–location assignment. */
export async function createEmployeeLocation(assignment: UserLocation): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: assignment }));
}

/** Delete an employee–location assignment. */
export async function deleteEmployeeLocation(
  employeeId: string,
  locationId: string,
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: `LOCATION#${locationId}` },
    }),
  );
}
