import * as z from 'zod';

/**
 * Cognito user status, as surfaced on API responses.
 *
 * The backend entity models type this as a bare `string`; the frontend models
 * already narrowed it to these three values. The narrower type is kept here
 * because it is the one the UI actually branches on (see `core/utils/user-status.ts`).
 */
export const UserStatus = z
  .enum(['FORCE_CHANGE_PASSWORD', 'CONFIRMED', 'DISABLED'])
  .meta({ id: 'UserStatus', description: 'Cognito account status for a user.' });

/** ISO 8601 timestamp string, as stored in DynamoDB. */
export const IsoTimestamp = z.iso.datetime().meta({
  description: 'ISO 8601 timestamp.',
  example: '2026-02-23T18:04:11.000Z',
});

/**
 * The error body every handler returns on a non-2xx response.
 *
 * Shape comes from `backend/src/functions/shared/response.ts`, where each error
 * helper serialises `{ error: message }`.
 */
export const ErrorResponse = z
  .object({
    error: z.string().meta({ description: 'Human-readable failure reason.' }),
  })
  .meta({ id: 'ErrorResponse', description: 'Standard error envelope.' });

/**
 * Request header a WebAdmin sends to act as another user on a role route.
 *
 * Declared once here and merged onto every employee/manager/org-admin operation
 * by `registerRoleOperation` (see `registry.ts`), so the ~60 role ops do not each
 * copy it. Header names are lower-case because that is how API Gateway HTTP APIs
 * deliver them to the Lambda.
 *
 * Resolved by `withImpersonation` in every role Lambda. Outcomes, in order: 403 unless the
 * caller is a provisioned ACTIVE WebAdmin; 403 for any method but GET; 400 for a malformed id;
 * 404 unless the id is a real member of the role the route serves.
 */
export const ImpersonationHeader = z
  .object({
    'x-impersonate-user': z.string().optional().meta({
      description:
        'WebAdmin-only. View this route as the given user (their Cognito sub). Read-only: any ' +
        'non-GET is rejected with 403. Rejected with 403 if the caller is not an ACTIVE WebAdmin, ' +
        '400 if the id is malformed, and 404 if the user is not a member of the role this route ' +
        'serves. The acting WebAdmin is recorded server-side.',
    }),
  })
  .meta({ id: 'ImpersonationHeader' });

/**
 * Headers for `/manager/*` routes: the impersonation header plus `X-View-As`, which lets an
 * OrgAdmin use a manager route as a manager ("view as manager"). Honoured only when the verified
 * JWT is an OrgAdmin's; anyone else sending it is unaffected (the route still requires Manager).
 */
export const ManagerRouteHeaders = ImpersonationHeader.extend({
  'x-view-as': z.literal('manager').optional().meta({
    description:
      'OrgAdmin-only. Act as a manager (whose id is the caller’s own) on this route — set while the ' +
      'app is in its "view as manager" mode. Ignored for any other caller.',
  }),
}).meta({ id: 'ManagerRouteHeaders' });

/** Response entries reused across operations, so error shapes stay identical everywhere. */
/**
 * A phone number: exactly 10 digits once formatting is stripped, or empty (phone is optional).
 * Formatted input — "(555) 123-4567", "555-123-4567" — is accepted; the backend stores the 10
 * digits only. Numbers saved before this rule can still be read but fail on the next edit.
 */
export const OptionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || v.replace(/\D/g, '').length === 10, 'Phone must be 10 digits')
  .optional()
  .meta({
    description:
      'Optional. 10 digits (formatting such as "(555) 123-4567" is accepted and stripped); stored as 10 digits only. Empty clears it.',
  });

export const errorResponses = {
  400: {
    description: 'Request was malformed or failed validation.',
    content: { 'application/json': { schema: ErrorResponse } },
  },
  403: {
    description: "Caller lacks the required role, or their organization could not be resolved.",
    content: { 'application/json': { schema: ErrorResponse } },
  },
  404: {
    description: 'The requested record does not exist.',
    content: { 'application/json': { schema: ErrorResponse } },
  },
  500: {
    description: 'Unexpected server error.',
    content: { 'application/json': { schema: ErrorResponse } },
  },
} as const;

export type ErrorResponse = z.infer<typeof ErrorResponse>;
export type UserStatus = z.infer<typeof UserStatus>;
