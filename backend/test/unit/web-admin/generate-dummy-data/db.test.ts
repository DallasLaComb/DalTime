/**
 * Unit tests for db.ts — DynamoDB access layer for generate-dummy-data.
 *
 * Covers:
 *   - chunkArray: splitting arrays into correctly-sized slices
 *   - batchWriteWithRetry: single-shot success, retry on UnprocessedItems, throw after MAX_RETRIES
 *   - batchWriteAvailability: early-exit for empty arrays, chunking behaviour
 *   - batchWriteShifts: early-exit for empty arrays, chunking behaviour
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest/extend';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../../../src/functions/shared/dynamo.js';
import {
  chunkArray,
  batchWriteWithRetry,
  batchWriteAvailability,
  batchWriteShifts,
} from '../../../../src/functions/web-admin/generate-dummy-data/db.js';
import type { EmployeeAvailability } from '../../../../src/functions/shared/models/employee/availability.model.js';
import type { Shift } from '../../../../src/functions/shared/models/manager/shift.model.js';

// ─── DynamoDB mock ────────────────────────────────────────────────────────────

const ddbMock = mockClient(docClient as unknown as DynamoDBDocumentClient);

/**
 * TABLE_NAME is read from process.env.TABLE_NAME at dynamo.ts module initialisation.
 * In the unit test environment, that env var is not set, so TABLE_NAME resolves to
 * `undefined` — which means the BatchWriteItem RequestItems key is literally the
 * string "undefined". We normalise that here so assertions are readable.
 */
const EFFECTIVE_TABLE = process.env['TABLE_NAME'] ?? 'undefined';

beforeEach(() => {
  ddbMock.reset();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build N minimal PutRequest objects for testing batch write paths. */
function buildPutRequests(count: number): Array<{ PutRequest: { Item: Record<string, unknown> } }> {
  return Array.from({ length: count }, (_, i) => ({
    PutRequest: { Item: { PK: `TEST#${i}`, SK: 'DATA' } },
  }));
}

/** Minimal EmployeeAvailability shape sufficient for db layer writes. */
function buildAvailabilityRecord(employeeId: string): EmployeeAvailability {
  return {
    PK: `USER#${employeeId}`,
    SK: 'AVAILABILITY',
    employee_id: employeeId,
    org_id: 'org-001',
    schedule: {
      monday: { available: true, slots: [{ from: '08:00', to: '16:00' }], max_shifts: 1 },
      tuesday: { available: false },
      wednesday: { available: true, slots: [{ from: '09:00', to: '17:00' }], max_shifts: 1 },
      thursday: { available: false },
      friday: { available: true, slots: [{ from: '12:00', to: '20:00' }], max_shifts: 1 },
      saturday: { available: false },
      sunday: { available: false },
    },
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

/** Minimal Shift shape sufficient for db layer writes. */
function buildShift(shiftId: string, orgId = 'org-001'): Shift {
  return {
    PK: `ORG#${orgId}`,
    SK: `SHIFT#${shiftId}`,
    GSI1PK: 'MANAGER#mgr-001',
    GSI1SK: '2026-06-15T08:00',
    shift_id: shiftId,
    org_id: orgId,
    manager_id: 'mgr-001',
    employee_id: '',
    employee_name: '',
    location_id: 'loc-1',
    location_name: 'Main Street',
    date: '2026-06-15',
    start_time: '08:00',
    end_time: '16:00',
    type: 'morning',
    status: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

// ─── chunkArray ───────────────────────────────────────────────────────────────

describe('chunkArray', () => {
  it('returns a single chunk when array length equals chunk size', () => {
    const items = [1, 2, 3, 4, 5];
    const result = chunkArray(items, 5);
    expect(result).toEqual([[1, 2, 3, 4, 5]]);
  });

  it('returns a single chunk when array length is less than chunk size', () => {
    const items = [1, 2, 3];
    const result = chunkArray(items, 10);
    expect(result).toEqual([[1, 2, 3]]);
  });

  it('splits 26 items into chunks of 25 correctly (DynamoDB BatchWriteItem boundary)', () => {
    const items = Array.from({ length: 26 }, (_, i) => i);
    const result = chunkArray(items, 25);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(25);
    expect(result[1]).toHaveLength(1);
  });

  it('splits 50 items into exactly two chunks of 25', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = chunkArray(items, 25);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(25);
    expect(result[1]).toHaveLength(25);
  });

  it('returns an empty array when input is empty', () => {
    expect(chunkArray([], 25)).toEqual([]);
  });

  it('preserves item identity (no mutation or copying of values)', () => {
    const obj = { x: 1 };
    const result = chunkArray([obj], 5);
    expect(result[0][0]).toBe(obj); // same reference
  });

  it('handles chunk size of 1 — every item in its own array', () => {
    const items = [10, 20, 30];
    const result = chunkArray(items, 1);
    expect(result).toEqual([[10], [20], [30]]);
  });
});

// ─── batchWriteWithRetry ──────────────────────────────────────────────────────

describe('batchWriteWithRetry', () => {
  it('succeeds on the first attempt when no UnprocessedItems are returned', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const requests = buildPutRequests(3);
    await expect(batchWriteWithRetry(requests)).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });

  it('sends items to the correct DynamoDB table', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const requests = buildPutRequests(2);
    await batchWriteWithRetry(requests);

    const call = ddbMock.commandCalls(BatchWriteCommand)[0];
    expect(call.args[0].input.RequestItems).toHaveProperty(EFFECTIVE_TABLE);
  });

  it('retries once when the first call returns UnprocessedItems', async () => {
    const requests = buildPutRequests(2);

    // First call: return one of the items as unprocessed
    ddbMock
      .on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [EFFECTIVE_TABLE]: [requests[0]] } })
      .resolvesOnce({ UnprocessedItems: {} });

    await expect(batchWriteWithRetry(requests)).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
  });

  it('retries up to MAX_RETRIES (5) when items remain unprocessed, then throws', async () => {
    const requests = buildPutRequests(1);

    // Every call returns the item as unprocessed
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: { [EFFECTIVE_TABLE]: requests },
    });

    await expect(batchWriteWithRetry(requests)).rejects.toThrow(
      /items remain unprocessed after 5 retries/,
    );

    // MAX_RETRIES = 5 → exactly 5 DynamoDB calls were made
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(5);
  }, 30_000); // extended timeout for backoff delays

  it('throws immediately when more than 25 items are passed (fail loudly, not silently)', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    // Pass 30 items — exceeds the DynamoDB BatchWriteItem max of 25.
    // batchWriteWithRetry must throw rather than silently truncate so the
    // caller is forced to pre-chunk correctly via chunkArray.
    const requests = buildPutRequests(30);
    await expect(batchWriteWithRetry(requests)).rejects.toThrow(
      /received 30 items — max is 25/,
    );
    // No DynamoDB call should have been made
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
  });

  it('resolves immediately on the first call when UnprocessedItems is undefined', async () => {
    // Some DynamoDB SDK versions omit UnprocessedItems entirely on success
    ddbMock.on(BatchWriteCommand).resolves({});

    await expect(batchWriteWithRetry(buildPutRequests(1))).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });
});

