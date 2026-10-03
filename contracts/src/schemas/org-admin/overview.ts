import * as z from 'zod';
import { errorResponses } from '../common.js';
import { DateOnly } from '../../entities/shift.js';
import { registerRoleOperation } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/org-admin/overview/handler.ts',
  'backend/src/functions/org-admin/overview/service.ts',
  'backend/src/functions/org-admin/overview/db.ts',
];

export const OrgAdminOverviewManager = z
  .object({
    manager_id: z.string(),
    name: z.string(),
    employees: z.int().nonnegative().meta({ description: 'Active employees assigned to the manager.' }),
    unfilled_slots: z.int().nonnegative().meta({ description: 'Open employee-slots this week.' }),
    unfilled_shifts: z.int().nonnegative().meta({ description: 'Shifts-needed with at least one open slot this week.' }),
    drafts: z.int().nonnegative().meta({ description: 'Draft shifts awaiting publication.' }),
  })
  .meta({ id: 'OrgAdminOverviewManager' });

/** The org admin's own schedule (what they run via "View as Manager"): in the org totals, not in the by-manager list. */
export const OrgAdminOverviewOwnSchedule = z
  .object({
    employees: z.int().nonnegative().meta({ description: 'Active employees assigned to the org admin.' }),
    unfilled_slots: z.int().nonnegative().meta({ description: 'Open slots on the org admin’s own schedule this week.' }),
    unfilled_shifts: z.int().nonnegative().meta({ description: 'Shifts with an open slot on the org admin’s own schedule this week.' }),
    drafts: z.int().nonnegative().meta({ description: 'Draft shifts on the org admin’s own schedule.' }),
  })
  .meta({ id: 'OrgAdminOverviewOwnSchedule' });

export const OrgAdminOverviewResponse = z
  .object({
    week_start: DateOnly.meta({ description: 'Sunday of the current week (UTC).' }),
    week_end: DateOnly.meta({ description: 'Saturday of the current week (UTC).' }),
    unfilled_slots: z.int().nonnegative().meta({
      description:
        'Employee-slots still open this week across the whole org, including the org admin’s own schedule: each shift-needed’s employee_count minus shifts with an employee on that date/location/time (drafts count), plus open shifts that have no employee and match no shift-needed.',
    }),
    unfilled_shifts: z.int().nonnegative().meta({ description: 'Shifts (needs and open shifts) this week with at least one open slot.' }),
    drafts_to_publish: z.int().nonnegative().meta({
      description: 'Draft shifts dated from the start of this week through `drafts_window_days` ahead.',
    }),
    drafts_window_days: z.int().positive(),
    open_swap_requests: z.int().nonnegative().meta({ description: 'Shift-swap listings still open (unclaimed).' }),
    headcount: z.object({
      employees: z.int().nonnegative().meta({ description: 'Active (non-disabled) employees.' }),
      managers: z.int().nonnegative().meta({ description: 'Active (non-disabled) managers.' }),
      locations: z.int().nonnegative(),
      pending_invites: z.int().nonnegative().meta({
        description:
          'Active (non-disabled) managers and employees who have not yet set their password, per Cognito. Disabled people are never counted.',
      }),
      disabled_employees: z.int().nonnegative().meta({ description: 'Disabled employees (not in `employees`).' }),
      disabled_managers: z.int().nonnegative().meta({ description: 'Disabled managers (not in `managers`).' }),
      unassigned_employees: z.int().nonnegative().meta({ description: 'Active employees with no manager.' }),
    }),
    managers: z.array(OrgAdminOverviewManager).meta({
      description: 'Per-manager breakdown, most unfilled slots first. The org admin is not listed; see `own_schedule`.',
    }),
    own_schedule: OrgAdminOverviewOwnSchedule,
  })
  .meta({
    id: 'OrgAdminOverviewResponse',
    description: 'At-a-glance org analytics for the OrgAdmin home page.',
  });

registerRoleOperation('get', '/org-admin/overview', {
  operationId: 'getOrgAdminOverview',
  summary: 'Organization overview (home page analytics)',
  tags: ['org-admin'],
  purpose:
    'Backs the org-admin home page (frontend/src/app/features/org-admin/home): this week’s unfilled ' +
    'shifts, drafts waiting to be published, open swap requests and headcount, with a per-manager breakdown.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, MANAGER#)',
      note: 'Managers in the org (headcount + the per-manager fan-out).',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, EMPLOYEE#)',
      note: 'Employees in the org; paginated.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, LOCATION#)',
      note: 'Locations in the org (headcount).',
    },
    {
      command: 'Query',
      index: 'GSI1',
      keyCondition: 'GSI1PK = ORG_SWAP#<orgId> AND begins_with(GSI1SK, STATUS#open#)',
      note: 'COUNT of open swap listings; paginated.',
    },
    {
      command: 'Query',
      index: 'GSI1',
      keyCondition: 'GSI1PK = MANAGER#<managerId> AND GSI1SK BETWEEN <weekStart> AND <windowEnd>',
      note: 'One range Query per active manager, plus one for the org admin’s own schedule, returning shifts and shifts-needed for the week + drafts window; paginated.',
    },
  ],
  responses: {
    200: {
      description: 'Org overview.',
      content: { 'application/json': { schema: OrgAdminOverviewResponse } },
    },
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

export type OrgAdminOverviewManager = z.infer<typeof OrgAdminOverviewManager>;
export type OrgAdminOverviewResponse = z.infer<typeof OrgAdminOverviewResponse>;
