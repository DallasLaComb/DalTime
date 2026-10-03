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

// Maps each role to its "home" base path.  This value is used by the navbar's
// profileRoute computed property as `${ROLE_DASHBOARD_MAP[r]}/profile`, so it
// must remain the role's base segment — NOT the concrete landing page.
// For Employee the landing page is /employee/schedule (via a redirectTo in
// app.routes.ts), but profileRoute must resolve to /employee/profile, which
// requires the base to stay as /employee.  Do not change Employee to
// /employee/schedule here.
export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  WebAdmin: '/web-admin',
  OrgAdmin: '/org-admin',
  Manager: '/manager',
  Employee: '/employee',
};

/** Human-readable role names for display (never show the raw enum value to users). */
export const ROLE_LABEL_MAP: Record<UserRole, string> = {
  WebAdmin: 'Web Admin',
  OrgAdmin: 'Organization Admin',
  Manager: 'Manager',
  Employee: 'Employee',
};
