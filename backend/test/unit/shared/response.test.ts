import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ok, created, noContent, badRequest, notFound, internalError } from '../../../src/functions/shared/response.js';

describe('response helpers', () => {
  it('ok() returns 200 with JSON body and CORS headers', () => {
    const result = ok({ id: '123' }) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual({ id: '123' });
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('created() returns 201 with JSON body', () => {
    const result = created({ id: '456' }) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body as string)).toEqual({ id: '456' });
  });

  it('noContent() returns 204 with empty body', () => {
    const result = noContent() as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
  });

  it('badRequest() returns 400 with error message', () => {
    const result = badRequest('missing name') as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body as string)).toEqual({ error: 'missing name' });
  });

  it('notFound() returns 404 with default message', () => {
    const result = notFound() as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body as string)).toEqual({ error: 'Not found' });
  });

  it('internalError() returns 500 with default message', () => {
    const result = internalError() as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body as string)).toEqual({ error: 'Internal server error' });
  });
});
