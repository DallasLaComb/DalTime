import { stripKeys } from '../../shared/dynamo.js';
import { ForbiddenError, ValidationError } from '../../shared/errors.js';
import * as db from './db.js';

function parseMonth(raw: string | undefined): string {
  const d = new Date();
  const month = raw ?? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError('month must be in YYYY-MM format');
  return month;
}

/** Read-only, org-wide: the demand behind the oversight schedule's "not yet scheduled" slots. */
export async function listShiftsNeeded(callerSub: string, rawMonth: string | undefined) {
  const month = parseMonth(rawMonth);
  const lookup = await db.getCallerLookup(callerSub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  const needed = await db.listShiftsNeededByOrg(lookup.org_id, month);
  return needed
    .map((n) => stripKeys(n))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
    });
}
