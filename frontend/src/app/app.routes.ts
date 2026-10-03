import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Public auth pages
  {
    path: 'login',
    loadComponent: () => import('./core/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./core/auth/change-password/change-password').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./core/auth/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
  },

  // Unauthorized — public, shows access denied with role info
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./shared/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },

  // Role-protected dashboards
  {
    path: 'web-admin/impersonate',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/impersonate/impersonate').then((m) => m.ImpersonateComponent),
  },
  {
    path: 'web-admin/broadcasts',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/broadcasts/broadcasts').then(
        (m) => m.WebAdminBroadcastsComponent,
      ),
  },
  {
    path: 'web-admin/employees',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/employees/employees').then((m) => m.WebAdminEmployeesComponent),
  },
  {
    path: 'web-admin/organizations/:orgId/org-admins',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/org-admins/org-admins').then((m) => m.OrgAdminsComponent),
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
    path: 'web-admin/profile',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['WebAdmin'] as const },
    loadComponent: () =>
      import('./features/web-admin/profile/profile').then((m) => m.WebAdminProfileComponent),
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
    path: 'org-admin/employees',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/employees/employees').then((m) => m.EmployeesComponent),
  },
  {
    path: 'org-admin/organization',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/organization/organization').then(
        (m) => m.OrgAdminOrganizationComponent,
      ),
  },
  {
    path: 'org-admin/profile',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/profile/profile').then((m) => m.OrgAdminProfileComponent),
  },
  {
    path: 'org-admin/managers',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/managers/managers').then((m) => m.ManagersComponent),
  },
  {
    path: 'org-admin/locations',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/locations/locations').then((m) => m.OrgAdminLocationsComponent),
  },
  {
    path: 'org-admin/schedule',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () =>
      import('./features/org-admin/schedule/schedule').then((m) => m.OrgAdminSchedule),
  },
  {
    path: 'org-admin',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['OrgAdmin'] as const },
    loadComponent: () => import('./features/org-admin/home/home').then((m) => m.OrgAdminHome),
  },
  {
    path: 'manager/employees',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/employees/employees').then((m) => m.ManagerEmployeesComponent),
  },
  {
    path: 'manager/profile',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/profile/profile').then((m) => m.ManagerProfileComponent),
  },
  {
    path: 'manager/shifts-needed',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/shifts-needed/shifts-needed').then(
        (m) => m.ManagerShiftsNeededComponent,
      ),
  },
  {
    path: 'manager',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Manager'] as const },
    loadComponent: () =>
      import('./features/manager/schedule/schedule').then((m) => m.ManagerSchedule),
  },
  {
    path: 'employee/schedule',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/schedule/schedule').then((m) => m.EmployeeScheduleComponent),
  },
  {
    path: 'employee/profile',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/profile/profile').then((m) => m.EmployeeProfileComponent),
  },
  {
    path: 'employee/availability',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/availability/availability').then(
        (m) => m.EmployeeAvailabilityComponent,
      ),
  },
  {
    path: 'employee/swap-shifts',
    canMatch: [authGuard, roleGuard],
    data: { roles: ['Employee'] as const },
    loadComponent: () =>
      import('./features/employee/swap-shifts/swap-shifts').then((m) => m.SwapShiftsComponent),
  },
  // Redirect bare /employee to /employee/schedule so the schedule view is the default landing page.
  // Guards are NOT placed here (NG04014: canMatch and redirectTo cannot coexist on the same route).
  // Auth and role enforcement is handled by the guards on the destination employee/schedule route.
  {
    path: 'employee',
    redirectTo: 'employee/schedule',
    pathMatch: 'full',
  },

  // Shared cross-role pages — accessible to all authenticated roles
  {
    path: 'notifications',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./shared/notifications/notifications-page').then((m) => m.NotificationsPageComponent),
  },

  // Public info pages
  {
    path: 'help',
    loadComponent: () => import('./shared/help/help').then((m) => m.HelpComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./shared/contact/contact').then((m) => m.ContactComponent),
  },
  {
    path: 'cookies',
    loadComponent: () => import('./shared/cookies/cookies').then((m) => m.CookiesComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./shared/terms/terms').then((m) => m.TermsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./shared/privacy/privacy').then((m) => m.PrivacyComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./shared/about/about').then((m) => m.AboutComponent),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./shared/pricing/pricing').then((m) => m.PricingComponent),
  },

  // Home — public landing page; authenticated users are redirected by AuthService.initialize()
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./shared/home/home').then((m) => m.HomeComponent),
  },

  // 404 — catch-all for unknown routes
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
