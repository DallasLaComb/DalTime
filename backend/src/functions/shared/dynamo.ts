import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** Shared DynamoDB Document Client — initialised once per Lambda cold start. */
const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

/** Single table name injected via environment variable. */
export const TABLE_NAME = process.env.TABLE_NAME!;

/** GSI1 index name used for listing entities by type. */
export const GSI1_INDEX = 'GSI1';

/** Single-table key fields that should not be exposed to API consumers. */
const KEY_FIELDS = ['PK', 'SK', 'GSI1PK', 'GSI1SK'] as const;

/** Strip single-table key attributes from a DynamoDB item before returning it. */
export function stripKeys<T>(item: T): Omit<T, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'> {
  const cleaned = { ...item } as Record<string, unknown>;
  for (const key of KEY_FIELDS) delete cleaned[key];
  return cleaned as Omit<T, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>;
}
