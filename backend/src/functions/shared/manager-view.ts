import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerGroups, decodeLocalJwtPayload } from './auth.js';

/**
 * "View as manager": an OrgAdmin can switch into a Manager view of the app and back.
 *
 * The frontend adds `X-View-As: manager` to `/manager/*` requests while that view is active.
 * This wrapper honours it ONLY when the verified JWT says the caller is an OrgAdmin; it then
 * hands the manager handler an event whose groups are `['Manager']` (and records the real role
 * as `act_role`). The caller's `sub` is unchanged, so they act as a manager whose id is their
 * own — the same id their employees, shifts and templates are keyed under (see `getMetadataRecord`).
 *
 * Without the header, or from anyone who is not an OrgAdmin, the event passes through untouched
 * and the handler's `withRequiredGroup('Manager')` answers 403. It cannot widen anyone's access:
 * a Manager, Employee or WebAdmin sending the header gets nothing extra.
 */
export const VIEW_AS_HEADER = 'x-view-as';

type Handler<R> = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<R>;

function readViewAsHeader(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (name.toLowerCase() === VIEW_AS_HEADER) return value;
  }
  return undefined;
}

export function withManagerView<R>(inner: Handler<R>): Handler<R> {
  return async (event) => {
    const isManagerRoute = event.rawPath?.split('/').filter(Boolean)[0] === 'manager';
    const wantsManagerView = readViewAsHeader(event)?.trim().toLowerCase() === 'manager';
    const groups = getCallerGroups(event);

    if (!isManagerRoute || !wantsManagerView || !groups.includes('OrgAdmin')) return inner(event);

    // Deployed: claims come from API Gateway's authorizer. SAM local has none, so fall back to
    // the decoded Authorization header (same fallback `getCallerSub` uses).
    const existing = event.requestContext?.authorizer?.jwt?.claims;
    const claims =
      existing ??
      decodeLocalJwtPayload(
        event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '',
      ) ??
      {};

    const { [VIEW_AS_HEADER]: _drop, ...headers } = event.headers ?? {};
    void _drop;

    return inner({
      ...event,
      headers,
      requestContext: {
        ...event.requestContext,
        authorizer: {
          ...event.requestContext?.authorizer,
          jwt: {
            scopes: event.requestContext?.authorizer?.jwt?.scopes ?? null,
            claims: { ...claims, 'cognito:groups': ['Manager'], act_role: 'OrgAdmin' },
          },
        },
      },
    });
  };
}
