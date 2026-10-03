import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

import { ForbiddenError } from '../../shared/errors.js';

async function resolveCallerOrg(sub: string): Promise<{ org_id: string; manager_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

export async function getLocations(callerSub: string) {
  const { org_id } = await resolveCallerOrg(callerSub);
  const locations = await db.listLocations(org_id);
  return locations.map((l) => stripKeys(l));
}
