import { inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.api.baseUrl)) {
    return next(req);
  }

  const token = inject(AuthService).getAccessToken();
  if (!token) return next(req);

  return next(req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  }));
};
