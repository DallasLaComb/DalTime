// Base environment configuration (also used as dev default in CI)
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
    baseUrl: '__API_BASE_URL__', // Replaced by pipeline with deployed API Gateway URL
  },
};
