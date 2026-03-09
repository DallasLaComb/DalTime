// QA environment configuration - update values for your QA AWS environment
export const environment = {
  name: 'qa',
  production: false,
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
