/**
 * A manager's shifts and shifts-needed share GSI1PK = MANAGER#<id>, so the month Query returns
 * both. Only shifts-needed may come back: a shift has no employee_count, which made Generate Draft
 * report "null slots" (NaN → JSON null).
 */
import { describe, it, expect, vi } from 'vitest';

const send = vi.fn();
vi.mock('../../../../src/functions/shared/dynamo.js', async (orig) => ({
  ...(await orig<object>()),
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: 'T',
}));

import { listShifts } from '../../../../src/functions/manager/shifts-needed/db.js';

describe('shifts-needed listShifts', () => {
  it('returns only SHIFT_NEEDED# items, not the manager’s ordinary shifts', async () => {
    send.mockResolvedValueOnce({
      Items: [
        { SK: 'SHIFT#a', date: '2026-10-02' },
        { SK: 'SHIFT_NEEDED#n1', date: '2026-10-02', employee_count: 1 },
        { SK: 'SHIFT#FAILED#x', date: '2026-10-03' },
      ],
    });

    const items = await listShifts('mgr-1', '2026-10');

    expect(items).toEqual([{ SK: 'SHIFT_NEEDED#n1', date: '2026-10-02', employee_count: 1 }]);
  });
});
