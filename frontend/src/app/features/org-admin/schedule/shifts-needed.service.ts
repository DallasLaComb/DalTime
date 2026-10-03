import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type ApiSchema } from '../../../core/api/api-client';

/**
 * Types come from `contracts/openapi.json` via the generated `core/generated/api.d.ts`.
 * Read-only: managers create and edit shifts-needed (`/manager/shifts-needed`).
 */
export type OrgAdminShiftNeeded = ApiSchema<'OrgAdminShiftNeededResponse'>;

@Injectable({ providedIn: 'root' })
export class OrgAdminShiftsNeededService {
  private readonly api = inject(ApiClient);

  list(month: string): Observable<OrgAdminShiftNeeded[]> {
    return this.api.get('/org-admin/shifts-needed', { query: { month } });
  }
}
