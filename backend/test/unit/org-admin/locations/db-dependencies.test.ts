/** The dependency counts use Query / BatchGet only — never a Scan. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../../../../src/functions/shared/dynamo.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: 'T',
  getMetadataRecord: vi.fn(),
  listOrgLocations: vi.fn(),
  getOrgLocation: vi.fn(),
}));
vi.mock('../../../../src/functions/org-admin/managers/db.js', () => ({
  listManagersByOrg: vi.fn(async () => [{ manager_id: 'm1' }]),
}));
vi.mock('../../../../src/functions/org-admin/employees/db.js', () => ({
  listEmployeesByOrg: vi.fn(async () => [{ employee_id: 'e1' }, { employee_id: 'e2' }]),
}));

import {
  countPeopleAtLocation,
  countShiftsAtLocation,
} from '../../../../src/functions/org-admin/locations/db.js';

beforeEach(() => {
  send.mockReset(); // (a returned mock would be run by vitest as a teardown hook)
});

describe('countShiftsAtLocation', () => {
  it('sums the filtered Query count across pages and excludes draft-failed sentinels', async () => {
    send
      .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { PK: 'x' } })
      .mockResolvedValueOnce({ Count: 1 });
    expect(await countShiftsAtLocation('org-1', 'l1')).toBe(3);
    const input = send.mock.calls[0][0].input;
    expect(input.KeyConditionExpression).toContain('begins_with(SK, :prefix)');
    expect(input.FilterExpression).toContain('location_id = :loc');
    // DynamoDB rejects key attributes in a FilterExpression — this 500'd every delete in dev.
    expect(input.FilterExpression).not.toMatch(/\bSK\b|\bPK\b/);
    expect(input.FilterExpression).toContain('#status <> :failed');
    expect(input.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(input.ExpressionAttributeValues[':failed']).toBe('draft_failed');
    expect(send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: 'x' });
  });
});

describe('countPeopleAtLocation', () => {
  it('BatchGets each manager and employee assignment item and counts them separately', async () => {
    send
      .mockResolvedValueOnce({ Responses: { T: [{ PK: 'USER#m1' }] } }) // managers batch
      .mockResolvedValueOnce({ Responses: { T: [{ PK: 'USER#e2' }] } }); // employees batch
    expect(await countPeopleAtLocation('org-1', 'l1')).toEqual({ managers: 1, employees: 1 });
    const keys = send.mock.calls.flatMap((c) => c[0].input.RequestItems.T.Keys);
    expect(keys).toEqual(
      expect.arrayContaining([
        { PK: 'USER#m1', SK: 'LOCATION#l1' },
        { PK: 'USER#e1', SK: 'LOCATION#l1' },
        { PK: 'USER#e2', SK: 'LOCATION#l1' },
      ]),
    );
  });

  it('is zero/zero when nobody is assigned', async () => {
    send.mockResolvedValue({ Responses: { T: [] } });
    expect(await countPeopleAtLocation('org-1', 'l1')).toEqual({ managers: 0, employees: 0 });
  });

  it('retries unprocessed keys', async () => {
    let first = true;
    send.mockImplementation(
      async (cmd: { input: { RequestItems: { T: { Keys: { PK: string }[] } } } }) => {
        const keys = cmd.input.RequestItems.T.Keys;
        if (keys.some((k) => k.PK === 'USER#m1') && first) {
          first = false;
          return { Responses: { T: [] }, UnprocessedKeys: { T: { Keys: keys } } };
        }
        return {
          Responses: { T: keys.filter((k) => k.PK === 'USER#m1').map((k) => ({ PK: k.PK })) },
        };
      },
    );
    expect(await countPeopleAtLocation('org-1', 'l1')).toEqual({ managers: 1, employees: 0 });
  });
});
