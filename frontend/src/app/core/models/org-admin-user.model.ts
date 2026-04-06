export interface OrgAdminUserResponse {
  user_id: string;
  email: string;
  name: string;
  org_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  created_at: string;
}

export interface CreateOrgAdminBody {
  email: string;
  name: string;
  temp_password: string;
}
