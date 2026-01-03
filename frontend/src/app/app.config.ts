import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAuth } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAuth({
      config: {
        authority: `https://cognito-idp.${environment.cognito.region}.amazonaws.com/${environment.cognito.userPoolId}`,
        redirectUrl: window.location.origin + '/sso',
        postLogoutRedirectUri: window.location.origin,
        clientId: environment.cognito.clientId,
        // All scopes required: profile for user info, aws.cognito.signin.user.admin for GetUser/UpdateUserAttributes
        scope: 'openid email phone profile aws.cognito.signin.user.admin',
        responseType: 'code',
        silentRenew: false,
        useRefreshToken: false,
        renewTimeBeforeTokenExpiresInSeconds: 30,
        secureRoutes: [],
      },
    }),
  ],
};
