import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { type UserRole, isValidRole, ROLE_DASHBOARD_MAP } from './user-role.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly router = inject(Router);

  // No AWS credentials needed — GetUser/UpdateUserAttributes are authorized by the access token's
  // aws.cognito.signin.user.admin scope, not by IAM credentials
  private readonly cognitoClient = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });

  // --- Reactive state ---
  private readonly _authReady$ = new BehaviorSubject<boolean>(false);
  private readonly _role$ = new BehaviorSubject<UserRole | null>(null);

  /** Emits true once checkAuth() has resolved (both success and failure). */
  readonly authReady$ = this._authReady$.asObservable();

  /** Observable of current authentication state. */
  readonly isAuthenticated$ = this.oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => isAuthenticated),
  );

  /** Observable of user claims/profile from the OIDC library. */
  readonly user$ = this.oidcSecurityService.userData$.pipe(map((r) => r.userData));

  /** Observable of the derived UserRole (null until auth resolves). */
  readonly role$ = this._role$.asObservable();

  // --- Signals for template binding ---
  readonly isAuthenticatedSignal = toSignal(this.isAuthenticated$, { initialValue: false });
  readonly userSignal = toSignal(this.user$, { initialValue: null });
  readonly roleSignal = toSignal(this.role$, { initialValue: null });

  // --- Scalar state (used by Cognito SDK calls) ---
  accessToken: string | null = null;
  idToken: string | null = null;
  orgId: string | null = null;

  /** True after explicit logout — prevents authGuard from auto-triggering login. */
  private _loggedOut = false;

  /** Whether the user explicitly logged out (checked by authGuard). */
  get isLoggedOut(): boolean {
    return this._loggedOut;
  }

  initialize(): void {
    // checkAuth() detects code+state params in the URL automatically and exchanges for tokens.
    // No manual code detection needed — the OIDC library handles the entire callback flow.
    this.oidcSecurityService.checkAuth().subscribe((loginResponse) => {
      console.log('Login Response:', loginResponse);

      if (loginResponse.errorMessage) {
        console.error('Authentication Error:', loginResponse.errorMessage);
      }

      if (loginResponse.isAuthenticated) {
        this.accessToken = loginResponse.accessToken;
        this.idToken = loginResponse.idToken;

        // Derive role from custom:user_type (or user_type fallback) on ID token claims
        const role = this.extractUserRole(loginResponse.userData);
        this._role$.next(role);

        // Debug: log token_use for both ID and access tokens, plus access token scope
        this.debugTokens(loginResponse.accessToken, loginResponse.idToken);

        // Verify access token has the required scope before calling Cognito APIs
        this.verifyTokenScopes(loginResponse.accessToken);

        this.getUserAttributes();

        // Clean code/state params from URL after successful auth callback
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Navigate to role dashboard if currently on a callback/root path
        const currentPath = window.location.pathname;
        if (role && ['/', '/sso'].includes(currentPath)) {
          this.router.navigate([ROLE_DASHBOARD_MAP[role]]);
        }
      }

      // Gate opens for guards — must fire in both authenticated and unauthenticated branches
      this._authReady$.next(true);
    });
  }

  login(): void {
    console.log('[Auth] login() called — clearing loggedOut flag');
    this._loggedOut = false;

    // Clear stale cached tokens so the next login gets fresh tokens with correct scopes.
    // Without this, old tokens (possibly missing aws.cognito.signin.user.admin) persist in storage.
    this.oidcSecurityService.logoffLocal();

    // authorize() uses scopes from the provideAuth() config in app.config.ts:
    // 'openid email phone profile aws.cognito.signin.user.admin'
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    console.log('[Auth] logout() called');
    console.log('[Auth] Clearing role, tokens, and orgId');
    this._role$.next(null);
    this.accessToken = null;
    this.idToken = null;
    this.orgId = null;

    console.log('[Auth] Calling logoff() to clear local session and redirect to Cognito logout');
    this.oidcSecurityService.logoff().subscribe({
      next: (result) => console.log('[Auth] Logout result:', result),
      error: (err) => {
        console.error('[Auth] Logout failed, falling back to logoffLocal():', err);
        this.oidcSecurityService.logoffLocal();
        this.router.navigate(['/']);
      },
    });
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  routeToDashboardForRole(role: UserRole): string {
    return ROLE_DASHBOARD_MAP[role];
  }

  /**
   * Extracts UserRole from the OIDC userData claims.
   * Checks custom:user_type first (Cognito's custom attribute prefix), falls back to user_type.
   */
  private extractUserRole(userData: Record<string, unknown> | null): UserRole | null {
    if (!userData) return null;
    const raw = userData['custom:user_type'] ?? userData['user_type'];
    if (isValidRole(raw)) {
      console.log('User Role:', raw);
      return raw;
    }
    console.warn('No valid user_type claim found in token. Got:', raw);
    return null;
  }

  /**
   * Logs token_use for both ID and access tokens plus the access token's scope claim.
   */
  private debugTokens(accessToken: string, idToken: string): void {
    try {
      const accessPayload = JSON.parse(atob(accessToken.split('.')[1]));
      const idPayload = JSON.parse(atob(idToken.split('.')[1]));

      console.log('--- Token Debug ---');
      console.log('ID token use:', idPayload.token_use);
      console.log('Access token use:', accessPayload.token_use);
      console.log('Access token scope:', accessPayload.scope);

      if (accessPayload.scope?.includes('aws.cognito.signin.user.admin')) {
        console.log('Scope includes aws.cognito.signin.user.admin');
      } else {
        console.error('MISSING scope: aws.cognito.signin.user.admin — GetUser will fail');
      }
      console.log('-------------------');
    } catch (error) {
      console.error('Failed to decode tokens for debug:', error);
    }
  }

  /**
   * Validates that the access token has token_use=access and includes
   * aws.cognito.signin.user.admin scope.
   */
  private verifyTokenScopes(accessToken: string): void {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const tokenUse = payload.token_use;
      const scopes = payload.scope || '';

      if (tokenUse !== 'access') {
        console.error('WRONG TOKEN TYPE: Expected access token but got:', tokenUse);
      }

      if (!scopes.includes('aws.cognito.signin.user.admin')) {
        console.error('MISSING REQUIRED SCOPE: aws.cognito.signin.user.admin');
      } else {
        console.log('Access token has required scope for Cognito API calls');
      }
    } catch (error) {
      console.error('Failed to decode access token:', error);
    }
  }

  /**
   * Calls Cognito GetUser API using the access token (not ID token).
   * Requires aws.cognito.signin.user.admin scope on the access token.
   */
  async getUserAttributes(): Promise<void> {
    if (!this.accessToken) {
      console.error('No access token available for GetUser call');
      return;
    }

    try {
      console.log('Calling Cognito GetUser API...');

      const command = new GetUserCommand({
        AccessToken: this.accessToken,
      });

      const response = await this.cognitoClient.send(command);
      console.log('GetUser response:', response);

      const orgIdAttr = response.UserAttributes?.find((attr) => attr.Name === 'custom:org_id');

      if (orgIdAttr?.Value) {
        this.orgId = orgIdAttr.Value;
        console.log('Organization ID:', this.orgId);
      }

      console.log('All User Attributes:', response.UserAttributes);
    } catch (error: any) {
      console.error('GetUser failed:', error.message);

      if (error.message?.includes('Access Token does not have required scopes')) {
        console.error(
          'SOLUTION: Clear tokens and re-login to request aws.cognito.signin.user.admin scope',
        );
      }
    }
  }

  /**
   * Calls Cognito UpdateUserAttributes API using the access token.
   * Requires aws.cognito.signin.user.admin scope on the access token.
   */
  async updateUserAttribute(attributeName: string, attributeValue: string): Promise<boolean> {
    if (!this.accessToken) {
      console.error('No access token available for UpdateUserAttributes call');
      return false;
    }

    try {
      console.log(`Updating user attribute: ${attributeName}...`);

      const command = new UpdateUserAttributesCommand({
        AccessToken: this.accessToken,
        UserAttributes: [
          {
            Name: attributeName,
            Value: attributeValue,
          },
        ],
      });

      await this.cognitoClient.send(command);
      console.log(`Successfully updated ${attributeName}`);
      return true;
    } catch (error: any) {
      console.error('UpdateUserAttributes failed:', error.message);
      return false;
    }
  }
}
