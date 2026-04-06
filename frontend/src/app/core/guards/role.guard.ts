import { inject } from '@angular/core';
import { type CanMatchFn, type Route, Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import type { UserRole } from '../auth/user-role.model';

export const roleGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] ?? []) as UserRole[];
  const role = auth.roleSignal();

  if (role && allowedRoles.includes(role)) return true;

  return router.createUrlTree(['/unauthorized']);
};
