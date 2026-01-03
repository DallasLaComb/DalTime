import { Routes } from '@angular/router';

export const routes: Routes = [
  // SSO callback route - required for OIDC flow
  { path: 'sso', redirectTo: '', pathMatch: 'full' },
  { path: 'unauthorized', redirectTo: '', pathMatch: 'full' },
  { path: '', pathMatch: 'full', redirectTo: '' },
];
