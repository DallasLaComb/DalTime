/** A location's address is mandatory: admins need to see where each one is. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/functions/org-admin/locations/db.js', () => ({
  getCallerLookup: vi.fn(),
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  getLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

import * as db from '../../../../src/functions/org-admin/locations/db.js';
import {
  createLocation,
  updateLocation,
} from '../../../../src/functions/org-admin/locations/service.js';
import { ValidationError } from '../../../../src/functions/shared/errors.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1', user_id: 'admin-1' } as never);
  vi.mocked(db.getLocation).mockResolvedValue({ location_id: 'l1' } as never);
  vi.mocked(db.updateLocation).mockResolvedValue({ PK: 'p', SK: 's', location_id: 'l1' } as never);
});

describe('createLocation', () => {
  it('stores the trimmed address', async () => {
    const created = await createLocation('sub', { name: 'Main', address: '  123 Main St ' });
    expect(created.address).toBe('123 Main St');
    expect(db.createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ address: '123 Main St' }),
    );
  });

  it.each([undefined, '', '   '])('rejects a missing address (%j)', async (address) => {
    await expect(createLocation('sub', { name: 'Main', address })).rejects.toThrow(
      new ValidationError('address is required'),
    );
    expect(db.createLocation).not.toHaveBeenCalled();
  });
});

describe('updateLocation', () => {
  it('changes the address', async () => {
    await updateLocation('sub', 'l1', { address: ' 9 Elm St ' });
    expect(db.updateLocation).toHaveBeenCalledWith(
      'org-1',
      'l1',
      { address: '9 Elm St' },
      expect.any(String),
    );
  });

  it('refuses to clear the address', async () => {
    await expect(updateLocation('sub', 'l1', { address: '  ' })).rejects.toThrow(
      new ValidationError('address cannot be empty'),
    );
    expect(db.updateLocation).not.toHaveBeenCalled();
  });

  it('still allows renaming without touching the address', async () => {
    await updateLocation('sub', 'l1', { name: 'Renamed' });
    expect(db.updateLocation).toHaveBeenCalledWith(
      'org-1',
      'l1',
      { name: 'Renamed' },
      expect.any(String),
    );
  });
});
