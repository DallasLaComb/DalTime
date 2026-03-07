// Local development environment configuration
export const environment = {
  name: 'local',
  production: false,
  cognito: {
    userPoolId: 'us-east-1_LVp3uUQ5l',
    clientId: '1vvrr1dvepebrkl1v246pbijju',
    region: 'us-east-1',
    domain: 'https://us-east-1lvp3uuq5l.auth.us-east-1.amazoncognito.com',
  },
  api: {
    baseUrl: 'http://localhost:3000',
  },
};
