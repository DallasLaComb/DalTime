import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import type {
  OrgAdminUser,
  CreateOrgAdminBody,
} from '../../shared/models/web-admin/org-admin-user.model.js';
import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';
import * as orgDb from '../organizations/db.js';

export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}

const USER_POOL_ID = process.env['USER_POOL_ID']!;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listOrgAdmins(
  orgId: string,
  cognitoClient: CognitoIdentityProviderClient,
) {
  const items = await db.listOrgAdminsByOrg(orgId);
  const admins = items.map(stripKeys);

  const withStatus = await Promise.all(
    admins.map(async (admin) => {
      try {
        const user = await cognitoClient.send(
          new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: admin.email,
          }),
        );
        return { ...admin, status: user.UserStatus ?? admin.status };
      } catch {
        return admin;
      }
    }),
  );

  return withStatus;
}

export async function createOrgAdmin(
  orgId: string,
  body: CreateOrgAdminBody,
  cognitoClient: CognitoIdentityProviderClient,
) {
  if (!body.email?.trim()) throw new ValidationError('email is required');
  if (!EMAIL_REGEX.test(body.email.trim())) throw new ValidationError('email must be a valid email address');
  if (!body.name?.trim()) throw new ValidationError('name is required');
  if (!body.temp_password?.trim()) throw new ValidationError('temp_password is required');

  const org = await orgDb.getOrganizationById(orgId);
  if (!org) throw new NotFoundError(`Organization '${orgId}' not found`);

  let userSub: string;
  try {
    const createResult = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: body.email.trim(),
        TemporaryPassword: body.temp_password,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'name', Value: body.name.trim() },
          { Name: 'email', Value: body.email.trim() },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:org_id', Value: orgId },
        ],
      }),
    );
    userSub = createResult.User!.Attributes!.find((a) => a.Name === 'sub')!.Value!;
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      throw new ConflictError('A user with this email already exists');
    }
    if (err instanceof InvalidPasswordException) {
      throw new ValidationError((err as Error).message);
    }
    throw err;
  }

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email.trim(),
      GroupName: 'OrgAdmin',
    }),
  );

  const now = new Date().toISOString();
  const user: OrgAdminUser = {
    PK: `ORG#${orgId}`,
    SK: `USER#${userSub}`,
    GSI1PK: 'ORG_ADMIN',
    GSI1SK: now,
    user_id: userSub,
    email: body.email.trim(),
    name: body.name.trim(),
    org_id: orgId,
    status: 'FORCE_CHANGE_PASSWORD',
    created_at: now,
  };

  await db.createOrgAdminUser(user);
  await db.incrementOrgAdminCount(orgId);

  return stripKeys(user);
}

export async function deleteOrgAdmin(
  orgId: string,
  userId: string,
  cognitoClient: CognitoIdentityProviderClient,
) {
  const lookup = await db.getOrgAdminReverseLookup(userId);
  if (!lookup) throw new NotFoundError(`User '${userId}' not found`);

  await cognitoClient.send(
    new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: lookup.email,
    }),
  );

  await db.deleteOrgAdminUser(orgId, userId);
  await db.decrementOrgAdminCount(orgId);
}
