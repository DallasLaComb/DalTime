import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // OIDC callback — public, renders while checkAuth() processes the authorization code
  {
    path: 'sso',
    loadComponent: () =>
      import('./features/auth/callback.component').then((m) => m.CallbackComponent),
  },

  // Unauthorized — public, shows access denied with role info
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },

  // Role-protected dashboards
  {
    path: 'web-admin',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/web-admin.component').then((m) => m.WebAdminComponent),
  },
  {
    path: 'org-admin',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/org-admin.component').then((m) => m.OrgAdminComponent),
  },
  {
    path: 'manager',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/manager.component').then((m) => m.ManagerComponent),
  },
  {
    path: 'employee',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/employee.component').then((m) => m.EmployeeComponent),
  },

  // Root: authGuard triggers login for unauthenticated users;
  // authenticated users are navigated to their role dashboard by AuthService.initialize()
  {
    path: '',
    pathMatch: 'full',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/auth/callback.component').then((m) => m.CallbackComponent),
  },

  // Wildcard fallback
  { path: '**', redirectTo: '' },
];
