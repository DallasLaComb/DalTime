import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';

/**
 * Mock OidcSecurityService for unit tests — no real Cognito connections.
 */
const mockOidcSecurityService = {
  isAuthenticated$: of({ isAuthenticated: false }),
  userData$: of({ userData: null }),
  checkAuth: () => of({ isAuthenticated: false, userData: null, accessToken: '', idToken: '', errorMessage: '' }),
  authorize: () => {},
  logoff: () => of(undefined),
  logoffLocal: () => {},
};

/**
 * Shared mock providers for frontend unit tests.
 * Provides stubbed auth and an empty router — no real connections.
 */
export const APP_TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter([]),
  { provide: OidcSecurityService, useValue: mockOidcSecurityService },
];
