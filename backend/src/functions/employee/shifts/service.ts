import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

import { ForbiddenError, ValidationError } from '../../shared/errors.js';

/**
 * Resolve the caller's org_id and employee_id from their Cognito sub by
 * fetching the USER#<sub>/METADATA reverse-lookup record. Throws ForbiddenError
 * if the record is missing — a valid JWT with no provisioned record should not
 * reach DynamoDB data.
 */
async function resolveCallerEmployee(
  sub: string,
): Promise<{ org_id: string; employee_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller could not be resolved');
  return lookup;
}

/**
 * Parse and validate a YYYY-MM month string.
 * Returns the validated month value. Throws ValidationError if the format is wrong.
 */
function parseMonth(raw: string): string {
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new ValidationError('month must be in YYYY-MM format');
  }
  return raw;
}

/**
 * Parse and validate a YYYY-MM-DD date string.
 * Returns the validated date value. Throws ValidationError if the format is wrong
 * or if the value is not a real calendar date.
 *
 * We validate the calendar date by re-serialising the parsed UTC date back to
 * YYYY-MM-DD and checking it round-trips: if the day was out of range (e.g.
 * 2026-13-99) JavaScript's Date wraps it into a different month, so the
 * serialised value will differ from the input string and we can reject it.
 */
function parseDate(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError('date must be in YYYY-MM-DD format');
  }
  // Round-trip check: if the date is entirely invalid (e.g. month 13) the
  // Date constructor returns NaN. If the day overflows (e.g. Feb 30) JavaScript
  // wraps it into the next month, so the serialised form will differ from the
  // input string. Both cases are rejected.
  const d = new Date(raw + 'T00:00:00Z');
  if (isNaN(d.getTime())) {
    throw new ValidationError('date value is not a valid calendar date');
  }
  const roundTripped = d.toISOString().slice(0, 10);
  if (roundTripped !== raw) {
    throw new ValidationError('date value is not a valid calendar date');
  }
  return raw;
}

/**
 * Parse and validate a YYYY-MM-DD week-start date string.
 * Computes the week-end date as weekStart + 6 days (inclusive 7-day window).
 * Week start is treated as ISO Monday but any valid date is accepted — the
 * caller supplies the window start and we always return exactly 7 days.
 * Throws ValidationError if the format is wrong.
 */
function parseWeek(raw: string): { weekStart: string; weekEnd: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError('week must be in YYYY-MM-DD format (the Monday of the desired week)');
  }
  // Compute weekEnd by adding 6 days to the parsed date.
  const start = new Date(raw + 'T00:00:00Z');
  if (isNaN(start.getTime())) {
    throw new ValidationError('week value is not a valid date');
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  return { weekStart: raw, weekEnd };
}

/**
 * List shifts for the calling employee, scoped to a time window defined by
 * exactly one of: ?month=YYYY-MM, ?date=YYYY-MM-DD, or ?week=YYYY-MM-DD.
 *
 * Exactly one of the three params must be present. Returns a 400 ValidationError
 * if none are supplied or if the supplied value is in the wrong format.
 *
 * Results are sorted by date ascending, then start_time ascending.
 */
export async function listMyShifts(
  callerSub: string,
  params: { month?: string; date?: string; week?: string },
) {
  const { month: rawMonth, date: rawDate, week: rawWeek } = params;

  // Validate that exactly one param is provided.
  const supplied = [rawMonth, rawDate, rawWeek].filter((v) => v !== undefined);
  if (supplied.length === 0) {
    throw new ValidationError(
      'One of "month" (YYYY-MM), "date" (YYYY-MM-DD), or "week" (YYYY-MM-DD) query params is required',
    );
  }
  if (supplied.length > 1) {
    throw new ValidationError(
      'Only one of "month", "date", or "week" query params may be provided at a time',
    );
  }

  const { org_id, employee_id } = await resolveCallerEmployee(callerSub);

  let shifts;

  if (rawMonth !== undefined) {
    const month = parseMonth(rawMonth);
    shifts = await db.listShiftsByEmployeeMonth(org_id, employee_id, month);
  } else if (rawDate !== undefined) {
    const date = parseDate(rawDate);
    shifts = await db.listShiftsByEmployeeDate(org_id, employee_id, date);
  } else {
    // rawWeek is defined (guarded by the supplied.length checks above).
    const { weekStart, weekEnd } = parseWeek(rawWeek!);
    shifts = await db.listShiftsByEmployeeWeek(org_id, employee_id, weekStart, weekEnd);
  }

  return shifts
    .map((s) => stripKeys(s))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
    });
}
