/** Org-wide, read-only shifts-needed list: a paginated Query on the org partition (no Scan). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../../../../src/functions/shared/dynamo.js', async (orig) => ({
  ...(await orig<object>()),
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: 'T',
  getMetadataRecord: vi.fn(),
}));

import * as dynamo from '../../../../src/functions/shared/dynamo.js';
import { listShiftsNeeded } from '../../../../src/functions/org-admin/shifts-needed/service.js';
import { listShiftsNeededByOrg } from '../../../../src/functions/org-admin/shifts-needed/db.js';
import { ForbiddenError, ValidationError } from '../../../../src/functions/shared/errors.js';

beforeEach(() => {
  send.mockReset();
  vi.mocked(dynamo.getMetadataRecord).mockResolvedValue({ org_id: 'org-1' } as never);
});

describe('listShiftsNeeded', () => {
  it('lists the org’s shifts-needed for the month, sorted, with keys stripped', async () => {
    send.mockResolvedValueOnce({
      Items: [
        { PK: 'p', SK: 's', date: '2026-07-02', start_time: '09:00' },
        { PK: 'p', SK: 's', date: '2026-07-01', start_time: '13:00' },
        { PK: 'p', SK: 's', date: '2026-07-01', start_time: '08:00' },
      ],
    });

    const r = await listShiftsNeeded('sub', '2026-07');

    expect(r.map((n) => `${n.date} ${n.start_time}`)).toEqual([
      '2026-07-01 08:00',
      '2026-07-01 13:00',
      '2026-07-02 09:00',
    ]);
    expect(r[0]).not.toHaveProperty('PK');
  });

  it('rejects a malformed month and an unresolved org', async () => {
    await expect(listShiftsNeeded('sub', '2026-7')).rejects.toBeInstanceOf(ValidationError);
    vi.mocked(dynamo.getMetadataRecord).mockResolvedValue(null as never);
    await expect(listShiftsNeeded('sub', '2026-07')).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('listShiftsNeededByOrg', () => {
  it('Queries the SHIFT_NEEDED# prefix, filters the month on a non-key attribute, and paginates', async () => {
    send
      .mockResolvedValueOnce({ Items: [{ date: '2026-07-01' }], LastEvaluatedKey: { PK: 'x' } })
      .mockResolvedValueOnce({ Items: [{ date: '2026-07-02' }] });

    const items = await listShiftsNeededByOrg('org-1', '2026-07');

    expect(items).toHaveLength(2);
    const input = send.mock.calls[0][0].input;
    expect(input.KeyConditionExpression).toContain('begins_with(SK, :skPrefix)');
    expect(input.ExpressionAttributeValues[':skPrefix']).toBe('SHIFT_NEEDED#');
    // DynamoDB rejects key attributes in a FilterExpression.
    expect(input.FilterExpression).not.toMatch(/\bSK\b|\bPK\b/);
    expect(send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ PK: 'x' });
  });
});
