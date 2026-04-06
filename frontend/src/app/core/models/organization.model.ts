export interface Organization {
  org_id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
  org_admin_count: number;
}

export interface CreateOrganizationBody {
  name: string;
  address: string;
}

export interface UpdateOrganizationBody {
  name?: string;
  address?: string;
}
