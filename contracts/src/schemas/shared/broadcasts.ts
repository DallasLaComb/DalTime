import * as z from 'zod';
import { errorResponses } from '../common.js';
import { ActiveBroadcastApiFields } from '../../entities/broadcast.js';
import { registerOperation, registerRoleOperation, type DynamoAccess } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/shared/broadcasts/handler.ts',
  'backend/src/functions/shared/broadcasts/service.ts',
  'backend/src/functions/shared/broadcasts/db.ts',
];

/** Every role that receives broadcasts. WebAdmins receive `ALL`-scope broadcasts only. */
const ROLE_PREFIXES = ['web-admin', 'org-admin', 'manager', 'employee'] as const;
type RolePrefix = (typeof ROLE_PREFIXES)[number];

const OPERATION_ID_LABEL: Record<RolePrefix, string> = {
  'web-admin': 'WebAdmin',
  'org-admin': 'OrgAdmin',
  manager: 'Manager',
  employee: 'Employee',
};

/** A broadcast as its recipient sees it — no targeting or audit fields. */
export const ActiveBroadcastResponse = ActiveBroadcastApiFields.meta({
  id: 'ActiveBroadcastResponse',
  description: 'A banner broadcast addressed to the caller.',
});

export const ActiveBroadcastListResponse = z.array(ActiveBroadcastResponse).meta({
  id: 'ActiveBroadcastListResponse',
  description:
    "The caller's active, non-dismissed broadcasts, highest severity first then newest. " +
    'The banner shows the first entry.',
});

export const DismissBroadcastPathParams = z.object({
  broadcastId: z.uuid().meta({ description: 'The broadcast_id to dismiss.' }),
});

export const DismissBroadcastResponse = z
  .object({ success: z.literal(true) })
  .meta({ id: 'DismissBroadcastResponse', description: 'The broadcast is dismissed for the caller.' });

const ACTIVE_QUERIES: DynamoAccess[] = [
  {
    command: 'Get',
    keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
    note: 'Resolves the caller’s org_id. Skipped for WebAdmins (ALL scope only).',
  },
  {
    command: 'Query',
    keyCondition: 'PK = BROADCAST#ALL AND SK > <nowIso>',
    note: 'Issued in parallel with the org and org+role queries below. Bounded to active broadcasts.',
  },
  { command: 'Query', keyCondition: 'PK = BROADCAST#ORG#<orgId> AND SK > <nowIso>' },
  { command: 'Query', keyCondition: 'PK = BROADCAST#ORG#<orgId>#ROLE#<role> AND SK > <nowIso>' },
];

const LIST_DYNAMODB: DynamoAccess[] = [
  ...ACTIVE_QUERIES,
  {
    command: 'BatchGet',
    keyCondition: 'PK = USER#<callerSub> AND SK = BROADCAST_DISMISSAL#<broadcast_id> (each active id)',
    note: 'Skipped when there are no active broadcasts.',
  },
];

const DISMISS_DYNAMODB: DynamoAccess[] = [
  ...ACTIVE_QUERIES,
  {
    command: 'Put',
    keyCondition: 'PK = USER#<callerSub> AND SK = BROADCAST_DISMISSAL#<broadcastId>',
    note: 'Only if the id is one of the caller’s active broadcasts (404 otherwise). Idempotent.',
  },
];

function registerBroadcastOperations(role: RolePrefix): void {
  const label = OPERATION_ID_LABEL[role];
  const base = `/${role}/broadcasts/active`;
  const register = role === 'web-admin' ? registerOperation : registerRoleOperation;

  register('get', base, {
    operationId: `listActive${label}Broadcasts`,
    summary: `List banner broadcasts addressed to the calling ${role}`,
    tags: [role],
    purpose:
      'Backs the app-shell broadcast banner (frontend/src/app/shared/components/broadcast-banner). ' +
      'Returns 403 if the caller is not a member of the role the route prefix names.',
    implementation: IMPLEMENTATION,
    dynamodb: LIST_DYNAMODB,
    responses: {
      200: {
        description: 'Active, non-dismissed broadcasts, highest priority first.',
        content: { 'application/json': { schema: ActiveBroadcastListResponse } },
      },
      403: errorResponses[403],
      500: errorResponses[500],
    },
  });

  register('put', `/${role}/broadcasts/{broadcastId}/dismissal`, {
    operationId: `dismiss${label}Broadcast`,
    summary: `Dismiss a banner broadcast for the calling ${role}`,
    tags: [role],
    purpose:
      'Backs the banner’s dismiss button. The dismissal persists, so the banner never resurfaces ' +
      'for this user. Rejected with 403 under impersonation (impersonation is read-only).',
    implementation: IMPLEMENTATION,
    dynamodb: DISMISS_DYNAMODB,
    requestParams: { path: DismissBroadcastPathParams },
    responses: {
      200: {
        description: 'Dismissed.',
        content: { 'application/json': { schema: DismissBroadcastResponse } },
      },
      400: errorResponses[400],
      403: errorResponses[403],
      404: errorResponses[404],
      500: errorResponses[500],
    },
  });
}

for (const role of ROLE_PREFIXES) registerBroadcastOperations(role);

export type ActiveBroadcastResponse = z.infer<typeof ActiveBroadcastResponse>;
export type ActiveBroadcastListResponse = z.infer<typeof ActiveBroadcastListResponse>;
export type DismissBroadcastPathParams = z.infer<typeof DismissBroadcastPathParams>;
export type DismissBroadcastResponse = z.infer<typeof DismissBroadcastResponse>;
