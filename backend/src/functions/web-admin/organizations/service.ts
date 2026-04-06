import { randomUUID } from 'node:crypto';
import type {
  Organization,
  CreateOrganizationBody,
  UpdateOrganizationBody,
} from '../../shared/models/web-admin/organization.model.js';
import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

export class ValidationError extends Error {}

export async function listOrganizations() {
  const items = await db.listOrganizations();
  return items.map(stripKeys);
}

export async function getOrganization(orgId: string) {
  const item = await db.getOrganizationById(orgId);
  return item ? stripKeys(item) : null;
}

export async function createOrganization(body: CreateOrganizationBody) {
  if (!body.name?.trim()) throw new ValidationError('name is required');
  if (!body.address?.trim()) throw new ValidationError('address is required');

  const id = randomUUID();
  const now = new Date().toISOString();
  const org: Organization = {
    PK: `ORG#${id}`,
    SK: 'METADATA',
    GSI1PK: 'ORG',
    GSI1SK: now,
    org_id: id,
    name: body.name.trim(),
    address: body.address.trim(),
    created_at: now,
    updated_at: now,
    org_admin_count: 0,
  };

  await db.createOrganization(org);
  return stripKeys(org);
}

export async function updateOrganization(orgId: string, body: UpdateOrganizationBody) {
  const existing = await db.getOrganizationById(orgId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = await db.updateOrganization(orgId, {
    name: body.name?.trim() ?? (existing['name'] as string),
    address: body.address?.trim() ?? (existing['address'] as string),
    updated_at: now,
  });

  return stripKeys(updated);
}

export async function deleteOrganization(orgId: string) {
  const existing = await db.getOrganizationById(orgId);
  if (!existing) return false;
  await db.deleteOrganization(orgId);
  return true;
}
