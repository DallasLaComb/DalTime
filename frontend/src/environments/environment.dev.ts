// Dev environment configuration
export const environment = {
  name: 'dev',
  production: false,
  cognito: {
    userPoolId: 'us-east-1_LVp3uUQ5l',
    clientId: '1vvrr1dvepebrkl1v246pbijju',
    region: 'us-east-1',
    domain: 'https://us-east-1lvp3uuq5l.auth.us-east-1.amazoncognito.com',
  },
  api: {
    baseUrl: 'https://mdklpuu4hf.execute-api.us-east-1.amazonaws.com',
  },
};
