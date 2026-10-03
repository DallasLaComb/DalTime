import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';
import { ForbiddenError } from '../../shared/errors.js';

// Read-only on purpose: creating, editing and deleting shifts is manager work (the manager
// routes), not an org-admin capability. See the handler.

async function resolveCallerOrg(sub: string): Promise<{ org_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

function parseMonth(raw: string | undefined): string {
  const d = new Date();
  const month = raw ?? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must be in YYYY-MM format');
  return month;
}

export async function listShifts(callerSub: string, rawMonth: string | undefined) {
  const month = parseMonth(rawMonth);
  const { org_id } = await resolveCallerOrg(callerSub);
  const shifts = await db.listShiftsByOrg(org_id, month);
  return shifts
    .map((s) => stripKeys(s))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc === 0 ? a.start_time.localeCompare(b.start_time) : dc;
    });
}
