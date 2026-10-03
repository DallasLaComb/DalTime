/**
 * DynamoDB access layer for generate-dummy-data.
 *
 * Owns all BatchWriteItem operations for this feature. All reads are
 * delegated to shared utilities (listOrgLocations, listEmployeesByOrg,
 * listOrganizations, listManagersByOrg) rather than re-implementing them
 * here — this file only contains what is unique to the bulk-write path.
 */
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { EmployeeAvailability } from '../../shared/models/employee/availability.model.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';

/**
 * One DynamoDB write request entry for BatchWriteItem.
 * Typed explicitly rather than using `any` so the batch functions are strict.
 */
type PutRequest = {
  PutRequest: { Item: Record<string, unknown> };
};

/**
 * Chunk an array into slices of `size` elements. DynamoDB BatchWriteItem
 * accepts a maximum of 25 requests per call, so callers must use this
 * to split their item list before issuing batch writes.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Write a batch of items to DynamoDB using BatchWriteItem with
 * UnprocessedItems retry/backoff.
 *
 * DynamoDB may return UnprocessedItems when throughput is exceeded or the
 * service is briefly unavailable. We retry up to MAX_RETRIES times with
 * exponential backoff (100 ms base, doubling each attempt) rather than
 * dropping items silently.
 *
 * Items must be pre-chunked into slices of ≤25 before calling this function.
 * Passing more than 25 items throws immediately so the bug is visible rather
 * than silently losing items beyond position 25.
 */
export async function batchWriteWithRetry(requests: PutRequest[]): Promise<void> {
  const MAX_BATCH = 25;
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 100;

  if (requests.length > MAX_BATCH) {
    throw new Error(
      `batchWriteWithRetry received ${requests.length} items — max is ${MAX_BATCH}. Pre-chunk with chunkArray before calling.`,
    );
  }

  let pending: PutRequest[] = requests;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (pending.length === 0) break;

    const result = await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: pending,
        },
      }),
    );

    // Extract any unprocessed items for retry on the next iteration.
    const unprocessed = result.UnprocessedItems?.[TABLE_NAME];
    if (!unprocessed || unprocessed.length === 0) {
      pending = [];
      break;
    }

    pending = unprocessed as PutRequest[];

    if (attempt < MAX_RETRIES - 1) {
      // Exponential backoff before retrying unprocessed items.
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  // If items are still unprocessed after all retries, surface the failure
  // so the caller can log and surface an error rather than silently losing data.
  if (pending.length > 0) {
    throw new Error(
      `BatchWriteItem: ${pending.length} items remain unprocessed after ${MAX_RETRIES} retries`,
    );
  }
}

/**
 * Bulk-write availability records for all qualifying employees in one org.
 *
 * Each `EmployeeAvailability` item has a unique PK (USER#<employeeId>) / SK
 * (AVAILABILITY) combination — no within-batch key conflicts are possible
 * across employees. Items are chunked into slices of 25 before sending.
 */
export async function batchWriteAvailability(records: EmployeeAvailability[]): Promise<void> {
  if (records.length === 0) return;

  const requests: PutRequest[] = records.map((record) => ({
    PutRequest: { Item: record as unknown as Record<string, unknown> },
  }));

  const chunks = chunkArray(requests, 25);
  for (const chunk of chunks) {
    await batchWriteWithRetry(chunk);
  }
}

/**
 * Bulk-write open shift records for one org.
 *
 * Each shift has a unique PK (ORG#<orgId>) / SK (SHIFT#<UUID>) combination —
 * UUIDs are generated fresh per item so no conflicts are possible. Items are
 * chunked into slices of 25 before sending.
 */
export async function batchWriteShifts(shifts: Shift[]): Promise<void> {
  if (shifts.length === 0) return;

  const requests: PutRequest[] = shifts.map((shift) => ({
    PutRequest: { Item: shift as unknown as Record<string, unknown> },
  }));

  const chunks = chunkArray(requests, 25);
  for (const chunk of chunks) {
    await batchWriteWithRetry(chunk);
  }
}
