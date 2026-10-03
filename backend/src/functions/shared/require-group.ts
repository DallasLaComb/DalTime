import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getCallerGroups } from './auth.js';
import { ForbiddenError, mapHandlerError } from './errors.js';
import { setRequestOrigin } from './response.js';

type Handler = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<APIGatewayProxyResultV2>;

/**
 * Rejects callers whose JWT lacks `group` with a 403 before the wrapped handler runs.
 *
 * The API Gateway JWT authorizer only proves the token is valid for the user pool — it
 * does not check group membership — so a role-scoped route (e.g. `/org-admin/*`, which
 * operates org-wide) must enforce its own group. OPTIONS preflight is passed through
 * untouched (it carries no credentials).
 */
export function withRequiredGroup(inner: Handler, group: string, context: string): Handler {
  return async (event) => {
    if (event.requestContext.http.method === 'OPTIONS') return inner(event);
    if (!getCallerGroups(event).includes(group)) {
      setRequestOrigin(event.headers?.['origin']);
      return mapHandlerError(new ForbiddenError(`${group} role required`), context);
    }
    return inner(event);
  };
}
