import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, GSI1_INDEX, TABLE_NAME } from '../../shared/dynamo.js';
import type { WebAdminEmployee } from '../../shared/models/web-admin/employee.model.js';

export async function listAllEmployees(): Promise<WebAdminEmployee[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'EMPLOYEE' },
    }),
  );
  return (result.Items ?? []) as WebAdminEmployee[];
}

export async function batchGetOrgNames(orgIds: string[]): Promise<Record<string, string>> {
  if (orgIds.length === 0) return {};

  const keys = orgIds.map((id) => ({ PK: `ORG#${id}`, SK: 'METADATA' }));
  const result = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: keys,
          ProjectionExpression: 'org_id, #n',
          ExpressionAttributeNames: { '#n': 'name' },
        },
      },
    }),
  );

  const map: Record<string, string> = {};
  const items = (result.Responses?.[TABLE_NAME] ?? []) as { org_id: string; name: string }[];
  for (const item of items) {
    map[item.org_id] = item.name;
  }
  return map;
}
