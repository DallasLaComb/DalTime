import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth';

export const authGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for initialize() to complete on page refresh
  while (!auth.authReady()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (auth.isAuthenticatedSignal()) return true;

  return router.createUrlTree(['/login']);
};
