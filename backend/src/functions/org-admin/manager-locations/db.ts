import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { UserLocation } from '../../shared/models/org-admin/user-location.model.js';
import type { Manager } from '../../shared/models/org-admin/manager.model.js';
import type { Location } from '../../shared/models/manager/location.model.js';

/** Resolve the caller's org_id and user_id from their reverse-lookup record. */
export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

/** Get a manager by org + managerId (primary record). */
export async function getManager(orgId: string, managerId: string): Promise<Manager | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
    }),
  );
  return (result.Item as Manager) ?? null;
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

/** List all location assignments for a manager. */
export async function listManagerLocations(managerId: string): Promise<UserLocation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${managerId}`,
        ':prefix': 'LOCATION#',
      },
    }),
  );
  return (result.Items ?? []) as UserLocation[];
}

/** Get a single manager–location assignment. */
export async function getManagerLocation(
  managerId: string,
  locationId: string,
): Promise<UserLocation | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${managerId}`, SK: `LOCATION#${locationId}` },
    }),
  );
  return (result.Item as UserLocation) ?? null;
}

/** Write a manager–location assignment. */
export async function createManagerLocation(assignment: UserLocation): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: assignment }));
}

/** Delete a manager–location assignment. */
export async function deleteManagerLocation(managerId: string, locationId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${managerId}`, SK: `LOCATION#${locationId}` },
    }),
  );
}
