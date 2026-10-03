// Local development — API calls go to this page's own origin; `ng serve` (proxy.conf.js) forwards
// them to the local SAM API on port 47200, so the browser never makes a cross-origin call.
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
    // Absolute (not '') so the auth/logging interceptors' `startsWith(baseUrl)` check still matches
    // only API calls and never third-party requests.
    baseUrl: globalThis.location.origin,
  },
  posthog: {
    // Do not commit a real key here (see docs/posthog-guide.md) — edit locally and leave unstaged.
    apiKey: '',
    apiHost: 'https://us.i.posthog.com',
    enabled: false,
  },
};
