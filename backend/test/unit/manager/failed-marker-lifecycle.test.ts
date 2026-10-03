/**
 * A draft_failed marker means "Generate Draft tried this slot and found no employee". It must not
 * outlive the slot's situation: editing or deleting the need clears it, and filling the slot (by
 * hand) clears it. (A later Generate Draft run clearing/re-marking is covered in schedule/service.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/functions/manager/shifts-needed/db.js', () => ({
  getCallerLookup: vi.fn(),
  getShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
  clearFailedMarker: vi.fn(),
}));
vi.mock('../../../src/functions/manager/locations/db.js', () => ({ getLocation: vi.fn() }));
vi.mock('../../../src/functions/manager/shifts/db.js', () => ({
  getCallerLookup: vi.fn(),
  getEmployee: vi.fn(),
  getShift: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  clearFailedMarker: vi.fn(),
}));

import * as needsDb from '../../../src/functions/manager/shifts-needed/db.js';
import * as shiftsDb from '../../../src/functions/manager/shifts/db.js';
import * as needs from '../../../src/functions/manager/shifts-needed/service.js';
import * as shifts from '../../../src/functions/manager/shifts/service.js';

const SLOT = {
  shift_id: 'sn-1',
  manager_id: 'mgr-1',
  date: '2026-11-10',
  location_id: 'loc-1',
  start_time: '09:00',
  end_time: '13:00',
  employee_count: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(needsDb.getCallerLookup).mockResolvedValue({ org_id: 'org-1', manager_id: 'mgr-1' });
  vi.mocked(shiftsDb.getCallerLookup).mockResolvedValue({ org_id: 'org-1', manager_id: 'mgr-1' });
});

describe('deleting a shift need', () => {
  it('clears its marker, so no orphan "Unfilled" mark is left behind', async () => {
    vi.mocked(needsDb.getShift).mockResolvedValue(SLOT as never);

    await needs.removeShift('sub', 'sn-1');

    expect(needsDb.deleteShift).toHaveBeenCalledWith('org-1', 'sn-1');
    expect(needsDb.clearFailedMarker).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        manager_id: 'mgr-1',
        date: '2026-11-10',
        location_id: 'loc-1',
        start_time: '09:00',
        end_time: '13:00',
      }),
    );
  });

  it('does not clear anything when the need is not found / not yours', async () => {
    vi.mocked(needsDb.getShift).mockResolvedValue(null);
    await expect(needs.removeShift('sub', 'nope')).rejects.toThrow();
    vi.mocked(needsDb.getShift).mockResolvedValue({ ...SLOT, manager_id: 'someone-else' } as never);
    await expect(needs.removeShift('sub', 'sn-1')).rejects.toThrow();
    expect(needsDb.clearFailedMarker).not.toHaveBeenCalled();
  });
});

describe('editing a shift need — decision: any edit resets the attempt', () => {
  it('clears the marker for the OLD slot (the new request gets a fresh attempt)', async () => {
    vi.mocked(needsDb.getShift).mockResolvedValue(SLOT as never);
    vi.mocked(needsDb.updateShift).mockResolvedValue({ ...SLOT, start_time: '10:00' } as never);

    await needs.updateShift('sub', 'sn-1', { start_time: '10:00' });

    // the marker is keyed by the old 09:00 slot, which no longer exists
    expect(needsDb.clearFailedMarker).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        start_time: '09:00',
        end_time: '13:00',
      }),
    );
  });

  it('clears it even when only the head-count changed', async () => {
    vi.mocked(needsDb.getShift).mockResolvedValue(SLOT as never);
    vi.mocked(needsDb.updateShift).mockResolvedValue({ ...SLOT, employee_count: 3 } as never);

    await needs.updateShift('sub', 'sn-1', { employee_count: 3 });

    expect(needsDb.clearFailedMarker).toHaveBeenCalledTimes(1);
  });

  it('leaves the marker alone when the update fails', async () => {
    vi.mocked(needsDb.getShift).mockResolvedValue(SLOT as never);
    vi.mocked(needsDb.updateShift).mockResolvedValue(null);
    await expect(needs.updateShift('sub', 'sn-1', { employee_count: 2 })).rejects.toThrow();
    expect(needsDb.clearFailedMarker).not.toHaveBeenCalled();
  });
});

describe('filling a slot by hand clears its marker', () => {
  const body = {
    employee_id: 'emp-1',
    location_id: 'loc-1',
    date: '2026-11-10',
    start_time: '09:00',
    end_time: '13:00',
  };

  it('creating a shift WITH an employee clears the marker for its slot', async () => {
    vi.mocked(shiftsDb.getEmployee).mockResolvedValue({
      employee_id: 'emp-1',
      manager_id: 'mgr-1',
      first_name: 'Ada',
      last_name: 'L',
    } as never);

    await shifts.createShift('sub', body);

    expect(shiftsDb.clearFailedMarker).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        manager_id: 'mgr-1',
        date: '2026-11-10',
        location_id: 'loc-1',
        start_time: '09:00',
        end_time: '13:00',
      }),
    );
  });

  it('creating an OPEN shift (no employee) does not — nothing was filled', async () => {
    await shifts.createShift('sub', { ...body, employee_id: undefined });
    expect(shiftsDb.clearFailedMarker).not.toHaveBeenCalled();
  });

  it('assigning an employee to a shift clears the marker; un-assigning does not', async () => {
    vi.mocked(shiftsDb.getShift).mockResolvedValue({
      shift_id: 's1',
      manager_id: 'mgr-1',
      start_time: '09:00',
      end_time: '13:00',
      date: '2026-11-10',
      location_id: 'loc-1',
    } as never);
    vi.mocked(shiftsDb.getEmployee).mockResolvedValue({
      employee_id: 'emp-1',
      manager_id: 'mgr-1',
      first_name: 'Ada',
      last_name: 'L',
    } as never);
    vi.mocked(shiftsDb.updateShift).mockResolvedValue({
      shift_id: 's1',
      manager_id: 'mgr-1',
      employee_id: 'emp-1',
      date: '2026-11-10',
      location_id: 'loc-1',
      start_time: '09:00',
      end_time: '13:00',
    } as never);

    await shifts.updateShift('sub', 's1', { employee_id: 'emp-1' });
    expect(shiftsDb.clearFailedMarker).toHaveBeenCalledTimes(1);

    vi.mocked(shiftsDb.clearFailedMarker).mockClear();
    vi.mocked(shiftsDb.updateShift).mockResolvedValue({
      shift_id: 's1',
      manager_id: 'mgr-1',
      employee_id: '',
      date: '2026-11-10',
      location_id: 'loc-1',
      start_time: '09:00',
      end_time: '13:00',
    } as never);
    await shifts.updateShift('sub', 's1', { employee_id: '' });
    expect(shiftsDb.clearFailedMarker).not.toHaveBeenCalled();
  });
});
