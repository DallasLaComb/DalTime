import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';

export async function getCallerLookup(userId: string): Promise<{ org_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listShiftsByOrg(orgId: string, month: string): Promise<Shift[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'begins_with(#date, :month)',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'SHIFT#',
        ':month': month,
      },
    }),
  );
  return (result.Items ?? []) as Shift[];
}
