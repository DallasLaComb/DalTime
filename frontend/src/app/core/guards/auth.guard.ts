import { inject } from '@angular/core';
import { type CanMatchFn } from '@angular/router';
import { filter, first, switchMap, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth';

export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthService);

  return auth.authReady$.pipe(
    filter((ready) => ready),
    first(),
    switchMap(() => auth.isAuthenticated$),
    first(),
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        if (auth.isLoggedOut) {
          console.log('[AuthGuard] User logged out — skipping auto-login');
          return false;
        }
        console.log('[AuthGuard] Not authenticated — triggering login');
        auth.login();
        return false;
      }
      return true;
    }),
  );
};
