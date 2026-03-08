// Main (production) environment configuration - update values for your prod AWS environment
export const environment = {
  name: 'main',
  production: true,
  cognito: {
    userPoolId: '',
    clientId: '',
    region: '',
    domain: '',
  },
  api: {
    baseUrl: '__API_BASE_URL__', // Replaced by pipeline with deployed API Gateway URL
  },
};
