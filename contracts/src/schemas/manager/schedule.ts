import * as z from 'zod';
import { errorResponses } from '../common.js';
import { ManagerShiftResponse } from './shifts.js';
import { registerRoleOperation } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/manager/schedule/handler.ts',
  'backend/src/functions/manager/schedule/service.ts',
  'backend/src/functions/manager/schedule/db.ts',
];

/** Query parameter shared by all four schedule operations — optional month, defaulting to the current month. */
export const ScheduleMonthQuery = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .meta({ description: 'YYYY-MM — the schedule month to operate on.' }),
  })
  .meta({ id: 'ScheduleMonthQuery' });

/** Result of auto-generating a draft schedule from the unfilled needs + employee availability. */
export const GenerateDraftScheduleResponse = z
  .object({
    created: z.int().nonnegative().meta({ description: 'Draft shifts created this run.' }),
    unfilled: z.int().nonnegative().meta({ description: 'Employee-slots still unfilled after this run.' }),
    draftFailed: z
      .int()
      .nonnegative()
      .meta({ description: 'Sentinel slots with no eligible employee (draft_failed records created).' }),
    draftCount: z.int().nonnegative().meta({
      description:
        'Running draft count for the manager+month. Not incremented when there was nothing open to fill (`openSlots` = 0).',
    }),
    maxDrafts: z.int().positive().meta({ description: 'Hard cap on draft generations per manager per month.' }),
    openSlots: z.int().nonnegative().meta({
      description:
        'Employee-slots that were open (needed but unfilled) before this run. 0 means there was nothing to fill and no run was consumed.',
    }),
    openShifts: z.int().nonnegative().meta({
      description:
        'Open shifts (a shift with no employee) this month. Generate Draft fills shifts-needed, not open shifts: those are staffed by hand (Fill Shift).',
    }),
  })
  .meta({ id: 'GenerateDraftScheduleResponse' });

/** Result of promoting a month's draft shifts to published. */
export const PublishScheduleResponse = z
  .object({
    published: z.int().nonnegative().meta({ description: 'How many draft shifts were published.' }),
  })
  .meta({ id: 'PublishScheduleResponse' });

/** Meta for a manager+month draft generation budget. */
export const ScheduleMetaResponse = z
  .object({
    draftCount: z.int().nonnegative(),
    maxDrafts: z.int().positive(),
    openSlots: z.int().nonnegative().meta({
      description:
        'Employee-slots currently open (needed but unfilled) for the manager+month — what Generate Draft would try to fill.',
    }),
    openShifts: z.int().nonnegative().meta({
      description:
        'Open shifts (a shift with no employee) this month. Generate Draft does not fill these; they are staffed by hand (Fill Shift).',
    }),
  })
  .meta({ id: 'ScheduleMetaResponse' });

// `getDraftSummary` in the backend is typed as this response, and the handler returns it via
// `ok<ManagerScheduleDraftsResponse>(…)`, so the compiler enforces that the drafts are stripped
// `Shift` records exactly as declared here.
export const ManagerScheduleDraftsResponse = z
  .object({
    drafts: z.array(ManagerShiftResponse),
  })
  .meta({
    id: 'ManagerScheduleDraftsResponse',
    description:
      'The month’s draft shifts. The backend returns `unknown[]` today; declared as ManagerShiftResponse[] once typed.',
  });

