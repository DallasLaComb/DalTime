import { isValidShiftSpan } from '../../shared/shift-time.js';
import { randomUUID } from 'node:crypto';
import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';
import { deriveShiftType } from '../../shared/shift-type.js';

import { ValidationError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

async function resolveCallerOrg(sub: string): Promise<{ org_id: string; manager_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

function parseMonth(raw: string | undefined): string {
  const month = raw ?? currentMonthString();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError('month must be in YYYY-MM format');
  return month;
}

function currentMonthString(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('date must be in YYYY-MM-DD format');
  }
}

function validateTime(time: string, field: string): void {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new ValidationError(`${field} must be in HH:MM format`);
  }
}

export async function listShifts(callerSub: string, rawMonth: string | undefined) {
  const month = parseMonth(rawMonth);
  const { manager_id } = await resolveCallerOrg(callerSub);
  const shifts = await db.listShiftsByManager(manager_id, month);
  return shifts
    .map((s) => stripKeys(s))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
    });
}

type ShiftCreateBody = {
  /** Omit (or leave empty) to post an open shift with no employee yet. */
  employee_id?: string;
  /** Org-admin only: the manager an open shift belongs to (an assigned shift follows its employee). */
  manager_id?: string;
  location_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
};

type ValidShiftCreateBody = Required<Omit<ShiftCreateBody, 'employee_id' | 'manager_id'>> &
  Pick<ShiftCreateBody, 'employee_id' | 'manager_id'>;

/**
 * Who a shift operation is scoped to. A manager is pinned to their own team
 * (`manager_id` set); an org-admin passes `manager_id: null` and may touch any
 * manager's shifts within their own org (the org is always the DynamoDB partition,
 * so nothing outside `org_id` is reachable).
 */
export interface ShiftScope {
  org_id: string;
  manager_id: string | null;
}

export function validateShiftCreateBody(
  body: ShiftCreateBody,
): asserts body is ValidShiftCreateBody {
  if (!body.location_id) throw new ValidationError('location_id is required');
  if (!body.date) throw new ValidationError('date is required');
  if (!body.start_time) throw new ValidationError('start_time is required');
  if (!body.end_time) throw new ValidationError('end_time is required');

  validateDate(body.date);
  validateTime(body.start_time, 'start_time');
  validateTime(body.end_time, 'end_time');
  if (!isValidShiftSpan(body.start_time, body.end_time)) {
    throw new ValidationError(
      'end_time must differ from start_time (an end_time earlier than start_time means the next day)',
    );
  }
}

export async function createShift(callerSub: string, body: ShiftCreateBody) {
  validateShiftCreateBody(body);
  const { org_id, manager_id } = await resolveCallerOrg(callerSub);
  return createShiftInScope({ org_id, manager_id }, body);
}

/** Create a published shift. `body` must already be validated by `validateShiftCreateBody`. */
export async function createShiftInScope(scope: ShiftScope, body: ValidShiftCreateBody) {
  const { org_id } = scope;

  let manager_id: string;
  let employee_id = '';
  let employee_name = '';

  if (body.employee_id) {
    const employee = await db.getEmployee(org_id, body.employee_id);
    if (scope.manager_id !== null && employee?.manager_id !== scope.manager_id) {
      throw new ForbiddenError('Employee not found in your team');
    }
    if (!employee) throw new ForbiddenError('Employee not found in your organization');
    // An assigned shift belongs to the manager the employee reports to.
    manager_id = employee.manager_id;
    if (scope.manager_id === null && body.manager_id && body.manager_id !== manager_id) {
      throw new ValidationError('Employee does not report to the selected manager');
    }
    employee_id = body.employee_id;
    employee_name = `${employee.first_name} ${employee.last_name}`;
  } else {
    // Open shift: no employee yet. A manager's is their own; an org-admin must say whose.
    const owner = scope.manager_id ?? body.manager_id;
    if (!owner) throw new ValidationError('manager_id is required for an open shift');
    manager_id = owner;
  }

  const shiftId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `ORG#${org_id}`,
    SK: `SHIFT#${shiftId}`,
    GSI1PK: `MANAGER#${manager_id}`,
    GSI1SK: body.date,
    shift_id: shiftId,
    org_id,
    manager_id,
    employee_id,
    employee_name,
    location_id: body.location_id,
    location_name: '',
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
    type: deriveShiftType(body.start_time),
    status: 'published' as const,
    created_at: now,
    updated_at: now,
  };

  await db.createShift(item);
  // A shift with an employee fills the slot: clear its "tried, nobody available" mark.
  if (employee_id) await db.clearFailedMarker(org_id, item);
  logger.info('shift created', { org_id, shift_id: shiftId, manager_id, open: !employee_id });
  return stripKeys(item);
}

