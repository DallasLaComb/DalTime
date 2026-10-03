import {
  BatchGetCommand,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  TABLE_NAME,
  getMetadataRecord,
  listOrgLocations,
  getOrgLocation,
} from '../../shared/dynamo.js';
import { listManagersByOrg } from '../managers/db.js';
import { listEmployeesByOrg } from '../employees/db.js';
import type { Location } from '../../shared/models/manager/location.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listLocations(orgId: string): Promise<Location[]> {
  return listOrgLocations(orgId);
}

export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  return getOrgLocation(orgId, locationId);
}

export async function createLocation(location: Location): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: location }));
}

/**
 * Update mutable fields on a location record.
 * Pass `address: null` to remove the address attribute entirely.
 */
export async function updateLocation(
  orgId: string,
  locationId: string,
  fields: { name?: string; address?: string | null },
  updatedAt: string,
): Promise<Location | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const setParts: string[] = ['#updated_at = :updated_at'];
  const removeParts: string[] = [];

  if (fields.name !== undefined) {
    names['#name'] = 'name';
    values[':name'] = fields.name;
    setParts.push('#name = :name');
  }

  if (fields.address !== undefined) {
    names['#address'] = 'address';
    if (fields.address === null) {
      removeParts.push('#address');
    } else {
      values[':address'] = fields.address;
      setParts.push('#address = :address');
    }
  }

  const expressionParts = [`SET ${setParts.join(', ')}`];
  if (removeParts.length > 0) expressionParts.push(`REMOVE ${removeParts.join(', ')}`);

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
      UpdateExpression: expressionParts.join(' '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );
  return (result.Attributes as Location) ?? null;
}

export async function deleteLocation(orgId: string, locationId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
    }),
  );
}

/**
 * How many shifts (past, draft or published) reference a location. One paginated Query on the org
 * partition (`begins_with(SK, 'SHIFT#')`), counted server-side with a filter; the `SHIFT#FAILED#…`
 * draft-failed sentinels (`status = draft_failed`) are not real shifts and are excluded. A FilterExpression
 * can't reference key attributes (`SK`), so the exclusion goes by `status`.
 */
export async function countShiftsAtLocation(orgId: string, locationId: string): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'location_id = :loc AND #status <> :failed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `ORG#${orgId}`,
          ':prefix': 'SHIFT#',
          ':failed': 'draft_failed',
          ':loc': locationId,
        },
        Select: 'COUNT',
        ExclusiveStartKey: lastKey,
      }),
    );
    count += result.Count ?? 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

/**
 * How many of the org's managers and employees are assigned to a location. Assignments are
 * `USER#<id>` / `LOCATION#<locationId>` items, so there is no key to Query by location: list the
 * org's people (Queries) and `BatchGet` each one's assignment item (no Scan).
 */
export async function countPeopleAtLocation(
  orgId: string,
  locationId: string,
): Promise<{ managers: number; employees: number }> {
  const [managers, employees] = await Promise.all([
    listManagersByOrg(orgId),
    listEmployeesByOrg(orgId),
  ]);
  const [managerCount, employeeCount] = await Promise.all([
    countAssigned(
      managers.map((m) => m.manager_id),
      locationId,
    ),
    countAssigned(
      employees.map((e) => e.employee_id),
      locationId,
    ),
  ]);
  return { managers: managerCount, employees: employeeCount };
}

/** BatchGet `USER#<id>` / `LOCATION#<locationId>` for each id (100 per call) and count the hits. */
async function countAssigned(ids: string[], locationId: string): Promise<number> {
  let count = 0;
  for (let i = 0; i < ids.length; i += 100) {
    let keys: Record<string, string>[] | undefined = ids
      .slice(i, i + 100)
      .map((id) => ({ PK: `USER#${id}`, SK: `LOCATION#${locationId}` }));
    while (keys && keys.length > 0) {
      const result = await docClient.send(
        new BatchGetCommand({
          RequestItems: { [TABLE_NAME]: { Keys: keys, ProjectionExpression: 'PK' } },
        }),
      );
      count += result.Responses?.[TABLE_NAME]?.length ?? 0;
      keys = result.UnprocessedKeys?.[TABLE_NAME]?.Keys as Record<string, string>[] | undefined;
    }
  }
  return count;
}
