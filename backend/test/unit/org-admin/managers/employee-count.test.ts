/**
 * Manager cards showed "0 employees" because `employee_count` was a stored counter that nothing
 * ever incremented. The count is now derived from the employees' own `manager_id`.
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
vi.mock('../../../../src/functions/org-admin/managers/db.js', async (orig) => ({
  ...(await orig<object>()),
  getCallerLookup: vi.fn(),
  listManagersByOrg: vi.fn(),
  getManagerReverseLookup: vi.fn(),
  updateManager: vi.fn(),
}));
vi.mock('../../../../src/functions/org-admin/employees/db.js', () => ({
  listEmployeesByOrg: vi.fn(),
}));

import * as db from '../../../../src/functions/org-admin/managers/db.js';
import * as employeesDb from '../../../../src/functions/org-admin/employees/db.js';
import {
  listManagers,
  updateManager,
} from '../../../../src/functions/org-admin/managers/service.js';

const manager = (id: string) => ({
  PK: 'ORG#org-1',
  SK: `MANAGER#${id}`,
  manager_id: id,
  first_name: id,
  last_name: 'M',
  employee_count: 0, // the stale stored counter
});
const employee = (id: string, manager_id: string | undefined, status = 'CONFIRMED') => ({
  employee_id: id,
  manager_id,
  status,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1', user_id: 'admin-1' });
  vi.mocked(db.listManagersByOrg).mockResolvedValue([manager('mgr-1'), manager('mgr-2')] as never);
});

describe('listManagers — employee_count', () => {
  it('counts the employees assigned to each manager, ignoring the stored counter', async () => {
    vi.mocked(employeesDb.listEmployeesByOrg).mockResolvedValue([
      employee('e1', 'mgr-1'),
      employee('e2', 'mgr-1'),
      employee('e3', 'mgr-2'),
    ] as never);

    const result = await listManagers('sub', {} as never);

    expect(result.map((m) => [m.manager_id, m.employee_count])).toEqual([
      ['mgr-1', 2],
      ['mgr-2', 1],
    ]);
    expect(result[0]).not.toHaveProperty('PK');
  });

  it('reports 0 for a manager with no employees', async () => {
    vi.mocked(employeesDb.listEmployeesByOrg).mockResolvedValue([employee('e1', 'mgr-1')] as never);
    const result = await listManagers('sub', {} as never);
    expect(result.find((m) => m.manager_id === 'mgr-2')!.employee_count).toBe(0);
  });

  it('does not count disabled or unassigned employees', async () => {
    vi.mocked(employeesDb.listEmployeesByOrg).mockResolvedValue([
      employee('e1', 'mgr-1'),
      employee('e2', 'mgr-1', 'DISABLED'),
      employee('e3', undefined),
    ] as never);
    const result = await listManagers('sub', {} as never);
    expect(result.find((m) => m.manager_id === 'mgr-1')!.employee_count).toBe(1);
  });
});

describe('updateManager — employee_count', () => {
  it('returns the real count, not the stored one', async () => {
    vi.mocked(db.getManagerReverseLookup).mockResolvedValue({ org_id: 'org-1' } as never);
    vi.mocked(db.updateManager).mockResolvedValue(manager('mgr-1') as never);
    vi.mocked(employeesDb.listEmployeesByOrg).mockResolvedValue([
      employee('e1', 'mgr-1'),
      employee('e2', 'mgr-1'),
    ] as never);

    const result = await updateManager('sub', 'mgr-1', { first_name: 'New' }, {} as never);

    expect(result.employee_count).toBe(2);
  });
});
