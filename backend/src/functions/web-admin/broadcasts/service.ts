import { randomUUID } from 'node:crypto';
import {
  BROADCAST_NO_EXPIRY,
  type BroadcastRecord,
  type BroadcastResponse,
  type CreateBroadcastBody,
} from '@daltime/contracts';
import { stripKeys } from '../../shared/dynamo.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import * as db from './db.js';

/** Extra time TTL waits past `expires_at` before DynamoDB deletes the item. */
const TTL_GRACE_SECONDS = 24 * 60 * 60;

/** Strip keys and TTL bookkeeping before returning a broadcast to a WebAdmin. */
function toResponse(record: BroadcastRecord): BroadcastResponse {
  const { ttl: _ttl, ...rest } = stripKeys(record);
  return rest;
}

/** The partition a broadcast is stored under — the same key a recipient queries. */
export function broadcastPartitionKey(body: CreateBroadcastBody): string {
  if (body.target_scope === 'ALL') return 'BROADCAST#ALL';
  if (body.target_scope === 'ORG') return `BROADCAST#ORG#${body.org_id}`;
  return `BROADCAST#ORG#${body.org_id}#ROLE#${body.role}`;
}

/**
 * Create a broadcast. Stored once under its target scope (fan-out on read), so
 * the cost is one write no matter how many users it reaches — and users created
 * after it was sent still see it.
 */
export async function createBroadcast(
  body: CreateBroadcastBody,
  webAdminId: string,
  now: Date = new Date(),
): Promise<BroadcastResponse> {
  if (body.expires_at && new Date(body.expires_at).getTime() <= now.getTime()) {
    throw new ValidationError('expires_at must be in the future');
  }
  if (body.target_scope !== 'ALL') {
    // CreateBroadcastBody guarantees org_id for ORG / ORG_ROLE.
    const orgId = body.org_id ?? '';
    if (!(await db.organizationExists(orgId))) {
      throw new NotFoundError(`Organization '${orgId}' not found`);
    }
  }

  const broadcast_id = randomUUID();
  const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : undefined;
  const sk = `${expiresAt ?? BROADCAST_NO_EXPIRY}#${broadcast_id}`;

  const record: BroadcastRecord = {
    PK: broadcastPartitionKey(body),
    SK: sk,
    GSI1PK: db.BROADCAST_GSI1PK,
    GSI1SK: sk,
    broadcast_id,
    message: body.message,
    severity: body.severity,
    target_scope: body.target_scope,
    ...(body.target_scope !== 'ALL' && { target_org_id: body.org_id }),
    ...(body.target_scope === 'ORG_ROLE' && { target_role: body.role }),
    ...(expiresAt && {
      expires_at: expiresAt,
      ttl: Math.floor(new Date(expiresAt).getTime() / 1000) + TTL_GRACE_SECONDS,
    }),
    created_at: now.toISOString(),
    created_by_web_admin_id: webAdminId,
  };

  await db.putBroadcast(record);
  logger.info('broadcast created', {
    broadcast_id,
    target_scope: record.target_scope,
    target_org_id: record.target_org_id,
    target_role: record.target_role,
    severity: record.severity,
  });
  return toResponse(record);
}

/** Every active broadcast, soonest-expiring first. */
export async function listActiveBroadcasts(now: Date = new Date()): Promise<BroadcastResponse[]> {
  const items = await db.queryActiveBroadcasts(now.toISOString());
  return items.map(toResponse);
}

/** Take down an active broadcast. Throws NotFoundError if it is not active. */
export async function deleteBroadcast(
  broadcastId: string,
  webAdminId: string,
  now: Date = new Date(),
): Promise<void> {
  const items = await db.queryActiveBroadcasts(now.toISOString());
  const target = items.find((item) => item.broadcast_id === broadcastId);
  if (!target) throw new NotFoundError(`Broadcast '${broadcastId}' not found`);

  await db.deleteBroadcast(target.PK, target.SK);
  logger.info('broadcast deleted', { broadcast_id: broadcastId, web_admin_id: webAdminId });
}
