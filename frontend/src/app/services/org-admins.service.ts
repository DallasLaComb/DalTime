import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { OrgAdminUserResponse, CreateOrgAdminBody } from '../core/models/org-admin-user.model';

@Injectable({ providedIn: 'root' })
export class OrgAdminsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/web-admin/organizations`;

  getAll(orgId: string): Observable<OrgAdminUserResponse[]> {
    return this.http.get<OrgAdminUserResponse[]>(`${this.baseUrl}/${orgId}/org-admins`);
  }

  create(orgId: string, body: CreateOrgAdminBody): Observable<OrgAdminUserResponse> {
    return this.http.post<OrgAdminUserResponse>(`${this.baseUrl}/${orgId}/org-admins`, body);
  }

  delete(orgId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${orgId}/org-admins/${userId}`);
  }
}
