import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { DismissBroadcastPathParams } from '@daltime/contracts';
import type { ActiveBroadcastListResponse, DismissBroadcastResponse } from '@daltime/contracts';
import { getCallerGroups, getCallerSub } from '../auth.js';
import { ok, badRequest, setRequestOrigin } from '../response.js';
import { ForbiddenError, mapHandlerError } from '../errors.js';
import { parseWithContract } from '../contract-validation.js';
import { withImpersonation } from '../impersonation.js';
import { withLogging } from '../with-logging.js';
import { dismissBroadcast, listActiveForCaller, type BroadcastRecipientRole } from './service.js';

/** First path segment → the role that route serves. */
const ROUTE_ROLE: Record<string, BroadcastRecipientRole> = {
  'web-admin': 'WebAdmin',
  'org-admin': 'OrgAdmin',
  manager: 'Manager',
  employee: 'Employee',
};

/**
 * The role this request is served as. The route prefix picks the role, and the
 * caller must actually hold it — otherwise an Employee could call
 * `/org-admin/broadcasts/active` and read OrgAdmin-only broadcasts in their org.
 * Under impersonation the groups are already the target's (see `withImpersonation`).
 */
function resolveRole(event: APIGatewayProxyEventV2WithJWTAuthorizer): BroadcastRecipientRole {
  const segment = event.rawPath.split('/').filter(Boolean)[0] ?? '';
  const role = ROUTE_ROLE[segment];
  if (!role || !getCallerGroups(event).includes(role)) {
    throw new ForbiddenError('Caller does not hold the role this route serves');
  }
  return role;
}

const handleRequest = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const broadcastId = event.pathParameters?.broadcastId;

  if (method === 'OPTIONS') {
    setRequestOrigin(event.headers?.['origin']);
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  try {
    const role = resolveRole(event);
    const callerSub = getCallerSub(event);

    if (method === 'GET' && broadcastId === undefined) {
      return ok<ActiveBroadcastListResponse>(await listActiveForCaller(callerSub, role));
    }
    if (method === 'PUT' && broadcastId !== undefined) {
      const params = parseWithContract(DismissBroadcastPathParams, { broadcastId });
      await dismissBroadcast(callerSub, role, params.broadcastId);
      return ok<DismissBroadcastResponse>({ success: true });
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'shared broadcasts handler');
  }
};

/** A WebAdmin may call the role routes as another user via `X-Impersonate-User` (read-only). */
export const handler = withLogging(withImpersonation(handleRequest), 'shared-broadcasts');
