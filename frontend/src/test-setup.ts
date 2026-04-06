import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from './app/core/auth/auth';

const mockAuthService = {
  isAuthenticatedSignal: () => false,
  roleSignal: () => null,
  authReady: () => true,
  accessToken: null,
  idToken: null,
  orgId: signal(null),
  hasPendingChallenge: false,
  initialize: () => {},
  login: async () => ({ success: false }),
  completeNewPassword: async () => ({ success: false }),
  logout: () => {},
  getAccessToken: () => null,
  getUserAttributes: async () => {},
  updateUserAttribute: async () => false,
  routeToDashboardForRole: () => '/',
};

/**
 * Shared mock providers for frontend unit tests.
 * Provides stubbed auth and an empty router — no real connections.
 */
export const APP_TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideRouter([]),
  { provide: AuthService, useValue: mockAuthService },
];
