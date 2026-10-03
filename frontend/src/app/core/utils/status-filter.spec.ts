import {
  countByStatus,
  filterByStatus,
  parseStatusFilter,
  statusOf,
  isStatusFilter,
} from './status-filter';

const people = [
  { id: 1, status: 'CONFIRMED' },
  { id: 2, status: 'CONFIRMED' },
  { id: 3, status: 'DISABLED' },
  { id: 4, status: 'FORCE_CHANGE_PASSWORD' },
  { id: 5, status: 'DISABLED' },
];

describe('status filter', () => {
  it('maps Cognito statuses the way the badge does: Active / Disabled / Pending', () => {
    expect(statusOf('CONFIRMED')).toBe('active');
    expect(statusOf('DISABLED')).toBe('disabled');
    expect(statusOf('FORCE_CHANGE_PASSWORD')).toBe('pending'); // hasn't set a password yet
    expect(statusOf('RESET_REQUIRED')).toBe('pending');
  });

  it('counts every option, with All as the total', () => {
    expect(countByStatus(people)).toEqual({ all: 5, active: 2, disabled: 2, pending: 1 });
    expect(countByStatus([])).toEqual({ all: 0, active: 0, disabled: 0, pending: 0 });
  });

  it('All keeps everyone — disabled people stay visible by default', () => {
    expect(filterByStatus(people, 'all')).toHaveLength(5);
  });

  it.each([
    ['active', [1, 2]],
    ['disabled', [3, 5]],
    ['pending', [4]],
  ] as const)('filters to %s', (filter, ids) => {
    expect(filterByStatus(people, filter).map((p) => p.id)).toEqual(ids);
  });

  it('Pending never includes a disabled person', () => {
    expect(filterByStatus(people, 'pending').some((p) => p.status === 'DISABLED')).toBe(false);
  });

  it('parses ?status= and falls back to All for anything unknown', () => {
    expect(parseStatusFilter('disabled')).toBe('disabled');
    expect(parseStatusFilter('PENDING')).toBe('pending');
    expect(parseStatusFilter('bogus')).toBe('all');
    expect(parseStatusFilter(null)).toBe('all');
    expect(parseStatusFilter(undefined)).toBe('all');
  });

  it('isStatusFilter tells a recognised value from junk', () => {
    expect(isStatusFilter('disabled')).toBe(true);
    expect(isStatusFilter('PENDING')).toBe(true);
    expect(isStatusFilter('all')).toBe(true);
    expect(isStatusFilter('bogus')).toBe(false);
    expect(isStatusFilter('')).toBe(false);
    expect(isStatusFilter(null)).toBe(false);
  });
});
