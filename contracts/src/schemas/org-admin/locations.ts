import * as z from 'zod';
import { ErrorResponse, errorResponses } from '../common.js';
import { LocationApiFields } from '../../entities/location.js';
import { registerRoleOperation } from '../../registry.js';

const IMPLEMENTATION = [
  'backend/src/functions/org-admin/locations/handler.ts',
  'backend/src/functions/org-admin/locations/service.ts',
  'backend/src/functions/org-admin/locations/db.ts',
];

/**
 * A location the OrgAdmin manages for their organization.
 *
 * Single-table key attributes are absent because `stripKeys()` removes them
 * before the handler responds.
 */
export const OrgAdminLocationResponse = LocationApiFields.meta({
  id: 'OrgAdminLocationResponse',
  description: 'A location in the calling OrgAdmin’s organization.',
});

export const OrgAdminLocationListResponse = z.array(OrgAdminLocationResponse).meta({
  id: 'OrgAdminLocationListResponse',
  description: 'Every location in the calling OrgAdmin’s organization.',
});

/** Path parameter for the by-id CRUD routes. */
const LocationIdPathParams = z.object({
  locationId: z.string().meta({ description: 'The location’s location_id.' }),
});

/**
 * Body accepted by `POST /org-admin/locations`.
 *
 * `name` and `address` are both required (an admin must be able to see where each location is);
 * name is capped at 100 characters and address at 200 — the same rules `service.createLocation` enforced, lifted so
 * a malformed request is rejected in the handler before it reaches DynamoDB.
 */
export const CreateOrgAdminLocationBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(200),
  })
  .meta({
    id: 'CreateOrgAdminLocationBody',
    description: 'Fields accepted to create a new location.',
  });

/**
 * Body accepted by `PUT /org-admin/locations/{locationId}`.
 *
 * Both fields optional but at least one required. `address` can be changed but not cleared —
 * every location must have one.
 */
export const UpdateOrgAdminLocationBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().min(1).max(200).optional(),
  })
  .refine((b) => b.name !== undefined || b.address !== undefined, 'At least one field is required')
  .meta({
    id: 'UpdateOrgAdminLocationBody',
    description: 'Partial update of a location’s name or address. The address cannot be emptied.',
  });

registerRoleOperation('get', '/org-admin/locations', {
  operationId: 'listOrgAdminLocations',
  summary: "List the calling org-admin's locations",
  tags: ['org-admin'],
  purpose:
    'Backs the org-admin locations screen (frontend/src/app/features/org-admin/locations).',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, LOCATION#)',
      note: 'Lists the org’s locations; key attributes are stripped from each row.',
    },
  ],
  responses: {
    200: {
      description: 'Every location in the org-admin’s organization.',
      content: { 'application/json': { schema: OrgAdminLocationListResponse } },
    },
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerRoleOperation('post', '/org-admin/locations', {
  operationId: 'createOrgAdminLocation',
  summary: 'Create a location',
  tags: ['org-admin'],
  purpose: 'Creates a location for the org-admin’s organization.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id and user_id (creator).',
    },
    {
      command: 'Put',
      keyCondition: 'PK = ORG#<orgId> AND SK = LOCATION#<locationId>',
      note: 'Primary record with created_by/created_at/updated_at.',
    },
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: CreateOrgAdminLocationBody } },
  },
  responses: {
    201: {
      description: 'The created location.',
      content: { 'application/json': { schema: OrgAdminLocationResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registerRoleOperation('put', '/org-admin/locations/{locationId}', {
  requestParams: { path: LocationIdPathParams },
  operationId: 'updateOrgAdminLocation',
  summary: 'Update a location',
  tags: ['org-admin'],
  purpose: 'Saves edits to a location in the org-admin’s organization.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id.',
    },
    {
      command: 'Get',
      keyCondition: 'PK = ORG#<orgId> AND SK = LOCATION#<locationId>',
      note: 'Fetches the location to confirm it exists.',
    },
    {
      command: 'Update',
      keyCondition: 'PK = ORG#<orgId> AND SK = LOCATION#<locationId>',
      note: 'SETs name/address plus updated_at.',
    },
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: UpdateOrgAdminLocationBody } },
  },
  responses: {
    200: {
      description: 'The updated location.',
      content: { 'application/json': { schema: OrgAdminLocationResponse } },
    },
    400: errorResponses[400],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

/** 409 body for a location that is still referenced: the message plus what references it. */
export const LocationInUseResponse = ErrorResponse.extend({
  shifts: z.int().nonnegative().meta({ description: 'Shifts (past, draft or published) at the location.' }),
  managers: z.int().nonnegative().meta({ description: 'Managers assigned to the location.' }),
  employees: z.int().nonnegative().meta({ description: 'Employees assigned to the location.' }),
}).meta({ id: 'LocationInUseResponse' });

registerRoleOperation('delete', '/org-admin/locations/{locationId}', {
  requestParams: { path: LocationIdPathParams },
  operationId: 'deleteOrgAdminLocation',
  summary: 'Delete a location',
  tags: ['org-admin'],
  purpose:
    'Removes a location from the org-admin’s organization. Blocked with 409 while any shift (past, draft or published) references the location or any manager/employee is assigned to it.',
  implementation: IMPLEMENTATION,
  dynamodb: [
    {
      command: 'Get',
      keyCondition: 'PK = USER#<callerSub> AND SK = METADATA',
      note: 'Resolves the caller’s org_id.',
    },
    {
      command: 'Get',
      keyCondition: 'PK = ORG#<orgId> AND SK = LOCATION#<locationId>',
      note: 'Confirms the location exists.',
    },
    {
      command: 'Delete',
      keyCondition: 'PK = ORG#<orgId> AND SK = LOCATION#<locationId>',
      note: 'Deletes the location record.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, SHIFT#)',
      note: 'Counts shifts referencing the location (filter on location_id; draft-failed sentinels excluded). Paginated.',
    },
    {
      command: 'Query',
      keyCondition: 'PK = ORG#<orgId> AND begins_with(SK, MANAGER#) / begins_with(SK, EMPLOYEE#)',
      note: 'Lists the org’s people to check for location assignments.',
    },
    {
      command: 'BatchGet',
      keyCondition: 'PK = USER#<userId> AND SK = LOCATION#<locationId> (per manager/employee)',
      note: 'Counts people assigned to the location.',
    },
  ],
  responses: {
    200: { description: 'Location deleted.' },
    400: errorResponses[400],
    403: errorResponses[403],
    404: errorResponses[404],
    409: {
      description:
        'The location is still referenced. `error` names the location and the counts, e.g. "Platt High School has 3 shifts and 2 assigned people. Reassign or remove them first."; `shifts`, `managers` and `employees` carry the counts.',
      content: { 'application/json': { schema: LocationInUseResponse } },
    },
    500: errorResponses[500],
  },
});

export type OrgAdminLocationResponse = z.infer<typeof OrgAdminLocationResponse>;
export type OrgAdminLocationListResponse = z.infer<typeof OrgAdminLocationListResponse>;
export type CreateOrgAdminLocationBody = z.infer<typeof CreateOrgAdminLocationBody>;
export type UpdateOrgAdminLocationBody = z.infer<typeof UpdateOrgAdminLocationBody>;
