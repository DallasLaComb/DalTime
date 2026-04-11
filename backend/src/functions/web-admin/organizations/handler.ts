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
  const method = event.requestContext.http.method;
  const orgId = event.pathParameters?.orgId;

  if (method === 'OPTIONS') {
    return ok('');
  }

  try {
    if (method === 'GET' && !orgId) {
      return ok(await listOrganizations());
    }

    if (method === 'POST' && !orgId) {
      if (!event.body) return badRequest('Request body is required');
      let body: CreateOrganizationBody;
      try {
        body = JSON.parse(event.body) as CreateOrganizationBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createOrganization(body));
    }

    if (method === 'GET' && orgId) {
      const org = await getOrganization(orgId);
      return org ? ok(org) : notFound(`Organization '${orgId}' not found`);
    }

    if (method === 'PUT' && orgId) {
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

    if (method === 'DELETE' && orgId) {
      const deleted = await deleteOrganization(orgId);
      return deleted ? noContent() : notFound(`Organization '${orgId}' not found`);
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    console.error('Unhandled error in organizations handler:', error);
    return internalError('An unexpected error occurred');
  }
};
