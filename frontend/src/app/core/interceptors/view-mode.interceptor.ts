import { inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ViewModeService } from '../services/view-mode.service';

/**
 * While an OrgAdmin is in Manager view, adds `X-View-As: manager` to `/manager/*` requests so the
 * backend (`withManagerView`) lets them act as a manager. Every other request is left alone, and
 * the backend ignores the header from anyone who is not an OrgAdmin.
 */
export const viewModeInterceptor: HttpInterceptorFn = (req, next) => {
  const viewMode = inject(ViewModeService);

  if (!viewMode.managerMode() || !req.url.startsWith(environment.api.baseUrl)) return next(req);

  const path = req.url.slice(environment.api.baseUrl.length);
  if (!path.startsWith('/manager/')) return next(req);

  return next(req.clone({ setHeaders: { 'X-View-As': 'manager' } }));
};
