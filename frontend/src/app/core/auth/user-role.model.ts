export type UserRole = 'WebAdmin' | 'OrgAdmin' | 'Manager' | 'Employee';

export const VALID_ROLES: readonly UserRole[] = [
  'WebAdmin',
  'OrgAdmin',
  'Manager',
  'Employee',
] as const;

export function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  WebAdmin: '/web-admin',
  OrgAdmin: '/org-admin',
  Manager: '/manager',
  Employee: '/employee',
};