// ─── batchWriteAvailability ───────────────────────────────────────────────────

describe('batchWriteAvailability', () => {
  it('resolves immediately when records array is empty (no DynamoDB call)', async () => {
    await expect(batchWriteAvailability([])).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
  });

  it('sends a single BatchWriteCommand for fewer than 25 records', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const records = Array.from({ length: 5 }, (_, i) => buildAvailabilityRecord(`emp-${i}`));
    await batchWriteAvailability(records);

    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });

  it('sends multiple BatchWriteCommands when records exceed 25 (two chunks for 30 records)', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const records = Array.from({ length: 30 }, (_, i) => buildAvailabilityRecord(`emp-${i}`));
    await batchWriteAvailability(records);

    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
  });

  it('wraps each record in PutRequest correctly', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const record = buildAvailabilityRecord('emp-test');
    await batchWriteAvailability([record]);

    const call = ddbMock.commandCalls(BatchWriteCommand)[0];
    const items = (call.args[0].input.RequestItems as Record<string, Array<{ PutRequest?: { Item: unknown } }>>)[
      EFFECTIVE_TABLE
    ];
    expect(items[0]).toHaveProperty('PutRequest');
    expect(items[0].PutRequest?.Item).toMatchObject({
      PK: `USER#emp-test`,
      SK: 'AVAILABILITY',
    });
  });
});

// ─── batchWriteShifts ─────────────────────────────────────────────────────────

describe('batchWriteShifts', () => {
  it('resolves immediately when shifts array is empty (no DynamoDB call)', async () => {
    await expect(batchWriteShifts([])).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
  });

  it('sends a single BatchWriteCommand for fewer than 25 shifts', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const shifts = Array.from({ length: 10 }, (_, i) => buildShift(`shift-${i}`));
    await batchWriteShifts(shifts);

    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(1);
  });

  it('sends multiple BatchWriteCommands when shifts exceed 25 (two chunks for 26 shifts)', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const shifts = Array.from({ length: 26 }, (_, i) => buildShift(`shift-${i}`));
    await batchWriteShifts(shifts);

    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
  });

  it('wraps each shift in PutRequest with correct PK/SK', async () => {
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });

    const shift = buildShift('test-shift-id');
    await batchWriteShifts([shift]);

    const call = ddbMock.commandCalls(BatchWriteCommand)[0];
    const items = (call.args[0].input.RequestItems as Record<string, Array<{ PutRequest?: { Item: unknown } }>>)[
      EFFECTIVE_TABLE
    ];
    expect(items[0]).toHaveProperty('PutRequest');
    expect(items[0].PutRequest?.Item).toMatchObject({
      PK: 'ORG#org-001',
      SK: 'SHIFT#test-shift-id',
      employee_id: '',
      employee_name: '',
    });
  });

  it('propagates errors from batchWriteWithRetry', async () => {
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {
        [EFFECTIVE_TABLE]: buildPutRequests(1),
      },
    });

    const shifts = [buildShift('test-shift-will-fail')];
    await expect(batchWriteShifts(shifts)).rejects.toThrow(/items remain unprocessed after 5 retries/);
  }, 30_000);
});
