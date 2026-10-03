import * as z from 'zod';
import { errorResponses } from '../common.js';
import { ShiftNeededApiFields } from '../../entities/shift.js';
import { registerRoleOperation } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/org-admin/shifts-needed/handler.ts',
  'backend/src/functions/org-admin/shifts-needed/service.ts',
  'backend/src/functions/org-admin/shifts-needed/db.ts',
];

/** A staffing need (one date/location/time block) as the org admin sees it — read-only. */
export const OrgAdminShiftNeededResponse = ShiftNeededApiFields.meta({
  id: 'OrgAdminShiftNeededResponse',
  description: 'A shift-need posted by any manager in the OrgAdmin’s organization.',
});

export const OrgAdminShiftNeededListResponse = z.array(OrgAdminShiftNeededResponse).meta({
  id: 'OrgAdminShiftNeededListResponse',
  description: 'Every shift-need in the OrgAdmin’s organization within the requested month.',
});

export const OrgAdminShiftsNeededQuery = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .meta({ description: 'YYYY-MM — all shift-needs in the given calendar month.' }),
  })
  .meta({ id: 'OrgAdminShiftsNeededQuery' });

registerRoleOperation('get', '/org-admin/shifts-needed', {
  operationId: 'listOrgAdminShiftsNeeded',
  summary: "List the calling org-admin's organization's shifts-needed in a month",
  tags: ['org-admin'],
  purpose:
    'Backs the "not yet scheduled" slots on the read-only org-admin schedule ' +
    '(frontend/src/app/features/org-admin/schedule). A slot is one employee of a shift-need’s ' +
    '`employee_count`, filled only by a shift with an employee assigned on the same date/location/time. ' +
    'Read-only by design: managers create and edit shifts-needed (/manager/shifts-needed); non-GET methods answer 405.',
  implementation: IMPLEMENTATION,
  requestParams: { query: OrgAdminShiftsNeededQuery },
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, SHIFT_NEEDED#)',
      filter: 'begins_with(#date, <month>)',
      note: 'Lists the org’s shifts-needed for the month (paginated); key attributes are stripped and rows sorted by date then start_time.',
    },
  ],
  responses: {
    200: {
      description: 'Every shift-need in the org for the requested month.',
      content: { 'application/json': { schema: OrgAdminShiftNeededListResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

export type OrgAdminShiftNeededResponse = z.infer<typeof OrgAdminShiftNeededResponse>;
export type OrgAdminShiftNeededListResponse = z.infer<typeof OrgAdminShiftNeededListResponse>;
export type OrgAdminShiftsNeededQuery = z.infer<typeof OrgAdminShiftsNeededQuery>;
