import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { BroadcastIdPathParams, CreateBroadcastBody } from '@daltime/contracts';
import type { BroadcastListResponse, BroadcastResponse } from '@daltime/contracts';
import {
  ok,
  created,
  noContent,
  badRequest,
  setRequestOrigin,
  parseBody,
} from '../../shared/response.js';
import { mapHandlerError } from '../../shared/errors.js';
import { parseWithContract } from '../../shared/contract-validation.js';
import { requireWebAdminWithLookup } from '../../shared/auth.js';
import { withLogging } from '../../shared/with-logging.js';
import { createBroadcast, deleteBroadcast, listActiveBroadcasts } from './service.js';

/** Handle POST /web-admin/broadcasts — send a new broadcast. */
async function handlePost(rawBody: string | undefined, webAdminId: string) {
  const parsed = parseBody<Record<string, unknown>>(rawBody);
  if (!parsed.ok) return parsed.response;
  const body = parseWithContract(CreateBroadcastBody, parsed.data);
  return created<BroadcastResponse>(await createBroadcast(body, webAdminId));
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
    // Fail closed: Cognito WebAdmin group AND an ACTIVE WebAdmin record in DynamoDB.
    const caller = await requireWebAdminWithLookup(event);

    if (broadcastId === undefined) {
      if (method === 'GET') return ok<BroadcastListResponse>(await listActiveBroadcasts());
      if (method === 'POST') return await handlePost(event.body, caller.web_admin_id);
    } else if (method === 'DELETE') {
      const params = parseWithContract(BroadcastIdPathParams, { broadcastId });
      await deleteBroadcast(params.broadcastId, caller.web_admin_id);
      return noContent();
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'web-admin broadcasts handler');
  }
};

export const handler = withLogging(handleRequest, 'web-admin-broadcasts');
