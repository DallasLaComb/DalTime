import { randomUUID } from 'node:crypto';
import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

async function resolveCallerOrg(sub: string): Promise<{ org_id: string; user_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

export async function getLocations(callerSub: string) {
  const { org_id } = await resolveCallerOrg(callerSub);
  const locations = await db.listLocations(org_id);
  return locations.map((l) => stripKeys(l));
}

export async function createLocation(callerSub: string, body: { name?: string; address?: string }) {
  const trimmedName = body.name?.trim() ?? '';
  if (!trimmedName) throw new ValidationError('name is required');
  if (trimmedName.length > 100) throw new ValidationError('name must be 100 characters or fewer');
  const trimmedAddress = body.address?.trim() ?? '';
  if (!trimmedAddress) throw new ValidationError('address is required');
  if (trimmedAddress.length > 200) {
    throw new ValidationError('address must be 200 characters or fewer');
  }

  const { org_id, user_id } = await resolveCallerOrg(callerSub);
  const locationId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `ORG#${org_id}`,
    SK: `LOCATION#${locationId}`,
    location_id: locationId,
    org_id,
    name: trimmedName,
    address: trimmedAddress,
    created_by: user_id,
    created_at: now,
    updated_at: now,
  };

  await db.createLocation(item);
  logger.info('location created', { org_id, location_id: locationId });
  return stripKeys(item);
}

export async function updateLocation(
  callerSub: string,
  locationId: string,
  body: { name?: string; address?: string },
) {
  const hasFields = body.name !== undefined || body.address !== undefined;
  if (!hasFields) throw new ValidationError('At least one field must be provided');

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();
    if (!trimmedName) throw new ValidationError('name cannot be empty');
    if (trimmedName.length > 100) throw new ValidationError('name must be 100 characters or fewer');
  }

  if (body.address !== undefined) {
    const trimmedAddress = body.address.trim();
    // An address can be changed but not cleared — every location must say where it is.
    if (!trimmedAddress) throw new ValidationError('address cannot be empty');
    if (trimmedAddress.length > 200) {
      throw new ValidationError('address must be 200 characters or fewer');
    }
  }

  const { org_id } = await resolveCallerOrg(callerSub);
  const existing = await db.getLocation(org_id, locationId);
  if (!existing) throw new NotFoundError('Location not found');

  const fields: { name?: string; address?: string | null } = {};
  if (body.name !== undefined) fields.name = body.name.trim();
  if (body.address !== undefined) fields.address = body.address.trim();

  const updated = await db.updateLocation(org_id, locationId, fields, new Date().toISOString());
  logger.info('location updated', { org_id, location_id: locationId });
  return stripKeys(updated!);
}

function blockedDeleteMessage(name: string, shifts: number, people: number): string {
  const parts = [
    shifts > 0 ? `${shifts} ${shifts === 1 ? 'shift' : 'shifts'}` : null,
    people > 0 ? `${people} assigned ${people === 1 ? 'person' : 'people'}` : null,
  ].filter(Boolean);
  // "it" only when that one shift is all that's left to clear; otherwise "them".
  const pronoun = shifts === 1 && people === 0 ? 'it' : 'them';
  return `${name} has ${parts.join(' and ')}. Reassign or remove ${pronoun} first.`;
}

export async function removeLocation(callerSub: string, locationId: string) {
  const { org_id } = await resolveCallerOrg(callerSub);
  const existing = await db.getLocation(org_id, locationId);
  if (!existing) throw new NotFoundError('Location not found');

  // Shifts and assignments reference a location by id; deleting it would orphan them (the
  // schedule would then show a raw id). Block with the counts so the admin knows what to clear.
  const [shifts, assigned] = await Promise.all([
    db.countShiftsAtLocation(org_id, locationId),
    db.countPeopleAtLocation(org_id, locationId),
  ]);
  const people = assigned.managers + assigned.employees;
  if (shifts > 0 || people > 0) {
    logger.warn('location delete blocked', {
      org_id,
      location_id: locationId,
      shifts,
      managers: assigned.managers,
      employees: assigned.employees,
    });
    throw new ConflictError(blockedDeleteMessage(existing.name, shifts, people), {
      shifts,
      managers: assigned.managers,
      employees: assigned.employees,
    });
  }

  await db.deleteLocation(org_id, locationId);
  logger.info('location removed', { org_id, location_id: locationId });
}
