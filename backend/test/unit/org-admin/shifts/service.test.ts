/**
 * Org-admin shift service: the read-only, org-wide list. (Creating, editing and deleting shifts is
 * manager work — see handler.test.ts for the rule that the org-admin route refuses them.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/functions/org-admin/shifts/db.js', () => ({
  getCallerLookup: vi.fn(),
  listShiftsByOrg: vi.fn(),
}));

import * as orgDb from '../../../../src/functions/org-admin/shifts/db.js';
import { listShifts } from '../../../../src/functions/org-admin/shifts/service.js';
import { ForbiddenError } from '../../../../src/functions/shared/errors.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(orgDb.getCallerLookup).mockResolvedValue({ org_id: 'org-1' });
});

describe('listShifts', () => {
  it('lists the org’s shifts sorted by date then start time', async () => {
    vi.mocked(orgDb.listShiftsByOrg).mockResolvedValue([
      { PK: 'p', SK: 's', date: '2026-07-02', start_time: '09:00' },
      { PK: 'p', SK: 's', date: '2026-07-01', start_time: '13:00' },
      { PK: 'p', SK: 's', date: '2026-07-01', start_time: '08:00' },
    ] as never);

    const result = await listShifts('sub-1', '2026-07');
    expect(orgDb.listShiftsByOrg).toHaveBeenCalledWith('org-1', '2026-07');
    expect(result.map((s) => `${s.date} ${s.start_time}`)).toEqual([
      '2026-07-01 08:00',
      '2026-07-01 13:00',
      '2026-07-02 09:00',
    ]);
    expect(result[0]).not.toHaveProperty('PK');
  });

  it('refuses when the caller’s org cannot be resolved', async () => {
    vi.mocked(orgDb.getCallerLookup).mockResolvedValue(null);
    await expect(listShifts('sub-1', '2026-07')).rejects.toBeInstanceOf(ForbiddenError);
  });
});
