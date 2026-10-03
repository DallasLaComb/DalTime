import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/functions/org-admin/overview/db.js', () => ({
  getCallerLookup: vi.fn(),
  listManagersByOrg: vi.fn(),
  listEmployeesByOrg: vi.fn(),
  listOrgLocations: vi.fn(),
  listManagerWindow: vi.fn(),
  countOpenSwaps: vi.fn(),
}));

import * as db from '../../../../src/functions/org-admin/overview/db.js';
import * as cognito from '../../../../src/functions/shared/cognito.js';
import {
  getOverview,
  weekBounds,
  countUnfilled,
} from '../../../../src/functions/org-admin/overview/service.js';
import { ForbiddenError } from '../../../../src/functions/shared/errors.js';

// Wednesday 2026-07-08 → week Sun 2026-07-05 … Sat 2026-07-11.
const NOW = new Date('2026-07-08T15:00:00Z');

const need = (date: string, count: number, loc = 'l1', s = '09:00', e = '17:00') =>
  ({ date, employee_count: count, location_id: loc, start_time: s, end_time: e }) as never;
const shift = (date: string, status = 'published', loc = 'l1', s = '09:00', e = '17:00') =>
  ({ date, status, location_id: loc, start_time: s, end_time: e }) as never;

vi.mock('../../../../src/functions/shared/cognito.js', () => ({ listPendingEmails: vi.fn() }));

describe('weekBounds', () => {
  it('returns the Sunday–Saturday week containing the date', () => {
    expect(weekBounds(NOW)).toMatchObject({ start: '2026-07-05', end: '2026-07-11' });
  });

  it('treats a Sunday as the start and a Saturday as the end of its own week', () => {
    expect(weekBounds(new Date('2026-07-05T00:00:00Z')).start).toBe('2026-07-05');
    expect(weekBounds(new Date('2026-07-11T23:59:00Z')).start).toBe('2026-07-05');
  });

  it('crosses month and year boundaries', () => {
    expect(weekBounds(new Date('2026-01-01T12:00:00Z'))).toMatchObject({
      start: '2025-12-28',
      end: '2026-01-03',
    });
  });
});

describe('countUnfilled', () => {
  const W = ['2026-07-05', '2026-07-11'] as const;

  it('counts needed minus assigned for the same date/location/time', () => {
    const r = countUnfilled(
      [need('2026-07-06', 3)],
      [shift('2026-07-06'), shift('2026-07-06')],
      ...W,
    );
    expect(r).toEqual({ slots: 1, shiftsNeeded: 1 });
  });

  it('counts drafts as assigned but not draft_failed sentinels', () => {
    const r = countUnfilled(
      [need('2026-07-06', 2)],
      [shift('2026-07-06', 'draft'), shift('2026-07-06', 'draft_failed')],
      ...W,
    );
    expect(r.slots).toBe(1);
  });

  it('does not count an open shift (no employee) as filling a slot — only an assigned shift does', () => {
    const open = { ...(shift('2026-07-06') as object), employee_id: '' } as never;
    const assigned = { ...(shift('2026-07-06') as object), employee_id: 'e1' } as never;
    expect(countUnfilled([need('2026-07-06', 2)], [open, assigned], ...W)).toEqual({
      slots: 1,
      shiftsNeeded: 1,
    });
    expect(countUnfilled([need('2026-07-06', 1)], [open], ...W)).toEqual({
      slots: 1,
      shiftsNeeded: 1,
    });
  });

  it('counts an open shift (no employee) as unfilled even when no shift-needed exists', () => {
    const open = (date: string) => ({ ...(shift(date) as object), employee_id: '' }) as never;
    expect(countUnfilled([], [open('2026-07-06'), open('2026-07-07')], ...W)).toEqual({
      slots: 2,
      shiftsNeeded: 2,
    });
  });

  it('does not count an open shift twice when it matches a shift-needed (the need already counts it)', () => {
    const open = { ...(shift('2026-07-06') as object), employee_id: '' } as never;
    expect(countUnfilled([need('2026-07-06', 1)], [open], ...W)).toEqual({
      slots: 1,
      shiftsNeeded: 1,
    });
  });

  it('ignores draft_failed sentinels and open shifts outside the week', () => {
    const sentinel = {
      ...(shift('2026-07-06', 'draft_failed') as object),
      employee_id: '',
    } as never;
    const later = { ...(shift('2026-07-20') as object), employee_id: '' } as never;
    expect(countUnfilled([], [sentinel, later], ...W)).toEqual({ slots: 0, shiftsNeeded: 0 });
  });

  it('reports nothing for a fully staffed or over-staffed slot', () => {
    const r = countUnfilled(
      [need('2026-07-06', 1)],
      [shift('2026-07-06'), shift('2026-07-06')],
      ...W,
    );
    expect(r).toEqual({ slots: 0, shiftsNeeded: 0 });
  });

  it('does not match shifts at a different location or time', () => {
    const r = countUnfilled(
      [need('2026-07-06', 1)],
      [shift('2026-07-06', 'published', 'l2')],
      ...W,
    );
    expect(r.slots).toBe(1);
  });

  it('ignores needs and shifts outside the week', () => {
    const r = countUnfilled([need('2026-07-12', 4), need('2026-07-04', 4)], [], ...W);
    expect(r).toEqual({ slots: 0, shiftsNeeded: 0 });
  });
});

