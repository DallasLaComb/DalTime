import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth';

export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.authReady()) return false;

  if (auth.isAuthenticatedSignal()) return true;

  return router.createUrlTree(['/login']);
};
