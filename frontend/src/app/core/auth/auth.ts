import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GetUserCommand,
  UpdateUserAttributesCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { type UserRole, isValidRole, ROLE_DASHBOARD_MAP } from './user-role.model';

const TOKEN_KEYS = {
  access: 'daltime_access_token',
  id: 'daltime_id_token',
  refresh: 'daltime_refresh_token',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly cognitoClient = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });

  // --- Reactive state ---
  private readonly _isAuthenticated = signal(false);
  private readonly _role = signal<UserRole | null>(null);
  private readonly _authReady = signal(false);

  readonly isAuthenticatedSignal = this._isAuthenticated.asReadonly();
  readonly roleSignal = this._role.asReadonly();
  readonly authReady = this._authReady.asReadonly();

  // --- Scalar state ---
  accessToken: string | null = null;
  idToken: string | null = null;
  private readonly _orgId = signal<string | null>(null);
  readonly orgId = this._orgId.asReadonly();

  // --- Challenge state (for NEW_PASSWORD_REQUIRED flow) ---
  private challengeSession: string | null = null;
  private challengeEmail: string | null = null;

  get hasPendingChallenge(): boolean {
    return this.challengeSession !== null;
  }

  async initialize(): Promise<void> {
    const accessToken = sessionStorage.getItem(TOKEN_KEYS.access);
    const idToken = sessionStorage.getItem(TOKEN_KEYS.id);

    if (accessToken && idToken && !this.isTokenExpired(accessToken)) {
      this.accessToken = accessToken;
      this.idToken = idToken;
      this._isAuthenticated.set(true);

      const role = this.extractUserRole(accessToken);
      this._role.set(role);

      await this.getUserAttributes();

      if (role && ['/', '/login'].includes(window.location.pathname)) {
        this.router.navigate([ROLE_DASHBOARD_MAP[role]]);
      }
    }

    this._authReady.set(true);
  }

  async login(email: string, password: string): Promise<{ success: boolean; challenge?: string; error?: string }> {
    try {
      const response = await this.cognitoClient.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: environment.cognito.clientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        }),
      );

      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        this.challengeSession = response.Session ?? null;
        this.challengeEmail = email;
        return { success: false, challenge: 'NEW_PASSWORD_REQUIRED' };
      }

      if (response.AuthenticationResult) {
        this.storeTokens(response.AuthenticationResult);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from authentication service.' };
    } catch (err: unknown) {
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  async completeNewPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.challengeSession || !this.challengeEmail) {
      return { success: false, error: 'No pending password challenge.' };
    }

    try {
      const response = await this.cognitoClient.send(
        new RespondToAuthChallengeCommand({
          ClientId: environment.cognito.clientId,
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: this.challengeSession,
          ChallengeResponses: {
            USERNAME: this.challengeEmail,
            NEW_PASSWORD: newPassword,
          },
        }),
      );

      this.challengeSession = null;
      this.challengeEmail = null;

      if (response.AuthenticationResult) {
        this.storeTokens(response.AuthenticationResult);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from authentication service.' };
    } catch (err: unknown) {
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  logout(): void {
    this._isAuthenticated.set(false);
    this._role.set(null);
    this.accessToken = null;
    this.idToken = null;
    this._orgId.set(null);
    this.challengeSession = null;
    this.challengeEmail = null;

    sessionStorage.removeItem(TOKEN_KEYS.access);
    sessionStorage.removeItem(TOKEN_KEYS.id);
    sessionStorage.removeItem(TOKEN_KEYS.refresh);

    this.router.navigate(['/']);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  routeToDashboardForRole(role: UserRole): string {
    return ROLE_DASHBOARD_MAP[role];
  }

  async getUserAttributes(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const response = await this.cognitoClient.send(
        new GetUserCommand({ AccessToken: this.accessToken }),
      );

      const orgIdAttr = response.UserAttributes?.find((attr) => attr.Name === 'custom:org_id');
      if (orgIdAttr?.Value) {
        this._orgId.set(orgIdAttr.Value);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('GetUser failed:', message);
    }
  }

  async updateUserAttribute(attributeName: string, attributeValue: string): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      await this.cognitoClient.send(
        new UpdateUserAttributesCommand({
          AccessToken: this.accessToken,
          UserAttributes: [{ Name: attributeName, Value: attributeValue }],
        }),
      );
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('UpdateUserAttributes failed:', message);
      return false;
    }
  }

  private async storeTokens(result: { AccessToken?: string; IdToken?: string; RefreshToken?: string }): Promise<void> {
    this.accessToken = result.AccessToken ?? null;
    this.idToken = result.IdToken ?? null;

    if (result.AccessToken) sessionStorage.setItem(TOKEN_KEYS.access, result.AccessToken);
    if (result.IdToken) sessionStorage.setItem(TOKEN_KEYS.id, result.IdToken);
    if (result.RefreshToken) sessionStorage.setItem(TOKEN_KEYS.refresh, result.RefreshToken);

    this._isAuthenticated.set(true);

    const role = this.extractUserRole(this.accessToken);
    this._role.set(role);

    await this.getUserAttributes();

    if (role) {
      this.router.navigate([ROLE_DASHBOARD_MAP[role]]);
    }
  }

  private extractUserRole(accessToken: string | null): UserRole | null {
    if (!accessToken) return null;

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const groups: unknown[] = payload['cognito:groups'] ?? [];
      const role = groups.find((g) => isValidRole(g)) as UserRole | undefined;
      if (role) return role;
    } catch {
      // malformed token
    }

    console.warn('No valid Cognito group found in access token.');
    return null;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  private mapAuthError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === 'NotAuthorizedException') return 'Incorrect email or password.';
      if (err.name === 'UserNotFoundException') return 'Incorrect email or password.';
      if (err.name === 'UserNotConfirmedException') return 'Account not confirmed. Contact your administrator.';
      if (err.name === 'InvalidPasswordException') return err.message;
      if (err.name === 'InvalidParameterException') return err.message;
      if (err.name === 'CodeMismatchException') return 'Invalid verification code.';
      if (err.name === 'ExpiredCodeException') return 'Verification code has expired. Please request a new one.';
      if (err.name === 'LimitExceededException') return 'Too many attempts. Please try again later.';
    }
    return 'An unexpected error occurred. Please try again.';
  }

  async forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cognitoClient.send(
        new ForgotPasswordCommand({
          ClientId: environment.cognito.clientId,
          Username: email,
        }),
      );
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: environment.cognito.clientId,
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        }),
      );
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: this.mapAuthError(err) };
    }
  }
}