describe('getOverview', () => {
  const mgr = (id: string, first: string, status = 'CONFIRMED') => ({
    manager_id: id,
    first_name: first,
    last_name: 'M',
    status,
  });
  const emp = (id: string, manager_id: string | undefined, status = 'CONFIRMED') => ({
    employee_id: id,
    manager_id,
    status,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1' });
    vi.mocked(db.listManagersByOrg).mockResolvedValue([
      mgr('m1', 'Ann'),
      mgr('m2', 'Bob'),
      mgr('m3', 'Gone', 'DISABLED'),
    ] as never);
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([
      emp('e1', 'm1'),
      emp('e2', 'm1'),
      emp('e3', 'm2', 'FORCE_CHANGE_PASSWORD'),
      emp('e4', undefined),
      emp('e5', 'm1', 'DISABLED'),
    ] as never);
    vi.mocked(db.listOrgLocations).mockResolvedValue([{}, {}] as never);
    vi.mocked(db.countOpenSwaps).mockResolvedValue(4);
    vi.mocked(db.listManagerWindow).mockImplementation(async (id) => {
      if (id === 'm1')
        return {
          needed: [need('2026-07-06', 3)],
          shifts: [shift('2026-07-06'), shift('2026-07-20', 'draft')],
        };
      if (id === 'm2')
        return { needed: [], shifts: [shift('2026-07-07', 'draft'), shift('2026-07-08', 'draft')] };
      return { needed: [], shifts: [] };
    });
  });

  it('rolls up unfilled slots, drafts, swap requests and headcount for the org', async () => {
    const o = await getOverview('sub', NOW);

    expect(o).toMatchObject({
      week_start: '2026-07-05',
      week_end: '2026-07-11',
      unfilled_slots: 2,
      unfilled_shifts: 1,
      drafts_to_publish: 3,
      drafts_window_days: 60,
      open_swap_requests: 4,
      headcount: {
        employees: 4,
        managers: 2,
        locations: 2,
        pending_invites: 1,
        disabled_employees: 1,
        disabled_managers: 1,
        unassigned_employees: 1,
      },
    });
  });

  it('breaks the numbers down per active manager, most unfilled first', async () => {
    const o = await getOverview('sub', NOW);
    expect(o.managers).toEqual([
      {
        manager_id: 'm1',
        name: 'Ann M',
        employees: 2,
        unfilled_slots: 2,
        unfilled_shifts: 1,
        drafts: 1,
      },
      {
        manager_id: 'm2',
        name: 'Bob M',
        employees: 1,
        unfilled_slots: 0,
        unfilled_shifts: 0,
        drafts: 2,
      },
    ]);
    // the disabled manager is neither counted nor queried; the admin's own window is read for the totals
    expect(db.listManagerWindow).toHaveBeenCalledTimes(3);
    expect(db.listManagerWindow).toHaveBeenCalledWith('m1', '2026-07-05', '2026-09-02');
  });

  it('does not list the OrgAdmin as a manager, but keeps their own schedule in the totals', async () => {
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([
      emp('e1', 'm1'),
      emp('e6', 'sub'),
      emp('e7', 'sub'),
    ] as never);
    vi.mocked(db.listManagerWindow).mockImplementation(async (id) =>
      id === 'sub'
        ? { needed: [need('2026-07-06', 2)], shifts: [shift('2026-07-07', 'draft')] }
        : { needed: [], shifts: [] },
    );

    const o = await getOverview('sub', NOW);

    // no admin row in the by-manager list...
    expect(o.managers.map((m) => m.manager_id)).not.toContain('sub');
    // ...but what they own is reported, and rolls into the org totals so Overview matches Schedule
    expect(o.own_schedule).toEqual({
      employees: 2,
      unfilled_slots: 2,
      unfilled_shifts: 1,
      drafts: 1,
    });
    expect(o.unfilled_slots).toBe(2);
    expect(o.drafts_to_publish).toBe(1);
    expect(o.headcount.unassigned_employees).toBe(0);
  });

  it('reports an empty own_schedule when the admin schedules nothing', async () => {
    const o = await getOverview('sub', NOW);
    expect(o.own_schedule).toEqual({
      employees: 0,
      unfilled_slots: 0,
      unfilled_shifts: 0,
      drafts: 0,
    });
  });

  it('returns zeros for an org with nothing in it', async () => {
    vi.mocked(db.listManagersByOrg).mockResolvedValue([]);
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([]);
    vi.mocked(db.listOrgLocations).mockResolvedValue([]);
    vi.mocked(db.countOpenSwaps).mockResolvedValue(0);

    const o = await getOverview('sub', NOW);

    expect(o).toMatchObject({
      unfilled_slots: 0,
      drafts_to_publish: 0,
      open_swap_requests: 0,
      managers: [],
    });
    expect(o.headcount.employees).toBe(0);
  });

  it('refuses when the caller’s org cannot be resolved', async () => {
    vi.mocked(db.getCallerLookup).mockResolvedValue(null);
    await expect(getOverview('sub', NOW)).rejects.toBeInstanceOf(ForbiddenError);
    expect(db.listManagersByOrg).not.toHaveBeenCalled();
  });
});

