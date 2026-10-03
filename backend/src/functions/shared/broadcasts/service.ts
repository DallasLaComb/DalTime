import type {
  ActiveBroadcastResponse,
  BroadcastRecord,
  BroadcastSeverity,
} from '@daltime/contracts';
import { getMetadataRecord } from '../dynamo.js';
import { NotFoundError } from '../errors.js';
import { logger } from '../logger.js';
import * as db from './db.js';

/** Roles that receive broadcasts. */
export type BroadcastRecipientRole = 'WebAdmin' | 'OrgAdmin' | 'Manager' | 'Employee';

const SEVERITY_RANK: Record<BroadcastSeverity, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };

/** Highest severity first, then newest first. */
function byPriority(a: BroadcastRecord, b: BroadcastRecord): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    b.created_at.localeCompare(a.created_at)
  );
}

function toResponse(record: BroadcastRecord): ActiveBroadcastResponse {
  return {
    broadcast_id: record.broadcast_id,
    message: record.message,
    severity: record.severity,
    created_at: record.created_at,
    ...(record.expires_at && { expires_at: record.expires_at }),
  };
}

/**
 * The scope partitions a caller receives: everyone gets `ALL`; org members also
 * get their org and their org+role. WebAdmins have no org, so `ALL` only.
 */
async function scopesFor(sub: string, role: BroadcastRecipientRole): Promise<string[]> {
  const scopes = ['BROADCAST#ALL'];
  if (role === 'WebAdmin') return scopes;

  const metadata = await getMetadataRecord<{ org_id?: string }>(sub);
  const orgId = metadata?.org_id;
  if (orgId) scopes.push(`BROADCAST#ORG#${orgId}`, `BROADCAST#ORG#${orgId}#ROLE#${role}`);
  return scopes;
}

/** Every broadcast addressed to the caller that has not expired, in priority order. */
async function activeForCaller(
  sub: string,
  role: BroadcastRecipientRole,
  now: Date,
): Promise<BroadcastRecord[]> {
  const nowIso = now.toISOString();
  const scopes = await scopesFor(sub, role);
  const pages = await Promise.all(scopes.map((pk) => db.queryActiveByScope(pk, nowIso)));
  return pages.flat().sort(byPriority);
}

/** The caller's active, non-dismissed broadcasts — the banner shows the first. */
export async function listActiveForCaller(
  sub: string,
  role: BroadcastRecipientRole,
  now: Date = new Date(),
): Promise<ActiveBroadcastResponse[]> {
  const active = await activeForCaller(sub, role, now);
  if (active.length === 0) return [];

  const dismissed = await db.getDismissedIds(
    sub,
    active.map((b) => b.broadcast_id),
  );
  return active.filter((b) => !dismissed.has(b.broadcast_id)).map(toResponse);
}

/**
 * Dismiss a broadcast for the caller. Only broadcasts actually addressed to the
 * caller and still active can be dismissed — anything else is a 404, so the
 * route reveals nothing about other orgs' broadcasts.
 */
export async function dismissBroadcast(
  sub: string,
  role: BroadcastRecipientRole,
  broadcastId: string,
  now: Date = new Date(),
): Promise<void> {
  const active = await activeForCaller(sub, role, now);
  const target = active.find((b) => b.broadcast_id === broadcastId);
  if (!target) throw new NotFoundError(`Broadcast '${broadcastId}' not found`);

  await db.putDismissal(sub, {
    broadcast_id: broadcastId,
    dismissed_at: now.toISOString(),
    // Expire with the broadcast; a never-expiring broadcast keeps its dismissal.
    ...(target.ttl !== undefined && { ttl: target.ttl }),
  });
  logger.info('broadcast dismissed', { broadcast_id: broadcastId, caller_sub: sub });
}
