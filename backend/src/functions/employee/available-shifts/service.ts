import { stripKeys } from '../../shared/dynamo.js';
import { ForbiddenError, ValidationError } from '../../shared/errors.js';
import * as db from './db.js';

/**
 * Resolve the caller's org_id and employee_id from their Cognito sub via the
 * USER#<sub>/METADATA reverse-lookup record. Throws ForbiddenError if the record
 * is missing — a valid JWT with no provisioned record must not reach data.
 */
async function resolveCallerEmployee(
  sub: string,
): Promise<{ org_id: string; employee_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller could not be resolved');
  return lookup;
}

/**
 * Parse and validate a YYYY-MM-DD date string.
 * Throws ValidationError if the format is wrong or the value is not a real date.
 *
 * We validate the calendar date by re-serialising the parsed UTC date back to
 * YYYY-MM-DD and checking it round-trips: if the day was out of range (e.g.
 * 2025-02-30) JavaScript's Date wraps it into the next month, so the
 * serialised value will differ from the input string and we can reject it.
 */
function parseDate(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError('date must be in YYYY-MM-DD format');
  }
  // Round-trip check: if the date overflows (e.g. Feb 30 → Mar 2) the
  // serialised form will not equal the original string.
  const d = new Date(raw + 'T00:00:00Z');
  const roundTripped = d.toISOString().slice(0, 10);
  if (roundTripped !== raw) {
    throw new ValidationError('date value is not a valid calendar date');
  }
  return raw;
}

/**
 * List shifts available for pickup on a given date within the caller's org.
 *
 * A shift is available for pickup when:
 *   - available_for_pickup === true (the assigned employee offered it up)
 *   - employee_id !== callerId (can't pick up your own shift)
 *   - status === 'published' or status attribute is absent
 *
 * Returns an empty array if no available shifts exist (never 404).
 * Results are sorted by start_time ascending.
 */
export async function listAvailableShifts(callerSub: string, rawDate: string | undefined) {
  if (!rawDate) {
    throw new ValidationError('"date" query param is required (YYYY-MM-DD)');
  }

  const date = parseDate(rawDate);
  const { org_id, employee_id } = await resolveCallerEmployee(callerSub);
  const shifts = await db.listAvailableShifts(org_id, employee_id, date);

  return shifts.map((s) => stripKeys(s)).sort((a, b) => a.start_time.localeCompare(b.start_time));
}
