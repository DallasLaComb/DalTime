import { getMetadataRecord, listOrgLocations, getOrgLocation } from '../../shared/dynamo.js';
import type { Location } from '../../shared/models/manager/location.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; manager_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listLocations(orgId: string): Promise<Location[]> {
  return listOrgLocations(orgId);
}

export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  return getOrgLocation(orgId, locationId);
}
