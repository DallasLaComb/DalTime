import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ForbiddenError } from '../../shared/errors.js';
import { listPendingEmails } from '../../shared/cognito.js';
import { logger } from '../../shared/logger.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';
import type { ShiftNeeded } from '../../shared/models/manager/shift-needed.model.js';
import * as db from './db.js';

/** Draft shifts are counted from the start of this week through this many days ahead. */
export const DRAFT_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;

const dateKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Sunday–Saturday (UTC) containing `today`, plus the end of the drafts look-ahead window. */
export function weekBounds(today: Date): { start: string; end: string; windowEnd: string } {
  const sunday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return {
    start: dateKey(sunday),
    end: dateKey(new Date(sunday.getTime() + 6 * DAY_MS)),
    windowEnd: dateKey(new Date(sunday.getTime() + (DRAFT_WINDOW_DAYS - 1) * DAY_MS)),
  };
}

/**
 * Open employee-slots in the week: what each shift-needed asks for minus what is already
 * assigned to the same date/location/time. Mirrors the scheduler's own "unfilled" maths
 * (drafts count as assigned; open shifts with no employee and `draft_failed` sentinels do not).
 */
export function countUnfilled(
  needed: ShiftNeeded[],
  shifts: Shift[],
  weekStart: string,
  weekEnd: string,
): { slots: number; shiftsNeeded: number } {
  const filled = new Map<string, number>();
  for (const s of shifts) {
    // A slot is filled only by a shift WITH an employee: an open shift (no one assigned) doesn't
    // staff it, and a `draft_failed` sentinel never does.
    if (
      s.status === 'draft_failed' ||
      s.employee_id === '' ||
      s.date < weekStart ||
      s.date > weekEnd
    ) {
      continue;
    }
    const key = `${s.date}|${s.location_id}|${s.start_time}|${s.end_time}`;
    filled.set(key, (filled.get(key) ?? 0) + 1);
  }
  let slots = 0;
  let shiftsNeeded = 0;
  const needKeys = new Set<string>();
  for (const n of needed) {
    if (n.date < weekStart || n.date > weekEnd) continue;
    const key = `${n.date}|${n.location_id}|${n.start_time}|${n.end_time}`;
    needKeys.add(key);
    const gap = Math.max(0, n.employee_count - (filled.get(key) ?? 0));
    if (gap > 0) {
      slots += gap;
      shiftsNeeded += 1;
    }
  }
  // An open shift (no employee) is unfilled work too — the Schedule's "Unfilled" filter shows it.
  // One that matches a shift-needed is already counted through that need's gap.
  for (const s of shifts) {
    if (s.employee_id !== '' || s.status === 'draft_failed') continue;
    if (s.date < weekStart || s.date > weekEnd) continue;
    if (needKeys.has(`${s.date}|${s.location_id}|${s.start_time}|${s.end_time}`)) continue;
    slots += 1;
    shiftsNeeded += 1;
  }
  return { slots, shiftsNeeded };
}

/**
 * Active people who have not set a password yet. Cognito is the truth (one filtered ListUsers);
 * disabled people are never counted. If Cognito can't be reached, fall back to the stored status.
 */
async function countPending(
  people: { email: string; status: string }[],
  cognito: CognitoIdentityProviderClient | undefined,
): Promise<number> {
  if (cognito) {
    try {
      const pending = await listPendingEmails(cognito);
      return people.filter((p) => pending.has(p.email.toLowerCase())).length;
    } catch (err) {
      logger.warn('overview: pending-password lookup failed, using stored status', {
        error_message: (err as Error).message,
      });
    }
  }
  return people.filter((p) => p.status === 'FORCE_CHANGE_PASSWORD').length;
}

export async function getOverview(
  callerSub: string,
  now: Date = new Date(),
  cognito?: CognitoIdentityProviderClient,
) {
  const lookup = await db.getCallerLookup(callerSub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  const { org_id } = lookup;
  const week = weekBounds(now);

  const [managers, employees, locations, openSwaps] = await Promise.all([
    db.listManagersByOrg(org_id),
    db.listEmployeesByOrg(org_id),
    db.listOrgLocations(org_id),
    db.countOpenSwaps(org_id),
  ]);

  const activeManagers = managers.filter((m) => m.status !== 'DISABLED');
  const activeEmployees = employees.filter((e) => e.status !== 'DISABLED');

  // One GSI1 range Query per schedule owner (bounded by the org's manager count). The org admin is
  // not listed as a manager — they oversee the org, and what they schedule is done in "View as
  // Manager" — but their own schedule is real, so it stays in the org totals (and in `own_schedule`)
  // so the Overview agrees with the Schedule.
  const summarize = async (manager_id: string, name: string) => {
    const { shifts, needed } = await db.listManagerWindow(manager_id, week.start, week.windowEnd);
    const unfilled = countUnfilled(needed, shifts, week.start, week.end);
    return {
      manager_id,
      name,
      employees: activeEmployees.filter((e) => e.manager_id === manager_id).length,
      unfilled_slots: unfilled.slots,
      unfilled_shifts: unfilled.shiftsNeeded,
      drafts: shifts.filter((s) => s.status === 'draft').length,
    };
  };

  const [perManager, ownRow] = await Promise.all([
    Promise.all(
      activeManagers.map((m) => summarize(m.manager_id, `${m.first_name} ${m.last_name}`.trim())),
    ),
    summarize(callerSub, ''),
  ]);
  const { manager_id: _id, name: _name, ...own_schedule } = ownRow;
  void _id;
  void _name;
  const everyone = [...perManager, ownRow];

  return {
    week_start: week.start,
    week_end: week.end,
    unfilled_slots: everyone.reduce((t, m) => t + m.unfilled_slots, 0),
    unfilled_shifts: everyone.reduce((t, m) => t + m.unfilled_shifts, 0),
    drafts_to_publish: everyone.reduce((t, m) => t + m.drafts, 0),
    drafts_window_days: DRAFT_WINDOW_DAYS,
    open_swap_requests: openSwaps,
    headcount: {
      employees: activeEmployees.length,
      managers: activeManagers.length,
      locations: locations.length,
      pending_invites: await countPending([...activeEmployees, ...activeManagers], cognito),
      disabled_employees: employees.length - activeEmployees.length,
      disabled_managers: managers.length - activeManagers.length,
      unassigned_employees: activeEmployees.filter((e) => !e.manager_id).length,
    },
    own_schedule,
    managers: perManager.sort(
      (a, b) => b.unfilled_slots - a.unfilled_slots || a.name.localeCompare(b.name),
    ),
  };
}
