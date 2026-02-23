import type { APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * CORS headers returned on every response.
 *
 * Access-Control-Allow-Origin matches the Angular dev server origin (port 4200).
 * Browsers send credentialed requests from that origin to the API at port 3000,
 * so the allowed origin must be the browser-side port, not the API port.
 */
const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'http://localhost:4200',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function ok(data: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function created(data: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function noContent(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

export function badRequest(message = 'Bad request'): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResultV2 {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function internalError(message = 'Internal server error'): APIGatewayProxyResultV2 {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}
