import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  Organization,
  CreateOrganizationBody,
  UpdateOrganizationBody,
} from '../core/models/organization.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/organizations`;

  getAll(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.baseUrl);
  }

  getById(orgId: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/${orgId}`);
  }

  create(body: CreateOrganizationBody): Observable<Organization> {
    return this.http.post<Organization>(this.baseUrl, body);
  }

  update(orgId: string, body: UpdateOrganizationBody): Observable<Organization> {
    return this.http.put<Organization>(`${this.baseUrl}/${orgId}`, body);
  }

  delete(orgId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${orgId}`);
  }
}
