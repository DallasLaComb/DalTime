/**
 * Disabling a manager must not strand their people or shifts:
 *  - active employees assigned to them BLOCK the disable (409 + counts), reassign first;
 *  - upcoming shifts need an explicit acknowledgement;
 *  - re-enabling restores the user's REAL Cognito status (a pending user stays pending).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {},
  AdminCreateUserCommand: class {},
  AdminAddUserToGroupCommand: class {},
  UsernameExistsException: class extends Error {},
  InvalidPasswordException: class extends Error {},
}));
vi.mock('../../../../src/functions/shared/cognito.js', () => ({
  enrichWithCognitoStatus: vi.fn(async (items: unknown[]) => items),
  adminDisableUser: vi.fn(),
  adminEnableUser: vi.fn(),
}));
vi.mock('../../../../src/functions/org-admin/managers/db.js', () => ({
  getCallerLookup: vi.fn(),
  getManagerReverseLookup: vi.fn(),
  getManager: vi.fn(),
  countActiveEmployeesOfManager: vi.fn(),
  countUpcomingShiftsOfManager: vi.fn(),
  disableManager: vi.fn(),
  enableManager: vi.fn(),
  decrementManagerCount: vi.fn(),
}));

import * as db from '../../../../src/functions/org-admin/managers/db.js';
import * as cognito from '../../../../src/functions/shared/cognito.js';
import {
  disableManager,
  enableManager,
} from '../../../../src/functions/org-admin/managers/service.js';
import { ConflictError } from '../../../../src/functions/shared/errors.js';

const client = {} as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1', user_id: 'admin-1' });
  vi.mocked(db.getManagerReverseLookup).mockResolvedValue({
    manager_id: 'mgr-1',
    org_id: 'org-1',
    email: 'm@x.com',
  });
  vi.mocked(db.getManager).mockResolvedValue({ first_name: 'Mona', last_name: 'Lisa' } as never);
  vi.mocked(db.countActiveEmployeesOfManager).mockResolvedValue(0);
  vi.mocked(db.countUpcomingShiftsOfManager).mockResolvedValue(0);
});

describe('disableManager', () => {
  it('disables a manager with no employees and no upcoming shifts', async () => {
    await disableManager('sub', 'mgr-1', client);
    expect(cognito.adminDisableUser).toHaveBeenCalled();
    expect(db.disableManager).toHaveBeenCalledWith('org-1', 'mgr-1');
  });

  it('BLOCKS while active employees are assigned, with the counts in the 409', async () => {
    vi.mocked(db.countActiveEmployeesOfManager).mockResolvedValue(2);
    vi.mocked(db.countUpcomingShiftsOfManager).mockResolvedValue(3);

    const err = await disableManager('sub', 'mgr-1', client).catch((e) => e);

    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe(
      'Mona Lisa manages 2 employees and has 3 upcoming shifts. Reassign their employees to another manager first.',
    );
    expect(err.details).toEqual({ employees: 2, shifts: 3 });
    expect(cognito.adminDisableUser).not.toHaveBeenCalled();
    expect(db.disableManager).not.toHaveBeenCalled();
  });

  it('uses singular wording for one employee', async () => {
    vi.mocked(db.countActiveEmployeesOfManager).mockResolvedValue(1);
    const err = await disableManager('sub', 'mgr-1', client).catch((e) => e);
    expect(err.message).toContain('manages 1 employee.');
  });

  it('employees block even when the shifts were acknowledged', async () => {
    vi.mocked(db.countActiveEmployeesOfManager).mockResolvedValue(1);
    vi.mocked(db.countUpcomingShiftsOfManager).mockResolvedValue(2);
    await expect(
      disableManager('sub', 'mgr-1', client, { acknowledgeShifts: true }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(db.disableManager).not.toHaveBeenCalled();
  });

  it('asks for acknowledgement when only shifts remain, then proceeds once given', async () => {
    vi.mocked(db.countUpcomingShiftsOfManager).mockResolvedValue(4);

    const err = await disableManager('sub', 'mgr-1', client).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.details).toEqual({ employees: 0, shifts: 4, requires_acknowledgement: true });
    expect(db.disableManager).not.toHaveBeenCalled();

    await disableManager('sub', 'mgr-1', client, { acknowledgeShifts: true });
    expect(db.disableManager).toHaveBeenCalledWith('org-1', 'mgr-1');
  });

  it('only counts shifts dated today or later', async () => {
    await disableManager('sub', 'mgr-1', client);
    const [, from] = vi.mocked(db.countUpcomingShiftsOfManager).mock.calls[0];
    expect(from).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('enableManager', () => {
  it('restores the real Cognito status: a user who never set a password stays pending', async () => {
    vi.mocked(cognito.adminEnableUser).mockResolvedValue('FORCE_CHANGE_PASSWORD' as never);
    await enableManager('sub', 'mgr-1', client);
    expect(db.enableManager).toHaveBeenCalledWith('org-1', 'mgr-1', 'FORCE_CHANGE_PASSWORD');
  });

  it('marks a user who has set a password CONFIRMED', async () => {
    vi.mocked(cognito.adminEnableUser).mockResolvedValue('CONFIRMED' as never);
    await enableManager('sub', 'mgr-1', client);
    expect(db.enableManager).toHaveBeenCalledWith('org-1', 'mgr-1', 'CONFIRMED');
  });
});
