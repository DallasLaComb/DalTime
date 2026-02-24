/**
 * Core Organization entity stored in DynamoDB.
 *
 * Single-table keys:
 *   PK     = ORG#<org_id>
 *   SK     = METADATA
 *   GSI1PK = ORG
 *   GSI1SK = <created_at>
 */
export interface Organization {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
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
