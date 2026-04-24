import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { CreateOrgAdminBody } from '../../shared/models/web-admin/org-admin-user.model.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  conflict,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  listOrgAdmins,
  createOrgAdmin,
  deleteOrgAdmin,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const orgId = event.pathParameters?.orgId;
  const userId = event.pathParameters?.userId;

  if (method === 'OPTIONS') {
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  if (!orgId) return badRequest('orgId path parameter is required');

  try {
    if (method === 'GET') {
      return ok(await listOrgAdmins(orgId, cognitoClient));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: CreateOrgAdminBody;
      try {
        body = JSON.parse(event.body) as CreateOrgAdminBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createOrgAdmin(orgId, body, cognitoClient));
    }

    if (method === 'DELETE') {
      if (!userId) return badRequest('userId path parameter is required');
      await deleteOrgAdmin(orgId, userId, cognitoClient);
      return noContent();
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ConflictError) return conflict((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    console.error('Unhandled error in org-admins handler:', err);
    return internalError('An unexpected error occurred');
  }
};
