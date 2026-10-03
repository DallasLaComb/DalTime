import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { type OrgAdminShiftNeededResponse, OrgAdminShiftsNeededQuery } from '@daltime/contracts';
import { getCallerSub } from '../../shared/auth.js';
import { parseWithContract } from '../../shared/contract-validation.js';
import { mapHandlerError } from '../../shared/errors.js';
import { methodNotAllowed, ok, setRequestOrigin } from '../../shared/response.js';
import { withImpersonation } from '../../shared/impersonation.js';
import { withLogging } from '../../shared/with-logging.js';
import { withRequiredGroup } from '../../shared/require-group.js';
import * as service from './service.js';

/**
 * Org-wide shifts-needed list for the org-admin's read-only schedule oversight. Read-only by
 * design (shifts needed are created and edited by managers); any non-GET answers 405.
 */
const handleRequest = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  setRequestOrigin(event.headers?.['origin']);
  if (method === 'OPTIONS') return ok('');
  if (method !== 'GET') return methodNotAllowed(method);

  try {
    const callerSub = getCallerSub(event);
    const { month } = parseWithContract(
      OrgAdminShiftsNeededQuery,
      event.queryStringParameters ?? {},
    );
    return ok<OrgAdminShiftNeededResponse[]>(await service.listShiftsNeeded(callerSub, month));
  } catch (err) {
    return mapHandlerError(err, 'org-admin shifts-needed handler');
  }
};

/** A WebAdmin may call this route as another user via `X-Impersonate-User` (read-only). */
export const handler = withLogging(
  withImpersonation(
    withRequiredGroup(handleRequest, 'OrgAdmin', 'org-admin shifts-needed handler'),
  ),
  'org-admin-shifts-needed',
);
