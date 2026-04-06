import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // OIDC callback — public, renders while checkAuth() processes the authorization code
  {
    path: 'sso',
    loadComponent: () => import('./core/auth/callback.component').then((m) => m.CallbackComponent),
  },

  // Unauthorized — public, shows access denied with role info
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./shared/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },

  // Role-protected dashboards
  {
    path: 'web-admin/organizations/:orgId/org-admins',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/org-admins/org-admins').then(
        (m) => m.OrgAdminsComponent,
      ),
  },
  {
    path: 'web-admin/organizations',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/organizations/organizations').then(
        (m) => m.OrganizationsComponent,
      ),
  },
  {
    path: 'web-admin',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/web-admin-dashboard/web-admin-dashboard').then(
        (m) => m.WebAdminDashboard,
      ),
  },
  {
    path: 'org-admin',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/org-admin-dashboard/org-admin-dashboard').then(
        (m) => m.OrgAdminDashboard,
      ),
  },
  {
    path: 'manager',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/manager-dashboard/manager-dashboard').then(
        (m) => m.ManagerDashboard,
      ),
  },
  {
    path: 'employee',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/employee-dashboard/employee-dashboard').then(
        (m) => m.EmployeeDashboard,
      ),
  },

  // Root: authGuard triggers login for unauthenticated users;
  // authenticated users are navigated to their role dashboard by AuthService.initialize()
  {
    path: '',
    pathMatch: 'full',
    canMatch: [authGuard],
    loadComponent: () => import('./core/auth/callback.component').then((m) => m.CallbackComponent),
  },

  // 404 — catch-all for unknown routes
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
