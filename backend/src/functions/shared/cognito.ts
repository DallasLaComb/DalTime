import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConflictError, ValidationError } from './errors.js';

const USER_POOL_ID = process.env['USER_POOL_ID']!;

/**
 * For each item, attempt to fetch the current Cognito UserStatus and merge it into the record.
 * On any Cognito error the original item is returned unchanged.
 */
export async function enrichWithCognitoStatus<T extends { email: string; status: string }>(
  items: T[],
  cognitoClient: CognitoIdentityProviderClient,
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const user = await cognitoClient.send(
          new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: item.email }),
        );
        // UserStatus (CONFIRMED etc.) says nothing about the enabled flag — a disabled user is still CONFIRMED.
        if (user.Enabled === false) return { ...item, status: 'DISABLED' };
        return { ...item, status: user.UserStatus ?? item.status };
      } catch {
        return item;
      }
    }),
  );
}

/**
 * Create a Cognito user for an employee, add them to the Employee group, and return their sub.
 * Throws ConflictError on duplicate email, ValidationError on bad password.
 */
export async function createCognitoEmployee(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
  firstName: string,
  lastName: string,
  tempPassword: string,
  orgId: string,
): Promise<string> {
  let employeeSub: string;
  try {
    const createResult = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'name', Value: `${firstName} ${lastName}` },
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:org_id', Value: orgId },
        ],
      }),
    );
    employeeSub = createResult.User!.Attributes!.find((a) => a.Name === 'sub')!.Value!;
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
      Username: email,
      GroupName: 'Employee',
    }),
  );

  return employeeSub;
}

/**
 * Disable a Cognito user by email.
 */
export async function adminDisableUser(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
): Promise<void> {
  await cognitoClient.send(
    new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  );
}

/**
 * Emails (lower-cased) of every user in the pool who has not yet set a password
 * (`cognito:user_status = FORCE_CHANGE_PASSWORD`). One filtered, paginated `ListUsers` instead of an
 * `AdminGetUser` per person; the caller intersects it with the org's own people. Cognito, not the
 * stored record, is the source of truth — nothing updates the stored status when a password is set.
 */
export async function listPendingEmails(
  cognitoClient: CognitoIdentityProviderClient,
): Promise<Set<string>> {
  const emails = new Set<string>();
  let token: string | undefined;
  do {
    const page = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: 'cognito:user_status = "FORCE_CHANGE_PASSWORD"',
        PaginationToken: token,
      }),
    );
    for (const u of page.Users ?? []) {
      const email = u.Attributes?.find((a) => a.Name === 'email')?.Value;
      if (email) emails.add(email.toLowerCase());
    }
    token = page.PaginationToken;
  } while (token);
  return emails;
}

/**
 * Enable (re-activate) a Cognito user by email.
 */
export async function adminEnableUser(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
): Promise<'FORCE_CHANGE_PASSWORD' | 'CONFIRMED'> {
  await cognitoClient.send(
    new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  );
  // Re-enabling must not make someone who never set a password look like they did: report the
  // real Cognito state so the stored status (and the "not set a password" count) stays truthful.
  try {
    const user = await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    );
    return user.UserStatus === 'FORCE_CHANGE_PASSWORD' ? 'FORCE_CHANGE_PASSWORD' : 'CONFIRMED';
  } catch {
    return 'CONFIRMED';
  }
}

/**
 * Fetch a single item's Cognito UserStatus and merge it into the record.
 * On any Cognito error the original item is returned unchanged.
 */
export async function enrichSingleWithCognitoStatus<T extends { email: string; status: string }>(
  item: T,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<T> {
  try {
    const user = await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: item.email }),
    );
    // UserStatus (CONFIRMED etc.) says nothing about the enabled flag — a disabled user is still CONFIRMED.
    if (user.Enabled === false) return { ...item, status: 'DISABLED' };
    return { ...item, status: user.UserStatus ?? item.status };
  } catch {
    return item;
  }
}
