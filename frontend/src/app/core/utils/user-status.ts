export const USER_STATUS_COLOR_MAP: Record<string, string> = {
  CONFIRMED: 'badge-dt-success',
  DISABLED: 'badge-dt-secondary',
  FORCE_CHANGE_PASSWORD: 'badge-dt-warning', // NOSONAR: key is a Cognito status name, not a password
};

export function getUserStatusLabel(status: string): string {
  if (status === 'CONFIRMED') return 'Active';
  if (status === 'DISABLED') return 'Disabled';
  return 'Pending';
}
