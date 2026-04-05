import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type {
  CreateOrganizationBody,
  UpdateOrganizationBody,
} from '../../shared/models/web-admin/organization.model.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  internalError,
} from '../../shared/response.js';
import { ValidationError, listOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const routeKey = event.routeKey;
  const orgId = event.pathParameters?.orgId;

  console.log('routeKey:', routeKey, '| orgId:', orgId);

  if (event.requestContext.http.method === 'OPTIONS') {
    return ok('');
  }

  try {
    if (routeKey === 'GET /organizations') {
      return ok(await listOrganizations());
    }

    if (routeKey === 'POST /organizations') {
      if (!event.body) return badRequest('Request body is required');
      let body: CreateOrganizationBody;
      try {
        body = JSON.parse(event.body) as CreateOrganizationBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createOrganization(body));
    }

    if (routeKey === 'GET /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');
      const org = await getOrganization(orgId);
      return org ? ok(org) : notFound(`Organization '${orgId}' not found`);
    }

    if (routeKey === 'PUT /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');
      if (!event.body) return badRequest('Request body is required');
      let body: UpdateOrganizationBody;
      try {
        body = JSON.parse(event.body) as UpdateOrganizationBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      const org = await updateOrganization(orgId, body);
      return org ? ok(org) : notFound(`Organization '${orgId}' not found`);
    }

    if (routeKey === 'DELETE /organizations/{orgId}') {
      if (!orgId) return badRequest('orgId path parameter is required');
      const deleted = await deleteOrganization(orgId);
      return deleted ? noContent() : notFound(`Organization '${orgId}' not found`);
    }

    return badRequest(`Unhandled route: ${routeKey}`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    console.error('Unhandled error in organizations handler:', error);
    return internalError('An unexpected error occurred');
  }
};
