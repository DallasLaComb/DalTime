import { stripKeys } from '../../shared/dynamo.js';
import type { WebAdminEmployeeResponse } from '../../shared/models/web-admin/employee.model.js';
import * as db from './db.js';

export async function listEmployees(): Promise<WebAdminEmployeeResponse[]> {
  const employees = await db.listAllEmployees();
  const stripped = employees.map(stripKeys);

  const uniqueOrgIds = [...new Set(stripped.map((e) => e.org_id))];
  const orgNames = await db.batchGetOrgNames(uniqueOrgIds);

  return stripped.map((e) => ({
    ...e,
    org_name: orgNames[e.org_id] ?? 'Unknown',
  }));
}