type ShiftUpdateBody = {
  employee_id?: string;
  location_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
};

export function validateShiftUpdateBody(body: ShiftUpdateBody): void {
  if (Object.keys(body).length === 0) throw new ValidationError('At least one field is required');
  if (body.date !== undefined) validateDate(body.date);
  if (body.start_time !== undefined) validateTime(body.start_time, 'start_time');
  if (body.end_time !== undefined) validateTime(body.end_time, 'end_time');
  if (
    body.start_time !== undefined &&
    body.end_time !== undefined &&
    !isValidShiftSpan(body.start_time, body.end_time)
  ) {
    throw new ValidationError(
      'end_time must differ from start_time (an end_time earlier than start_time means the next day)',
    );
  }
}

export async function updateShift(callerSub: string, shiftId: string, body: ShiftUpdateBody) {
  validateShiftUpdateBody(body);
  const { org_id, manager_id } = await resolveCallerOrg(callerSub);
  return updateShiftInScope({ org_id, manager_id }, shiftId, body);
}

/** Update a shift. `body` must already be validated by `validateShiftUpdateBody`. */
export async function updateShiftInScope(
  scope: ShiftScope,
  shiftId: string,
  body: ShiftUpdateBody,
) {
  const { org_id } = scope;

  const existing = await db.getShift(org_id, shiftId);
  if (!existing) throw new NotFoundError('Shift not found');
  if (scope.manager_id !== null && existing.manager_id !== scope.manager_id) {
    throw new ForbiddenError('You do not own this shift');
  }

  const fields: Parameters<typeof db.updateShift>[2] = {};
  // The type always follows the start time (heals shifts whose stored type had drifted).
  fields.type = deriveShiftType(body.start_time ?? existing.start_time);
  if (body.date !== undefined) fields.date = body.date;
  if (body.start_time !== undefined) fields.start_time = body.start_time;
  if (body.end_time !== undefined) fields.end_time = body.end_time;

  if (body.employee_id === '') {
    // Un-assign: the shift stays on the schedule as an open shift under the same manager.
    fields.employee_id = '';
    fields.employee_name = '';
  } else if (body.employee_id !== undefined) {
    const employee = await db.getEmployee(org_id, body.employee_id);
    if (scope.manager_id !== null && employee?.manager_id !== scope.manager_id) {
      throw new ForbiddenError('Employee not found in your team');
    }
    if (!employee) throw new ForbiddenError('Employee not found in your organization');
    fields.employee_id = body.employee_id;
    fields.employee_name = `${employee.first_name} ${employee.last_name}`;
    // Re-assigning across teams moves the shift to the new employee's manager.
    if (employee.manager_id !== existing.manager_id) fields.manager_id = employee.manager_id;
  }

  if (body.location_id !== undefined) {
    fields.location_id = body.location_id;
  }

  const updated = await db.updateShift(org_id, shiftId, fields, new Date().toISOString());
  if (!updated) throw new NotFoundError('Shift not found');
  // Filling a slot clears its "tried, nobody available" mark (the next run re-marks what is still open).
  if (updated.employee_id) await db.clearFailedMarker(org_id, updated);
  logger.info('shift updated', { org_id, shift_id: shiftId });
  return stripKeys(updated);
}

export async function removeShift(callerSub: string, shiftId: string) {
  const { org_id, manager_id } = await resolveCallerOrg(callerSub);
  return removeShiftInScope({ org_id, manager_id }, shiftId);
}

export async function removeShiftInScope(scope: ShiftScope, shiftId: string) {
  const { org_id } = scope;
  const existing = await db.getShift(org_id, shiftId);
  if (!existing) throw new NotFoundError('Shift not found');
  if (scope.manager_id !== null && existing.manager_id !== scope.manager_id) {
    throw new ForbiddenError('You do not own this shift');
  }
  await db.deleteShift(org_id, shiftId);
  logger.info('shift removed', { org_id, shift_id: shiftId });
}
