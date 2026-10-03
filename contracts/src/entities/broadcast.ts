import * as z from 'zod';
import { IsoTimestamp } from '../schemas/common.js';
import { SingleTableKeys, KEY_FIELDS } from './keys.js';

/** Banner severity — drives colour and which banner wins when several are active. */
export const BroadcastSeverity = z
  .enum(['INFO', 'WARNING', 'CRITICAL'])
  .meta({ id: 'BroadcastSeverity', description: 'Banner severity; CRITICAL outranks WARNING outranks INFO.' });

/** Who a broadcast is addressed to. */
export const BroadcastTargetScope = z.enum(['ALL', 'ORG', 'ORG_ROLE']).meta({
  id: 'BroadcastTargetScope',
  description:
    '`ALL` = every user (all orgs, plus WebAdmins); `ORG` = every user in one org; ' +
    '`ORG_ROLE` = one role within one org.',
});

/** Org-scoped roles a broadcast can be narrowed to. */
export const BroadcastTargetRole = z
  .enum(['OrgAdmin', 'Manager', 'Employee'])
  .meta({ id: 'BroadcastTargetRole', description: 'Org role a broadcast can be narrowed to.' });

/** Sentinel `expires_at` sort-key prefix for a broadcast that never expires. */
export const BROADCAST_NO_EXPIRY = '9999-12-31T23:59:59.999Z';

/**
 * Broadcast record — stored ONCE per broadcast, keyed by its target scope
 * (fan-out on read). See `backend/src/functions/web-admin/broadcasts/0-broadcasts.blueprint.md`.
 *
 *   PK     = BROADCAST#ALL | BROADCAST#ORG#<org_id> | BROADCAST#ORG#<org_id>#ROLE#<role>
 *   SK     = <expires_at | 9999-12-31T23:59:59.999Z>#<broadcast_id>
 *   GSI1PK = BROADCAST
 *   GSI1SK = same as SK
 *
 * `expires_at` leads the sort key so "still active" is a key condition (`SK > <now>`).
 */
export const BroadcastRecord = SingleTableKeys.extend({
  broadcast_id: z.uuid(),
  message: z.string(),
  severity: BroadcastSeverity,
  target_scope: BroadcastTargetScope,
  target_org_id: z.string().optional(),
  target_role: BroadcastTargetRole.optional(),
  expires_at: IsoTimestamp.optional().meta({ description: 'Absent = never expires.' }),
  created_at: IsoTimestamp,
  created_by_web_admin_id: z.string(),
  ttl: z.int().optional().meta({ description: 'DynamoDB TTL, epoch seconds. Absent = never expires.' }),
});

/**
 * Per-user dismissal of a broadcast.
 *
 *   PK = USER#<sub>
 *   SK = BROADCAST_DISMISSAL#<broadcast_id>
 */
export const BroadcastDismissalRecord = SingleTableKeys.extend({
  broadcast_id: z.uuid(),
  dismissed_at: IsoTimestamp,
  ttl: z.int().optional(),
});

/** Broadcast fields visible to a WebAdmin — the record minus keys and TTL bookkeeping. */
export const BroadcastApiFields = BroadcastRecord.omit({ ...KEY_FIELDS, ttl: true });

/** The subset of a broadcast a recipient sees — no targeting or audit fields. */
export const ActiveBroadcastApiFields = BroadcastRecord.pick({
  broadcast_id: true,
  message: true,
  severity: true,
  expires_at: true,
  created_at: true,
});

export type BroadcastSeverity = z.infer<typeof BroadcastSeverity>;
export type BroadcastTargetScope = z.infer<typeof BroadcastTargetScope>;
export type BroadcastTargetRole = z.infer<typeof BroadcastTargetRole>;
export type BroadcastRecord = z.infer<typeof BroadcastRecord>;
export type BroadcastDismissalRecord = z.infer<typeof BroadcastDismissalRecord>;
export type BroadcastApiFields = z.infer<typeof BroadcastApiFields>;
export type ActiveBroadcastApiFields = z.infer<typeof ActiveBroadcastApiFields>;
