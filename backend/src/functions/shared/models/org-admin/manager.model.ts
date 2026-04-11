/**
 * Manager record stored in DynamoDB.
 *
 * Two records are written per manager:
 *
 * Primary (scoped to org — supports listing by org):
 *   PK     = ORG#<org_id>
 *   SK     = MANAGER#<manager_id>
 *   GSI1PK = MANAGER
 *   GSI1SK = <created_at>
 *
 * Reverse-lookup (supports GET/PUT/DELETE by managerId alone):
 *   PK     = USER#<manager_id>
 *   SK     = METADATA
 *   org_id = <org_id>
 */
export interface Manager {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  manager_id: string;     // Cognito sub
  first_name: string;
  last_name: string;
  email: string;
  phone: string;          // empty string if not provided
  org_id: string;
  org_admin_id: string;   // OrgAdmin who created this manager
  status: string;         // Cognito UserStatus
  employee_count: number; // atomic counter, managed by employees Lambda
  created_at: string;     // ISO 8601
  updated_at: string;     // ISO 8601
}

/** Fields accepted on POST /org-admin/managers body. */
export interface CreateManagerBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  temp_password: string;
}

/** Fields accepted on PUT /org-admin/managers/{managerId} body. */
export interface UpdateManagerBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}