describe('getOverview — "have not set a password" comes from Cognito', () => {
  const person = (id: string, status: string, email: string) =>
    ({ employee_id: id, manager_id: 'm1', status, email }) as never;
  const client = {} as never;

  beforeEach(() => {
    vi.mocked(db.getCallerLookup).mockResolvedValue({ org_id: 'org-1' } as never);
    vi.mocked(db.listManagersByOrg).mockResolvedValue([] as never);
    vi.mocked(db.listOrgLocations).mockResolvedValue([] as never);
    vi.mocked(db.countOpenSwaps).mockResolvedValue(0);
    vi.mocked(db.listManagerWindow).mockResolvedValue({ needed: [], shifts: [] });
  });

  it('counts the active people Cognito says have no password, regardless of the stored status', async () => {
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([
      person('e1', 'CONFIRMED', 'Pending@x.com'), // stale stored status, still pending in Cognito
      person('e2', 'FORCE_CHANGE_PASSWORD', 'done@x.com'), // stale the other way: set a password since
      person('e3', 'CONFIRMED', 'ok@x.com'),
    ]);
    vi.mocked(cognito.listPendingEmails).mockResolvedValue(new Set(['pending@x.com']));

    const o = await getOverview('sub', NOW, client);

    expect(o.headcount.pending_invites).toBe(1);
  });

  it('never counts a disabled person, even if Cognito still lists them as pending', async () => {
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([
      person('e1', 'DISABLED', 'off@x.com'),
      person('e2', 'CONFIRMED', 'on@x.com'),
    ]);
    vi.mocked(cognito.listPendingEmails).mockResolvedValue(new Set(['off@x.com', 'on@x.com']));

    const o = await getOverview('sub', NOW, client);

    expect(o.headcount.pending_invites).toBe(1);
    expect(o.headcount.employees).toBe(1);
    expect(o.headcount.disabled_employees).toBe(1);
  });

  it('falls back to the stored status when Cognito can’t be reached', async () => {
    vi.mocked(db.listEmployeesByOrg).mockResolvedValue([
      person('e1', 'FORCE_CHANGE_PASSWORD', 'a@x.com'),
      person('e2', 'CONFIRMED', 'b@x.com'),
    ]);
    vi.mocked(cognito.listPendingEmails).mockRejectedValue(new Error('throttled'));

    const o = await getOverview('sub', NOW, client);

    expect(o.headcount.pending_invites).toBe(1);
  });
});
