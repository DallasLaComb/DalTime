import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { CreateManagerBody, UpdateManagerBody } from '../../shared/models/org-admin/manager.model.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  conflict,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  listManagers,
  createManager,
  updateManager,
  disableManager,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const managerId = event.pathParameters?.managerId;

  if (method === 'OPTIONS') {
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = event.requestContext?.authorizer?.jwt?.claims?.['sub'] as string ?? '';

  try {
    if (method === 'GET') {
      return ok(await listManagers(callerSub, cognitoClient));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: CreateManagerBody;
      try {
        body = JSON.parse(event.body) as CreateManagerBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createManager(callerSub, body, cognitoClient));
    }

    if (method === 'PUT') {
      if (!managerId) return badRequest('managerId path parameter is required');
      if (!event.body) return badRequest('Request body is required');
      let body: UpdateManagerBody;
      try {
        body = JSON.parse(event.body) as UpdateManagerBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await updateManager(callerSub, managerId, body, cognitoClient));
    }

    if (method === 'DELETE') {
      if (!managerId) return badRequest('managerId path parameter is required');
      await disableManager(callerSub, managerId, cognitoClient);
      return noContent();
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ConflictError) return conflict((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in managers handler:', err);
    return internalError('An unexpected error occurred');
  }
};
