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
      if (loginResponse.errorMessage) {
        console.error('Authentication error:', loginResponse.errorMessage);
      }

      if (loginResponse.isAuthenticated) {
        this.accessToken = loginResponse.accessToken;
        this.idToken = loginResponse.idToken;

        const role = this.extractUserRole(loginResponse.userData);
        this._role$.next(role);

        this.getUserAttributes();

        // Strip code/state params from the URL after the callback is processed
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (role && ['/', '/sso'].includes(window.location.pathname)) {
          this.router.navigate([ROLE_DASHBOARD_MAP[role]]);
        }
      }

      // Gate opens for guards — must fire in both authenticated and unauthenticated branches
      this._authReady$.next(true);
    });
  }

  login(): void {
    this._loggedOut = false;

    // Clear stale cached tokens so the next login gets fresh tokens with correct scopes.
    // Without this, old tokens (possibly missing aws.cognito.signin.user.admin) persist in storage.
    this.oidcSecurityService.logoffLocal();

    // authorize() uses scopes from the provideAuth() config in app.config.ts:
    // 'openid email phone profile aws.cognito.signin.user.admin'
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    this._role$.next(null);
    this.accessToken = null;
    this.idToken = null;
    this.orgId = null;

    this.oidcSecurityService.logoff().subscribe({
      error: (err) => {
        console.error('[Auth] Logoff failed:', err);
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
    if (isValidRole(raw)) return raw;
    console.warn('No valid user_type claim found in token. Got:', raw);
    return null;
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
      const response = await this.cognitoClient.send(
        new GetUserCommand({ AccessToken: this.accessToken }),
      );

      const orgIdAttr = response.UserAttributes?.find((attr) => attr.Name === 'custom:org_id');
      if (orgIdAttr?.Value) {
        this.orgId = orgIdAttr.Value;
      }
    } catch (error: any) {
      console.error('GetUser failed:', error.message);
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
      await this.cognitoClient.send(
        new UpdateUserAttributesCommand({
          AccessToken: this.accessToken,
          UserAttributes: [{ Name: attributeName, Value: attributeValue }],
        }),
      );
      return true;
    } catch (error: any) {
      console.error('UpdateUserAttributes failed:', error.message);
      return false;
    }
  }
}
