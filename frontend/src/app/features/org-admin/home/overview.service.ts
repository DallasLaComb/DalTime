import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type ApiSchema } from '../../../core/api/api-client';

/** Types come from `contracts/openapi.json` via the generated `core/generated/api.d.ts`. */
export type OrgAdminOverview = ApiSchema<'OrgAdminOverviewResponse'>;
export type OrgAdminOverviewManager = ApiSchema<'OrgAdminOverviewManager'>;

@Injectable({ providedIn: 'root' })
export class OrgAdminOverviewService {
  private readonly api = inject(ApiClient);

  get(): Observable<OrgAdminOverview> {
    return this.api.get('/org-admin/overview');
  }
}
