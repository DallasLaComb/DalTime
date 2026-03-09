// QA environment configuration - update values for your QA AWS environment
export const environment = {
  name: 'qa',
  production: false,
  cognito: {
    userPoolId: 'us-east-1_ROlgeorak',
    clientId: '3tno9a5g62l4ga7ko4s5e00tfh',
    region: 'us-east-1',
    domain: 'https://us-east-1rolgeorak.auth.us-east-1.amazoncognito.com',
  },
  api: {
    baseUrl: '__API_BASE_URL__', // Replaced by pipeline with deployed API Gateway URL
  },
};
