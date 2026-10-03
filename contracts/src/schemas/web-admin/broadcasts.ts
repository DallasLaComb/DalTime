import * as z from 'zod';
import { errorResponses, IsoTimestamp } from '../common.js';
import {
  BroadcastApiFields,
  BroadcastSeverity,
  BroadcastTargetRole,
  BroadcastTargetScope,
} from '../../entities/broadcast.js';
import { registerOperation } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/web-admin/broadcasts/handler.ts',
  'backend/src/functions/web-admin/broadcasts/service.ts',
  'backend/src/functions/web-admin/broadcasts/db.ts',
];

/** Max banner length — long enough for a maintenance notice with a date and time window. */
export const BROADCAST_MESSAGE_MAX = 500;

/** Ids interpolated into DynamoDB keys must not contain `#`. */
const KeySafeId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'must be a valid id');

/** A broadcast as a WebAdmin sees it, including targeting and audit fields. */
export const BroadcastResponse = BroadcastApiFields.meta({
  id: 'BroadcastResponse',
  description: 'A broadcast banner as returned to a WebAdmin.',
});

export const BroadcastListResponse = z.array(BroadcastResponse).meta({
  id: 'BroadcastListResponse',
  description: 'Every currently active (unexpired) broadcast, soonest-expiring first.',
});

/** Body accepted by `POST /web-admin/broadcasts`. */
export const CreateBroadcastBody = z
  .object({
    message: z.string().trim().min(1).max(BROADCAST_MESSAGE_MAX),
    severity: BroadcastSeverity,
    target_scope: BroadcastTargetScope,
    org_id: KeySafeId.optional().meta({ description: 'Required for ORG and ORG_ROLE.' }),
    role: BroadcastTargetRole.optional().meta({ description: 'Required for ORG_ROLE.' }),
    expires_at: IsoTimestamp.optional().meta({
      description: 'When the banner stops showing. Must be in the future. Omit for no expiry.',
    }),
  })
  .superRefine((body, ctx) => {
    if (body.target_scope !== 'ALL' && !body.org_id) {
      ctx.addIssue({ code: 'custom', path: ['org_id'], message: 'org_id is required for this target' });
    }
    if (body.target_scope === 'ORG_ROLE' && !body.role) {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'role is required for this target' });
    }
  })
  .meta({
    id: 'CreateBroadcastBody',
    description: 'A new banner broadcast and who it is addressed to.',
  });

export const BroadcastIdPathParams = z.object({
  broadcastId: z.uuid().meta({ description: 'The broadcast’s broadcast_id.' }),
});

registerOperation('post', '/web-admin/broadcasts', {
  operationId: 'createWebAdminBroadcast',
  summary: 'Send a banner broadcast',
  tags: ['web-admin'],
  purpose:
    'Backs the WebAdmin broadcast composer (frontend/src/app/features/web-admin/broadcasts). ' +
    'Stores the broadcast once under its target scope; recipients find it at read time.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = ORG#<org_id> AND SK = METADATA',
      note: 'ORG / ORG_ROLE targets only — verifies the organization exists (404 otherwise).',
    },
    {
      command: 'Put',
      keyCondition: 'PK = BROADCAST#<scope> AND SK = <expires_at>#<broadcast_id>',
      note: 'Also sets GSI1PK = BROADCAST / GSI1SK = SK for the WebAdmin active list, and `ttl`.',
    },
  ],
  requestBody: { required: true, content: { 'application/json': { schema: CreateBroadcastBody } } },
  responses: {
    201: {
      description: 'The created broadcast.',
      content: { 'application/json': { schema: BroadcastResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registerOperation('get', '/web-admin/broadcasts', {
  operationId: 'listWebAdminBroadcasts',
  summary: 'List active banner broadcasts',
  tags: ['web-admin'],
  purpose: 'Backs the "Active broadcasts" list on the WebAdmin broadcast page, so one can be taken down.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Query',
      index: 'GSI1',
      keyCondition: 'GSI1PK = BROADCAST AND GSI1SK > <nowIso>',
      note: 'Active broadcasts only (expiry leads the sort key). Paginated on LastEvaluatedKey.',
    },
  ],
  responses: {
    200: {
      description: 'Active broadcasts.',
      content: { 'application/json': { schema: BroadcastListResponse } },
    },
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerOperation('delete', '/web-admin/broadcasts/{broadcastId}', {
  requestParams: { path: BroadcastIdPathParams },
  operationId: 'deleteWebAdminBroadcast',
  summary: 'Take down a banner broadcast',
  tags: ['web-admin'],
  purpose: 'Removes an active broadcast immediately — the only way to end one sent without an expiry.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Query',
      index: 'GSI1',
      keyCondition: 'GSI1PK = BROADCAST AND GSI1SK > <nowIso>',
      note: 'Same bounded active-list query as GET; the id is matched in memory to recover PK/SK.',
    },
    {
      command: 'Delete',
      keyCondition: 'PK = BROADCAST#<scope> AND SK = <expires_at>#<broadcast_id>',
    },
  ],
  responses: {
    204: { description: 'Deleted.' },
    400: errorResponses[400],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export type BroadcastResponse = z.infer<typeof BroadcastResponse>;
export type BroadcastListResponse = z.infer<typeof BroadcastListResponse>;
export type CreateBroadcastBody = z.infer<typeof CreateBroadcastBody>;
export type BroadcastIdPathParams = z.infer<typeof BroadcastIdPathParams>;
