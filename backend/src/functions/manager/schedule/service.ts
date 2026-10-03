import { randomUUID } from 'node:crypto';
import { stripKeys } from '../../shared/dynamo.js';
import { listShifts as listShiftsNeeded } from '../../manager/shifts-needed/db.js';
import { listEmployeesByManager } from '../../manager/employees/db.js';
import { logger } from '../../shared/logger.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';
import { deriveShiftType } from '../../shared/shift-type.js';
import type {
  WeeklySchedule,
  DayAvailability,
  DayOfWeek,
  DateOverrides,
} from '../../shared/models/employee/availability.model.js';
import * as db from './db.js';
import { crossesMidnight } from '../../shared/shift-time.js';
import { failedMarkerSortKey, failedMarkerSuffix } from '../../shared/failed-marker.js';

const MAX_DRAFTS = 10;

import { ValidationError, ForbiddenError } from '../../shared/errors.js';
import type { ManagerScheduleDraftsResponse } from '@daltime/contracts';

const DAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function parseMonth(raw: string | undefined): string {
  const m = raw ?? currentMonthString();
  if (!/^\d{4}-\d{2}$/.test(m)) throw new ValidationError('month must be in YYYY-MM format');
  return m;
}

function currentMonthString(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function datesInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function dayOfWeek(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(shiftStart: string, shiftEnd: string, slotFrom: string, slotTo: string): boolean {
  return (
    timeToMinutes(slotFrom) <= timeToMinutes(shiftStart) &&
    timeToMinutes(slotTo) >= timeToMinutes(shiftEnd)
  );
}

function effectiveAvailability(
  date: string,
  weekly: WeeklySchedule | null,
  overrides: DateOverrides | null,
): DayAvailability | null {
  if (overrides?.[date]) return overrides[date];
  if (!weekly) return null;
  return weekly[dayOfWeek(date)] ?? null;
}

function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Whether availability covers a shift. A same-day shift must fit inside one slot. An overnight shift
 * (end earlier than start) spans two days: the start day must be available from the start to the end
 * of the day, and the next day from midnight to the end time (`nextDayAvail`).
 */
function isAvailableForShift(
  avail: DayAvailability | null,
  shiftStart: string,
  shiftEnd: string,
  nextDayAvail: DayAvailability | null = null,
): boolean {
  if (!avail?.available) return false;
  if (!avail.slots?.length) return false;
  if (!crossesMidnight(shiftStart, shiftEnd)) {
    return avail.slots.some((s) => overlaps(shiftStart, shiftEnd, s.from, s.to));
  }
  if (!nextDayAvail?.available || !nextDayAvail.slots?.length) return false;
  const endOfDay = '23:59';
  return (
    avail.slots.some((s) => overlaps(shiftStart, endOfDay, s.from, s.to)) &&
    nextDayAvail.slots.some((s) => overlaps('00:00', shiftEnd, s.from, s.to))
  );
}

/** Count how many days in the month an employee has any availability at all. */
function countAvailableDays(
  monthDates: string[],
  weekly: WeeklySchedule | null,
  overrides: DateOverrides | null,
): number {
  let count = 0;
  for (const date of monthDates) {
    const avail = effectiveAvailability(date, weekly, overrides);
    if (avail?.available && avail.slots?.length) count++;
  }
  return count;
}

interface EmployeeData {
  employee: Employee;
  weekly: WeeklySchedule | null;
  overrides: DateOverrides | null;
  availableDays: number;
}

async function resolveCallerOrg(sub: string) {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

export interface ManagerScope {
  org_id: string;
  manager_id: string;
}

type GenerateResult = {
  created: number;
  unfilled: number;
  draftFailed: number;
  draftCount: number;
  maxDrafts: number;
  /** Slots open before this run; 0 = nothing to fill, so no run was consumed. */
  openSlots: number;
  /** Open shifts (no employee) that exist this month. Generate Draft doesn't fill these — see the contract. */
  openShifts: number;
};

/**
 * Employee-slots that are needed but not yet filled. Existing shifts are tallied per
 * date/location/time block; `draft_failed` sentinels and open (unassigned) shifts don't count as
 * filled (sentinel slots are retried).
 */
/** Shifts on the schedule that have no employee assigned (draft_failed sentinels excluded). */
function countOpenShifts(existingShifts: { status?: string; employee_id?: string }[]): number {
  return existingShifts.filter((s) => s.employee_id === '' && s.status !== 'draft_failed').length;
}

function countOpenSlots(
  shiftsNeeded: {
    date: string;
    location_id: string;
    start_time: string;
    end_time: string;
    employee_count: number;
  }[],
  existingShifts: {
    date: string;
    location_id: string;
    start_time: string;
    end_time: string;
    status?: string;
    employee_id?: string;
  }[],
): { openSlots: number; filledCounts: Map<string, number> } {
  const filledCounts = new Map<string, number>();
  for (const s of existingShifts) {
    // Only a shift with an employee fills a slot; an open shift (no one assigned) doesn't.
    if (s.status === 'draft_failed' || s.employee_id === '') continue;
    const key = `${s.date}|${s.location_id}|${s.start_time}|${s.end_time}`;
    filledCounts.set(key, (filledCounts.get(key) ?? 0) + 1);
  }
  const openSlots = shiftsNeeded.reduce((sum, sn) => {
    const key = `${sn.date}|${sn.location_id}|${sn.start_time}|${sn.end_time}`;
    return sum + Math.max(0, sn.employee_count - (filledCounts.get(key) ?? 0));
  }, 0);
  return { openSlots, filledCounts };
}

/** Manager-scoped entry point: the caller *is* the manager. */
export async function generateDraftSchedule(
  callerSub: string,
  rawMonth: string | undefined,
): Promise<GenerateResult> {
  const month = parseMonth(rawMonth);
  return generateDraftForManager(await resolveCallerOrg(callerSub), month);
}

/**
 * Generates a draft schedule for an explicit manager. Shared by the manager handler
 * (scope = the caller) and the org-admin handler (scope = a manager in the caller's org,
 * verified by the org-admin service before it calls in here).
 */
export async function generateDraftForManager(
  { org_id, manager_id }: ManagerScope,
  month: string,
): Promise<GenerateResult> {
  // Enforce 10-draft limit per manager per month
  const meta = await db.getScheduleMeta(org_id, manager_id, month);
  const currentDraftCount = meta?.draft_count ?? 0;
  if (currentDraftCount >= MAX_DRAFTS) {
    throw new ValidationError(
      `Maximum of ${MAX_DRAFTS} draft generations per month reached for ${month}`,
    );
  }

  const [shiftsNeeded, roster, existingShifts] = await Promise.all([
    listShiftsNeeded(manager_id, month),
    listEmployeesByManager(org_id, manager_id),
    db.listAllShiftsByManager(manager_id, month),
  ]);
  // A disabled employee can't work: never schedule them.
  const employees = roster.filter((e) => e.status !== 'DISABLED');

  // Already-filled slots are tallied so we don't double-assign.
  const { openSlots: totalUnfilled, filledCounts } = countOpenSlots(shiftsNeeded, existingShifts);

  // Nothing open to fill (no shifts needed, or all already filled): there is nothing to run, so
  // don't spend one of the monthly runs.
  if (totalUnfilled === 0) {
    return {
      created: 0,
      unfilled: 0,
      draftFailed: 0,
      draftCount: currentDraftCount,
      maxDrafts: MAX_DRAFTS,
      openSlots: 0,
      openShifts: countOpenShifts(existingShifts),
    };
  }

  // No active employees at all is just the extreme case of "nobody available": it falls through to
  // the normal pass below, which leaves a draft_failed marker on every slot it couldn't fill (so the
  // schedule can word those slots "Unfilled — no employee available" rather than "Not yet scheduled").

  // Load availability for every employee in parallel
  const monthDates = datesInMonth(month);
  const employeeData: EmployeeData[] = await Promise.all(
    employees.map(async (emp) => {
      const [availRecord, overridesRecord] = await Promise.all([
        db.getEmployeeAvailability(emp.employee_id),
        db.getEmployeeAvailabilityOverrides(emp.employee_id),
      ]);
      const weekly = (availRecord?.['schedule'] as WeeklySchedule) ?? null;
      const overrides = (overridesRecord?.['overrides'] as DateOverrides) ?? null;
      return {
        employee: emp,
        weekly,
        overrides,
        availableDays: countAvailableDays(monthDates, weekly, overrides),
      };
    }),
  );

  // Sort ascending by available days — most constrained first
  employeeData.sort((a, b) => a.availableDays - b.availableDays);

  // Sort shifts by date then start_time
  const sortedShifts = [...shiftsNeeded].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
  });

  // Track per-day assignment counts this run (in addition to existing shifts)
  const dailyCount = new Map<string, Map<string, number>>();
  const getDaily = (empId: string, date: string) => dailyCount.get(empId)?.get(date) ?? 0;
  const incDaily = (empId: string, date: string) => {
    if (!dailyCount.has(empId)) dailyCount.set(empId, new Map());
    dailyCount.get(empId)!.set(date, getDaily(empId, date) + 1);
  };

  const now = new Date().toISOString();
  let created = 0;
  let unfilled = 0;
  let draftFailed = 0;
  /** Slots this run couldn't fill (by marker suffix). */
  const failedThisRun = new Set<string>();

  for (const needed of sortedShifts) {
    const slotKey = `${needed.date}|${needed.location_id}|${needed.start_time}|${needed.end_time}`;
    const alreadyFilled = filledCounts.get(slotKey) ?? 0;
    const remaining = Math.max(0, needed.employee_count - alreadyFilled);

    for (let slot = 0; slot < remaining; slot++) {
      const candidate = employeeData.find((ed) => {
        const avail = effectiveAvailability(needed.date, ed.weekly, ed.overrides);
        const nextAvail = crossesMidnight(needed.start_time, needed.end_time)
          ? effectiveAvailability(nextDate(needed.date), ed.weekly, ed.overrides)
          : null;
        if (!isAvailableForShift(avail, needed.start_time, needed.end_time, nextAvail)) {
          return false;
        }
        const maxShifts = avail?.max_shifts ?? 1;
        return getDaily(ed.employee.employee_id, needed.date) < maxShifts;
      });

      if (!candidate) {
        // No eligible employee found for this slot.
        // Write a deterministic sentinel record so the manager can see unfillable slots
        // in the UI filtered by "Draft Failed". Using a deterministic SK guarantees
        // idempotency: re-running the generator overwrites (PutItem) the same item
        // rather than accumulating duplicates.
        const failedSuffix = failedMarkerSuffix({ ...needed, manager_id });
        failedThisRun.add(failedSuffix);
        const sentinelShiftId = `FAILED#${failedSuffix}`;
        const sentinel: Shift = {
          PK: `ORG#${org_id}`,
          SK: failedMarkerSortKey({ ...needed, manager_id }),
          GSI1PK: `MANAGER#${manager_id}`,
          GSI1SK: needed.date,
          shift_id: sentinelShiftId,
          org_id,
          manager_id,
          employee_id: '',
          employee_name: '',
          location_id: needed.location_id,
          location_name: needed.location_name,
          date: needed.date,
          start_time: needed.start_time,
          end_time: needed.end_time,
          type: deriveShiftType(needed.start_time),
          status: 'draft_failed',
          created_at: now,
          updated_at: now,
        };
        await db.createShift(sentinel);
        unfilled++;
        draftFailed++;
        continue;
      }

      incDaily(candidate.employee.employee_id, needed.date);
      filledCounts.set(slotKey, (filledCounts.get(slotKey) ?? 0) + 1);

      const shiftId = randomUUID();
      const shift: Shift = {
        PK: `ORG#${org_id}`,
        SK: `SHIFT#${shiftId}`,
        GSI1PK: `MANAGER#${manager_id}`,
        GSI1SK: needed.date,
        shift_id: shiftId,
        org_id,
        manager_id,
        employee_id: candidate.employee.employee_id,
        employee_name: `${candidate.employee.first_name} ${candidate.employee.last_name}`,
        location_id: needed.location_id,
        location_name: needed.location_name,
        date: needed.date,
        start_time: needed.start_time,
        end_time: needed.end_time,
        type: deriveShiftType(needed.start_time),
        status: 'draft',
        created_at: now,
        updated_at: now,
      };

      await db.createShift(shift);
      created++;
    }
  }

  // A marker only means something while its slot is still unfilled. Clear the ones this run no longer
  // needed: the slot got filled (by this run or by hand), or its need was deleted.
  for (const s of existingShifts) {
    if (s.status !== 'draft_failed') continue;
    if (!failedThisRun.has(failedMarkerSuffix(s))) await db.clearFailedMarker(org_id, s);
  }

  const newDraftCount = currentDraftCount + 1;
  await db.upsertScheduleMeta(org_id, manager_id, month, newDraftCount, now);

  logger.info('draft schedule generated', {
    org_id,
    manager_id,
    month,
    created,
    unfilled,
    draft_count: newDraftCount,
  });
  return {
    created,
    unfilled,
    draftFailed,
    draftCount: newDraftCount,
    maxDrafts: MAX_DRAFTS,
    openSlots: totalUnfilled,
    openShifts: countOpenShifts(existingShifts),
  };
}

export async function publishSchedule(
  callerSub: string,
  rawMonth: string | undefined,
): Promise<{ published: number }> {
  const month = parseMonth(rawMonth);
  return publishForManager(await resolveCallerOrg(callerSub), month);
}

export async function publishForManager(
  { org_id, manager_id }: ManagerScope,
  month: string,
): Promise<{ published: number }> {
  const drafts = await db.listDraftShiftsByManager(manager_id, month);
  if (drafts.length === 0) return { published: 0 };

  const now = new Date().toISOString();
  await Promise.all(drafts.map((s) => db.publishShift(org_id, s.shift_id, now)));
  logger.info('schedule published', { org_id, manager_id, month, published: drafts.length });

  return { published: drafts.length };
}

export async function getScheduleMetaForCaller(
  callerSub: string,
  rawMonth: string | undefined,
): Promise<{ draftCount: number; maxDrafts: number; openSlots: number; openShifts: number }> {
  const month = parseMonth(rawMonth);
  return getScheduleMetaForManager(await resolveCallerOrg(callerSub), month);
}

export async function getScheduleMetaForManager(
  { org_id, manager_id }: ManagerScope,
  month: string,
): Promise<{ draftCount: number; maxDrafts: number; openSlots: number; openShifts: number }> {
  const [meta, shiftsNeeded, existingShifts] = await Promise.all([
    db.getScheduleMeta(org_id, manager_id, month),
    listShiftsNeeded(manager_id, month),
    db.listAllShiftsByManager(manager_id, month),
  ]);
  return {
    draftCount: meta?.draft_count ?? 0,
    maxDrafts: MAX_DRAFTS,
    openSlots: countOpenSlots(shiftsNeeded, existingShifts).openSlots,
    openShifts: countOpenShifts(existingShifts),
  };
}

export async function getDraftSummary(
  callerSub: string,
  rawMonth: string | undefined,
): Promise<ManagerScheduleDraftsResponse> {
  const month = parseMonth(rawMonth);
  return getDraftSummaryForManager(await resolveCallerOrg(callerSub), month);
}

export async function getDraftSummaryForManager(
  { manager_id }: ManagerScope,
  month: string,
): Promise<ManagerScheduleDraftsResponse> {
  const drafts = await db.listDraftShiftsByManager(manager_id, month);
  return { drafts: drafts.map((s) => stripKeys(s)) };
}
