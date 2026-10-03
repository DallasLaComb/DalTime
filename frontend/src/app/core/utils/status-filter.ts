/**
 * Status filter for the Employees and Managers pages: All / Active / Disabled / Pending.
 * "Pending" means the person hasn't set a password yet. The selection lives in the URL
 * (`?status=disabled`) so it survives a reload and can be linked to.
 */
export type StatusFilter = 'all' | 'active' | 'disabled' | 'pending';
export type PersonStatus = Exclude<StatusFilter, 'all'>;

export const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'active', 'disabled', 'pending'];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  disabled: 'Disabled',
  pending: 'Pending',
};

/** Same mapping as the status badge: CONFIRMED = Active, DISABLED = Disabled, anything else = Pending. */
export function statusOf(status: string): PersonStatus {
  if (status === 'DISABLED') return 'disabled';
  if (status === 'CONFIRMED') return 'active';
  return 'pending';
}

export type StatusCounts = Record<StatusFilter, number>;

export function countByStatus(people: { status: string }[]): StatusCounts {
  const counts: StatusCounts = { all: people.length, active: 0, disabled: 0, pending: 0 };
  for (const p of people) counts[statusOf(p.status)] += 1;
  return counts;
}

export function filterByStatus<T extends { status: string }>(
  people: T[],
  filter: StatusFilter,
): T[] {
  return filter === 'all' ? people : people.filter((p) => statusOf(p.status) === filter);
}

/** True when `raw` is one of the four filter values (case-insensitive). */
export function isStatusFilter(raw: string | null | undefined): boolean {
  return (STATUS_FILTERS as readonly string[]).includes((raw ?? '').toLowerCase());
}

/** An unknown or missing `?status=` value falls back to All. */
export function parseStatusFilter(raw: string | null | undefined): StatusFilter {
  const v = (raw ?? '').toLowerCase();
  return (STATUS_FILTERS as readonly string[]).includes(v) ? (v as StatusFilter) : 'all';
}
