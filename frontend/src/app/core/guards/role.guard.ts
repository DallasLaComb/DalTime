import { inject } from '@angular/core';
import { type CanMatchFn, type Route, Router } from '@angular/router';
import { filter, first, map, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth';
import type { UserRole } from '../auth/user-role.model';

export const roleGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] ?? []) as UserRole[];

  return auth.role$.pipe(
    filter((role): role is UserRole => role !== null),
    first(),
    timeout(5000),
    map((role) => {
      if (allowedRoles.includes(role)) {
        return true;
      }
      return router.createUrlTree(['/unauthorized']);
    }),
    catchError(() => of(router.createUrlTree(['/unauthorized']))),
  );
};