registerRoleOperation('post', '/manager/schedule/generate', {
  operationId: 'generateManagerDraftSchedule',
  summary: 'Generate a draft schedule for a month',
  tags: ['manager'],
  purpose:
    'Runs the auto-scheduler for the caller’s team: assigns employees to the month’s unfilled needs ' +
    'from their availability, writing draft shifts (and draft_failed sentinels for unfillable slots).',
  implementation: IMPLEMENTATION,
  requestParams: { query: ScheduleMonthQuery },
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id and manager_id.',
    },
    {
      command: 'Get',
      keyCondition: 'PK = ORG#<orgId> AND SK = SCHEDULE_META#<managerId>#<month>',
      note: 'Reads the draft-count budget to enforce the per-month generation cap.',
    },
    {
      command: 'Query',
      keyCondition: 'GSI1PK = MANAGER#<managerId> AND begins_with(GSI1SK, <month>)',
      note: 'Loads the manager’s existing shifts to avoid double-assigning and to skip draft_failed retries.',
    },
    {
      command: 'Get',
      keyCondition: 'PK = USER#<empId> AND SK = AVAILABILITY / AVAILABILITY_OVERRIDES',
      note: 'Per-employee point reads of weekly + override availability used to test fit for each slot.',
    },
    {
      command: 'Put',
      keyCondition: 'PK = ORG#<orgId> AND SK = SHIFT#<shiftId>',
      note: 'Writes each assigned draft shift (or the deterministic draft_failed sentinel).',
    },
    {
      command: 'Update',
      keyCondition: 'PK = ORG#<orgId> AND SK = SCHEDULE_META#<managerId>#<month>',
      note: 'Increments draft_count after the generation pass — skipped when there was nothing open to fill.',
    },
  ],
  responses: {
    200: {
      description: 'A summary of the generation run.',
      content: { 'application/json': { schema: GenerateDraftScheduleResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerRoleOperation('post', '/manager/schedule/publish', {
  operationId: 'publishManagerSchedule',
  summary: 'Publish a month’s draft shifts',
  tags: ['manager'],
  purpose:
    'Promotes every `draft` shift in the month to `published`, making them visible to the assigned employees.',
  implementation: IMPLEMENTATION,
  requestParams: { query: ScheduleMonthQuery },
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id and manager_id.',
    },
    {
      command: 'Query',
      keyCondition: 'GSI1PK = MANAGER#<managerId> AND begins_with(GSI1SK, <month>)',
      filter: 'status = draft',
      note: 'Lists the month’s draft shifts to publish.',
    },
    {
      command: 'Update',
      keyCondition: 'PK = ORG#<orgId> AND SK = SHIFT#<shiftId>',
      note: 'One Update per draft — sets status = published — issued in parallel via Promise.all.',
    },
  ],
  responses: {
    200: {
      description: 'How many draft shifts were published.',
      content: { 'application/json': { schema: PublishScheduleResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerRoleOperation('get', '/manager/schedule/drafts', {
  operationId: 'getManagerScheduleDrafts',
  summary: 'Get a month’s draft shifts',
  tags: ['manager'],
  purpose: 'Returns the month’s draft shifts so the manager can review before publishing.',
  implementation: IMPLEMENTATION,
  requestParams: { query: ScheduleMonthQuery },
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id and manager_id.',
    },
    {
      command: 'Query',
      keyCondition: 'GSI1PK = MANAGER#<managerId> AND begins_with(GSI1SK, <month>)',
      filter: 'status = draft',
      note: 'Lists the month’s draft shifts with key attributes stripped.',
    },
  ],
  responses: {
    200: {
      description: 'The month’s draft shifts.',
      content: { 'application/json': { schema: ManagerScheduleDraftsResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerRoleOperation('get', '/manager/schedule/meta', {
  operationId: 'getManagerScheduleMeta',
  summary: 'Get draft-generation budget for a month',
  tags: ['manager'],
  purpose:
    'Returns the draft-generation budget for the given month and how many employee-slots are currently open.',
  implementation: IMPLEMENTATION,
  requestParams: { query: ScheduleMonthQuery },
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id and manager_id.',
    },
    {
      command: 'Get',
      keyCondition: 'PK = ORG#<orgId> AND SK = SCHEDULE_META#<managerId>#<month>',
      note: 'Reads the draft-count budget, defaulting to 0 when absent.',
    },
    {
      command: 'Query',
      keyCondition: 'GSI1PK = MANAGER#<managerId> AND begins_with(GSI1SK, <month>)',
      note: 'Loads the manager’s shifts-needed and existing shifts (one range Query) to compute `openSlots`.',
    },
  ],
  responses: {
    200: {
      description: 'The draft-generation budget.',
      content: { 'application/json': { schema: ScheduleMetaResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

export type GenerateDraftScheduleResponse = z.infer<typeof GenerateDraftScheduleResponse>;
export type PublishScheduleResponse = z.infer<typeof PublishScheduleResponse>;
export type ScheduleMetaResponse = z.infer<typeof ScheduleMetaResponse>;
export type ManagerScheduleDraftsResponse = z.infer<typeof ManagerScheduleDraftsResponse>;
