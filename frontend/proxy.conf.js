/**
 * Dev-server proxy for `ng serve --configuration=local`.
 *
 * The app calls the API on its own origin (see environment.local.ts), and this forwards those
 * calls to the local SAM API on :47200. One origin means no CORS preflight and nothing for a
 * browser to block when a page on :4200 calls :47200.
 *
 * Some API prefixes are also SPA page routes (e.g. /org-admin/schedule is a page, while
 * /org-admin/shifts is an API). A browser page load sends `Accept: text/html`; the bypass
 * serves the SPA for those and proxies everything else (fetch/XHR).
 */
const API_TARGET = 'http://localhost:47200';

// First path segment of every route in contracts/openapi.json.
const API_PREFIXES = ['employee', 'manager', 'org-admin', 'web-admin', 'organizations', 'health', 'shared'];

const bypass = (req) => {
  if (req.headers.accept?.includes('text/html')) return '/index.html';
  return undefined;
};

module.exports = Object.fromEntries(
  API_PREFIXES.map((prefix) => [
    `/${prefix}`,
    { target: API_TARGET, secure: false, changeOrigin: true, bypass },
  ]),
);
