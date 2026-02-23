/**
 * Core Organization entity stored in DynamoDB.
 * org_id is the partition key (UUID).
 */
export interface Organization {
  org_id: string;
  name: string;
  address: string;
  created_at: string;    // ISO 8601
  updated_at: string;    // ISO 8601
  org_admin_ids: string[];
}

/**
 * Fields accepted on POST /organizations body.
 */
export interface CreateOrganizationBody {
  name: string;
  address: string;
}

/**
 * Fields accepted on PUT /organizations/{orgId} body.
 * All fields optional — only provided fields are updated.
 */
export interface UpdateOrganizationBody {
  name?: string;
  address?: string;
}
