import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('../../../src/functions/shared/dynamo.js', () => ({
  docClient: { send: (...a: unknown[]) => send(...a) },
  TABLE_NAME: 'T',
}));

import {
  clearFailedMarker,
  failedMarkerSortKey,
  failedMarkerSuffix,
} from '../../../src/functions/shared/failed-marker.js';

const slot = {
  manager_id: 'm1',
  date: '2026-11-10',
  location_id: 'l1',
  start_time: '09:00',
  end_time: '13:00',
};

beforeEach(() => send.mockReset());

describe('failed marker key', () => {
  it('is deterministic: the same slot always maps to the same key', () => {
    expect(failedMarkerSortKey(slot)).toBe('SHIFT#FAILED#m1#2026-11-10#l1#09:00#13:00');
    expect(failedMarkerSortKey({ ...slot })).toBe(failedMarkerSortKey(slot));
    expect(failedMarkerSuffix(slot)).toBe('m1#2026-11-10#l1#09:00#13:00');
  });

  it('differs for a different date, location, time or manager', () => {
    const base = failedMarkerSortKey(slot);
    for (const over of [
      { date: '2026-11-11' },
      { location_id: 'l2' },
      { start_time: '10:00' },
      { end_time: '14:00' },
      { manager_id: 'm2' },
    ]) {
      expect(failedMarkerSortKey({ ...slot, ...over })).not.toBe(base);
    }
  });

  it('ignores extra fields on the object it is given (a whole shift-needed can be passed)', () => {
    expect(failedMarkerSortKey({ ...slot, employee_count: 2, notes: 'x' } as never)).toBe(
      failedMarkerSortKey(slot),
    );
  });
});

describe('clearFailedMarker', () => {
  it('deletes exactly that marker item (DeleteItem on the org partition — never a Scan)', async () => {
    send.mockResolvedValue({});
    await clearFailedMarker('org-1', slot);
    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0][0].input;
    expect(input.Key).toEqual({ PK: 'ORG#org-1', SK: 'SHIFT#FAILED#m1#2026-11-10#l1#09:00#13:00' });
    expect(input.TableName).toBe('T');
  });
});
