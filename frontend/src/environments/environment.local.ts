// Local development environment configuration
export const environment = {
  name: 'local',
  production: false,
  cognito: {
    userPoolId: 'us-east-1_kzQ806uSv',
    clientId: '1nl13tbaqb47s8f0tfc07lc24m',
    region: 'us-east-1',
    domain: 'daltime-dev.auth.us-east-1.amazoncognito.com',
  },
  api: {
    baseUrl: 'http://localhost:3000',
  },
};
