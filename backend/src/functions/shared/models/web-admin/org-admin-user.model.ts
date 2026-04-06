/**
 * OrgAdmin user record stored in DynamoDB.
 *
 * Two records are written per user:
 *
 * Primary (scoped to org — supports listing by org):
 *   PK     = ORG#<org_id>
 *   SK     = USER#<user_sub>
 *   GSI1PK = ORG_ADMIN
 *   GSI1SK = <created_at>
 *
 * Reverse-lookup (supports GET/DELETE by userId alone):
 *   PK     = USER#<user_sub>
 *   SK     = METADATA
 *   org_id = <org_id>
 */
export interface OrgAdminUser {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  user_id: string;    // Cognito sub
  email: string;
  name: string;
  org_id: string;
  status: string;     // Cognito UserStatus e.g. FORCE_CHANGE_PASSWORD, CONFIRMED, DISABLED
  created_at: string; // ISO 8601
}

/**
 * Fields accepted on POST /web-admin/organizations/{orgId}/org-admins body.
 */
export interface CreateOrgAdminBody {
  email: string;
  name: string;
  temp_password: string;
}
