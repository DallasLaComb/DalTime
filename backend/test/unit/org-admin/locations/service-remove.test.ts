/** Deleting a location that shifts or people still reference would orphan them, so it is blocked. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/functions/org-admin/locations/db.js', () => ({
  getCallerLookup: vi.fn(),
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  getLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
  countShiftsAtLocation: vi.fn(),
  countPeopleAtLocation: vi.fn(),
}));

import * as db from '../../../../src/functions/org-admin/locations/db.js';
import { removeLocation } from '../../../../src/functions/org-admin/locations/service.js';
import { ConflictError, NotFoundError } from '../../../../src/functions/shared/errors.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1', user_id: 'admin-1' } as never);
  vi.mocked(db.getLocation).mockResolvedValue({
    location_id: 'l1',
    name: 'Platt High School',
  } as never);
  vi.mocked(db.countShiftsAtLocation).mockResolvedValue(0);
  vi.mocked(db.countPeopleAtLocation).mockResolvedValue({ managers: 0, employees: 0 });
});

describe('removeLocation', () => {
  it('deletes a location nothing references', async () => {
    await removeLocation('sub', 'l1');
    expect(db.deleteLocation).toHaveBeenCalledWith('org-1', 'l1');
  });

  it('blocks on shifts alone and carries the counts as structured details', async () => {
    vi.mocked(db.countShiftsAtLocation).mockResolvedValue(3);
    const err = await removeLocation('sub', 'l1').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe('Platt High School has 3 shifts. Reassign or remove them first.');
    expect(err.details).toEqual({ shifts: 3, managers: 0, employees: 0 });
    expect(db.deleteLocation).not.toHaveBeenCalled();
  });

  it('says "it" for a single shift, "them" otherwise', async () => {
    vi.mocked(db.countShiftsAtLocation).mockResolvedValue(1);
    const one = await removeLocation('sub', 'l1').catch((e) => e);
    expect(one.message).toBe('Platt High School has 1 shift. Reassign or remove it first.');

    vi.mocked(db.countPeopleAtLocation).mockResolvedValue({ managers: 0, employees: 1 });
    const mixed = await removeLocation('sub', 'l1').catch((e) => e);
    expect(mixed.message).toBe(
      'Platt High School has 1 shift and 1 assigned person. Reassign or remove them first.',
    );
  });

  it('blocks on an assigned manager', async () => {
    vi.mocked(db.countPeopleAtLocation).mockResolvedValue({ managers: 1, employees: 0 });
    const err = await removeLocation('sub', 'l1').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe(
      'Platt High School has 1 assigned person. Reassign or remove them first.',
    );
    expect(err.details).toEqual({ shifts: 0, managers: 1, employees: 0 });
    expect(db.deleteLocation).not.toHaveBeenCalled();
  });

  it('blocks on assigned employees, and combines shifts with managers + employees', async () => {
    vi.mocked(db.countShiftsAtLocation).mockResolvedValue(3);
    vi.mocked(db.countPeopleAtLocation).mockResolvedValue({ managers: 1, employees: 1 });
    const err = await removeLocation('sub', 'l1').catch((e) => e);
    expect(err.message).toBe(
      'Platt High School has 3 shifts and 2 assigned people. Reassign or remove them first.',
    );
    expect(err.details).toEqual({ shifts: 3, managers: 1, employees: 1 });
    expect(db.deleteLocation).not.toHaveBeenCalled();
  });

  it('counts past and draft shifts too (any shift referencing the location blocks)', async () => {
    vi.mocked(db.countShiftsAtLocation).mockResolvedValue(5);
    await expect(removeLocation('sub', 'l1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('404s for an unknown location without counting anything', async () => {
    vi.mocked(db.getLocation).mockResolvedValue(null);
    await expect(removeLocation('sub', 'nope')).rejects.toBeInstanceOf(NotFoundError);
    expect(db.countShiftsAtLocation).not.toHaveBeenCalled();
    expect(db.countPeopleAtLocation).not.toHaveBeenCalled();
  });
});
