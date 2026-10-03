import { inject } from '@angular/core';
import { type CanMatchFn, type Route, Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { ImpersonationService } from '../services/impersonation.service';
import { ViewModeService } from '../services/view-mode.service';
import type { UserRole } from '../auth/user-role.model';

export const roleGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  const impersonation = inject(ImpersonationService);
  const viewMode = inject(ViewModeService);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] ?? []) as UserRole[];
  const role = auth.roleSignal();

  // Web admin can navigate to any route that belongs to the role they are impersonating.
  const viewingAs = impersonation.viewingAs();
  if (role === 'WebAdmin' && viewingAs && allowedRoles.includes(viewingAs.role)) {
    return true;
  }

  // An OrgAdmin has two separate views. Each route belongs to exactly one of them, so the
  // gate also keeps the feature sets apart: a page from the other view sends them home.
  if (role === 'OrgAdmin' && viewMode.canSwitch()) {
    const inManagerView = viewMode.managerMode();
    if (inManagerView && allowedRoles.includes('Manager')) return true;
    if (!inManagerView && allowedRoles.includes('OrgAdmin')) return true;
    if (allowedRoles.includes('Manager') || allowedRoles.includes('OrgAdmin')) {
      return router.createUrlTree([inManagerView ? '/manager' : '/org-admin']);
    }
    return router.createUrlTree(['/unauthorized']);
  }

  if (role && allowedRoles.includes(role)) return true;

  return router.createUrlTree(['/unauthorized']);
};
