import { describe, it, expect, vi } from 'vitest';
import { enrichWithCognitoStatus } from '../../../src/functions/shared/cognito.js';

const client = (res: unknown) => ({ send: vi.fn(async () => res) }) as never;
const item = { email: 'a@b.com', status: 'CONFIRMED' };

describe('enrichWithCognitoStatus', () => {
  it('reports DISABLED when the Cognito user is disabled, even though UserStatus is CONFIRMED', async () => {
    const [r] = await enrichWithCognitoStatus(
      [item],
      client({ Enabled: false, UserStatus: 'CONFIRMED' }),
    );
    expect(r.status).toBe('DISABLED');
  });

  it('uses the Cognito UserStatus for enabled users', async () => {
    const [r] = await enrichWithCognitoStatus(
      [item],
      client({ Enabled: true, UserStatus: 'FORCE_CHANGE_PASSWORD' }),
    );
    expect(r.status).toBe('FORCE_CHANGE_PASSWORD');
  });

  it('returns the item unchanged when Cognito errors', async () => {
    const c = { send: vi.fn(async () => Promise.reject(new Error('boom'))) } as never;
    expect(await enrichWithCognitoStatus([item], c)).toEqual([item]);
  });
});
