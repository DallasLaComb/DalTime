import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ManagerResponse,
  CreateManagerBody,
  UpdateManagerBody,
} from '../../../core/models/manager.model';

@Injectable({ providedIn: 'root' })
export class ManagersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/org-admin/managers`;

  getAll(): Observable<ManagerResponse[]> {
    return this.http.get<ManagerResponse[]>(this.baseUrl);
  }

  create(body: CreateManagerBody): Observable<ManagerResponse> {
    return this.http.post<ManagerResponse>(this.baseUrl, body);
  }

  update(managerId: string, body: UpdateManagerBody): Observable<ManagerResponse> {
    return this.http.put<ManagerResponse>(`${this.baseUrl}/${managerId}`, body);
  }

  disable(managerId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${managerId}`);
  }
}
