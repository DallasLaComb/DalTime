export interface ManagerResponse {
  manager_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_admin_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateManagerBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  temp_password: string;
}

export interface UpdateManagerBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}
