import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly cdr = inject(ChangeDetectorRef);

  // No AWS credentials needed — GetUser/UpdateUserAttributes are authorized by the access token's
  // aws.cognito.signin.user.admin scope, not by IAM credentials
  private readonly cognitoClient = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });

  isAuthenticated = false;
  userData: any = null;
  accessToken: string | null = null;
  idToken: string | null = null;
  orgId: string | null = null;
  userGroups: string[] = []; // Cognito groups: Admin, Manager, Employee

  ngOnInit(): void {
    // checkAuth() detects code+state params in the URL automatically and exchanges for tokens.
    // No manual code detection needed — the OIDC library handles the entire callback flow.
    this.oidcSecurityService.checkAuth().subscribe((loginResponse) => {
      console.log('Login Response:', loginResponse);
      this.isAuthenticated = loginResponse.isAuthenticated;

      if (loginResponse.errorMessage) {
        console.error('Authentication Error:', loginResponse.errorMessage);
      }

      if (loginResponse.isAuthenticated) {
        this.accessToken = loginResponse.accessToken;
        this.idToken = loginResponse.idToken;
        this.userData = loginResponse.userData;

        // Extract Cognito groups from ID token
        this.extractUserGroups(loginResponse.idToken);

        // Debug: log token_use for both ID and access tokens, plus access token scope
        this.debugTokens(loginResponse.accessToken, loginResponse.idToken);

        // Verify access token has the required scope before calling Cognito APIs
        this.verifyTokenScopes(loginResponse.accessToken);

        this.getUserAttributes();
        this.cdr.detectChanges();

        // Clean code/state params from URL after successful auth callback
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });

    this.oidcSecurityService.isAuthenticated$.subscribe(({ isAuthenticated }) => {
      this.isAuthenticated = isAuthenticated;
    });

    this.oidcSecurityService.userData$.subscribe((userData) => {
      this.userData = userData.userData;
    });
  }

  login(): void {
    // Clear stale cached tokens so the next login gets fresh tokens with correct scopes.
    // Without this, old tokens (possibly missing aws.cognito.signin.user.admin) persist in storage.
    this.oidcSecurityService.logoffLocal();

    // authorize() uses scopes from the provideAuth() config in app.config.ts:
    // 'openid email phone profile aws.cognito.signin.user.admin'
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    this.oidcSecurityService.logoff().subscribe((result) => {
      console.log('Logout complete:', result);
    });
  }

  getTokenForApi(): void {
    this.oidcSecurityService.getAccessToken().subscribe((token) => {
      console.log('ACCESS TOKEN FOR API VALIDATION:');
      console.log(token);
      console.log(`Authorization: Bearer ${token}`);

      if (token) {
        this.verifyTokenScopes(token);
      }
    });
  }

  /**
   * Extracts Cognito groups from the ID token's cognito:groups claim.
   * Groups: Admin, Manager, Employee
   */
  extractUserGroups(idToken: string): void {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      this.userGroups = payload['cognito:groups'] || [];
      console.log('User Groups:', this.userGroups);
    } catch (error) {
      console.error('Failed to extract user groups:', error);
      this.userGroups = [];
    }
  }

  /**
   * Logs token_use for both ID and access tokens plus the access token's scope claim.
   * Required debug output to confirm the correct token types are in use.
   */
  debugTokens(accessToken: string, idToken: string): void {
    try {
      const accessPayload = JSON.parse(atob(accessToken.split('.')[1]));
      const idPayload = JSON.parse(atob(idToken.split('.')[1]));

      console.log('--- Token Debug ---');
      console.log('ID token use:', idPayload.token_use); // expected: "id"
      console.log('Access token use:', accessPayload.token_use); // expected: "access"
      console.log('Access token scope:', accessPayload.scope); // expected to include aws.cognito.signin.user.admin

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
   * aws.cognito.signin.user.admin scope. Logs errors if requirements are not met.
   */
  verifyTokenScopes(accessToken: string): void {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const tokenUse = payload.token_use;
      const scopes = payload.scope || '';

      console.log('Access token use:', tokenUse);
      console.log('Scopes include:', scopes);

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
      this.cdr.detectChanges();
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
