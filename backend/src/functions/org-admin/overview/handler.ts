import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { OrgAdminOverviewResponse } from '@daltime/contracts';
import { getCallerSub } from '../../shared/auth.js';
import { ok, badRequest, setRequestOrigin } from '../../shared/response.js';
import { mapHandlerError } from '../../shared/errors.js';
import { withImpersonation } from '../../shared/impersonation.js';
import { withLogging } from '../../shared/with-logging.js';
import { withRequiredGroup } from '../../shared/require-group.js';
import { getOverview } from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

const handleRequest = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  setRequestOrigin(event.headers?.['origin']);
  if (method === 'OPTIONS') return ok('');

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET')
      return ok<OrgAdminOverviewResponse>(await getOverview(callerSub, undefined, cognitoClient));
    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'org-admin overview handler');
  }
};

/** A WebAdmin may call this route as another user via `X-Impersonate-User` (read-only). */
export const handler = withLogging(
  withImpersonation(withRequiredGroup(handleRequest, 'OrgAdmin', 'org-admin overview handler')),
  'org-admin-overview',
);
