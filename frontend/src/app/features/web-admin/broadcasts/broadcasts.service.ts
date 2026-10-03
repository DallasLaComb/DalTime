import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type ApiSchema } from '../../../core/api/api-client';

export type Broadcast = ApiSchema<'BroadcastResponse'>;
export type CreateBroadcastBody = ApiSchema<'CreateBroadcastBody'>;

/** WebAdmin management of banner broadcasts — `backend/src/functions/web-admin/broadcasts`. */
@Injectable({ providedIn: 'root' })
export class WebAdminBroadcastsService {
  private readonly api = inject(ApiClient);

  /** POST /web-admin/broadcasts */
  create(body: CreateBroadcastBody): Observable<Broadcast> {
    return this.api.post('/web-admin/broadcasts', body);
  }

  /** GET /web-admin/broadcasts — active broadcasts, soonest-expiring first. */
  listActive(): Observable<Broadcast[]> {
    return this.api.get('/web-admin/broadcasts');
  }

  /** DELETE /web-admin/broadcasts/{broadcastId} — take a broadcast down now. */
  remove(broadcastId: string): Observable<void> {
    return this.api.delete('/web-admin/broadcasts/{broadcastId}', { params: { broadcastId } });
  }
}
