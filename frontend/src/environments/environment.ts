// Environment configuration - values injected at build time
export const environment = {
  name: 'dev',
  production: false,
  cognito: {
    userPoolId: '__VITE_COGNITO_USER_POOL_ID__',
    clientId: '__VITE_COGNITO_CLIENT_ID__',
    region: '__VITE_COGNITO_REGION__',
    domain: '__VITE_COGNITO_DOMAIN__',
  },
  api: {
    baseUrl: '__VITE_API_BASE_URL__',
  },
};
