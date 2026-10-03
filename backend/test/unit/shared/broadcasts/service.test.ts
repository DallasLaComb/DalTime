import type { BroadcastRecord } from '@daltime/contracts';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '../../../../src/functions/shared/errors.js';

vi.mock('../../../../src/functions/shared/broadcasts/db.js', () => ({
  queryActiveByScope: vi.fn(),
  getDismissedIds: vi.fn(),
  putDismissal: vi.fn(),
}));
vi.mock('../../../../src/functions/shared/dynamo.js', () => ({
  getMetadataRecord: vi.fn(),
}));

import * as db from '../../../../src/functions/shared/broadcasts/db.js';
import { getMetadataRecord } from '../../../../src/functions/shared/dynamo.js';
import {
  listActiveForCaller,
  dismissBroadcast,
} from '../../../../src/functions/shared/broadcasts/service.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const SUB = 'caller-sub';

function broadcast(overrides: Partial<BroadcastRecord>): BroadcastRecord {
  const id = overrides.broadcast_id ?? 'b';
  return {
    PK: 'BROADCAST#ALL',
    SK: `9999-12-31T23:59:59.999Z#${id}`,
    GSI1PK: 'BROADCAST',
    GSI1SK: `9999-12-31T23:59:59.999Z#${id}`,
    broadcast_id: id,
    message: 'm',
    severity: 'INFO',
    target_scope: 'ALL',
    created_at: '2026-09-01T00:00:00.000Z',
    created_by_web_admin_id: 'WADMIN#1',
    ...overrides,
  };
}

/** Stub each scope partition's Query result. */
function stubScopes(byPk: Record<string, BroadcastRecord[]>) {
  vi.mocked(db.queryActiveByScope).mockImplementation(async (pk) => byPk[pk] ?? []);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMetadataRecord).mockResolvedValue({ org_id: 'o1' });
  vi.mocked(db.getDismissedIds).mockResolvedValue(new Set());
});

describe('listActiveForCaller()', () => {
  it('queries ALL, the org, and the org+role scopes with SK > now', async () => {
    stubScopes({});
    await listActiveForCaller(SUB, 'Manager', NOW);

    expect(getMetadataRecord).toHaveBeenCalledWith(SUB);
    const pks = vi.mocked(db.queryActiveByScope).mock.calls.map(([pk, now]) => {
      expect(now).toBe(NOW.toISOString());
      return pk;
    });
    expect(pks).toEqual(['BROADCAST#ALL', 'BROADCAST#ORG#o1', 'BROADCAST#ORG#o1#ROLE#Manager']);
  });

  it('WebAdmins receive ALL only, without an org lookup', async () => {
    stubScopes({});
    await listActiveForCaller(SUB, 'WebAdmin', NOW);
    expect(getMetadataRecord).not.toHaveBeenCalled();
    expect(vi.mocked(db.queryActiveByScope).mock.calls.map(([pk]) => pk)).toEqual([
      'BROADCAST#ALL',
    ]);
  });

  it('a caller with no org record receives ALL only', async () => {
    vi.mocked(getMetadataRecord).mockResolvedValue(null);
    stubScopes({});
    await listActiveForCaller(SUB, 'Employee', NOW);
    expect(vi.mocked(db.queryActiveByScope).mock.calls.map(([pk]) => pk)).toEqual([
      'BROADCAST#ALL',
    ]);
  });

  it('orders by severity then newest, and returns only recipient-safe fields', async () => {
    stubScopes({
      'BROADCAST#ALL': [
        broadcast({
          broadcast_id: 'info-new',
          severity: 'INFO',
          created_at: '2026-09-28T00:00:00.000Z',
        }),
        broadcast({
          broadcast_id: 'warn-old',
          severity: 'WARNING',
          created_at: '2026-09-01T00:00:00.000Z',
        }),
      ],
      'BROADCAST#ORG#o1': [
        broadcast({
          broadcast_id: 'crit',
          severity: 'CRITICAL',
          target_scope: 'ORG',
          target_org_id: 'o1',
          expires_at: '2026-10-01T00:00:00.000Z',
        }),
      ],
      'BROADCAST#ORG#o1#ROLE#Employee': [
        broadcast({
          broadcast_id: 'warn-new',
          severity: 'WARNING',
          created_at: '2026-09-20T00:00:00.000Z',
        }),
      ],
    });

    const res = await listActiveForCaller(SUB, 'Employee', NOW);

    expect(res.map((b) => b.broadcast_id)).toEqual(['crit', 'warn-new', 'warn-old', 'info-new']);
    expect(res[0]).toEqual({
      broadcast_id: 'crit',
      message: 'm',
      severity: 'CRITICAL',
      created_at: '2026-09-01T00:00:00.000Z',
      expires_at: '2026-10-01T00:00:00.000Z',
    });
    expect(res[1]).not.toHaveProperty('expires_at');
  });

  it('excludes broadcasts the caller dismissed', async () => {
    stubScopes({
      'BROADCAST#ALL': [broadcast({ broadcast_id: 'a' }), broadcast({ broadcast_id: 'b' })],
    });
    vi.mocked(db.getDismissedIds).mockResolvedValue(new Set(['a']));

    const res = await listActiveForCaller(SUB, 'Employee', NOW);

    expect(db.getDismissedIds).toHaveBeenCalledWith(SUB, ['a', 'b']);
    expect(res.map((b) => b.broadcast_id)).toEqual(['b']);
  });

  it('skips the dismissal lookup when nothing is active', async () => {
    stubScopes({});
    expect(await listActiveForCaller(SUB, 'Employee', NOW)).toEqual([]);
    expect(db.getDismissedIds).not.toHaveBeenCalled();
  });
});

describe('dismissBroadcast()', () => {
  it('writes a dismissal carrying the broadcast ttl', async () => {
    stubScopes({ 'BROADCAST#ALL': [broadcast({ broadcast_id: 'a', ttl: 1790000000 })] });
    await dismissBroadcast(SUB, 'Employee', 'a', NOW);
    expect(db.putDismissal).toHaveBeenCalledWith(SUB, {
      broadcast_id: 'a',
      dismissed_at: NOW.toISOString(),
      ttl: 1790000000,
    });
  });

  it('writes no ttl for a never-expiring broadcast', async () => {
    stubScopes({ 'BROADCAST#ALL': [broadcast({ broadcast_id: 'a' })] });
    await dismissBroadcast(SUB, 'Employee', 'a', NOW);
    expect(db.putDismissal).toHaveBeenCalledWith(SUB, {
      broadcast_id: 'a',
      dismissed_at: NOW.toISOString(),
    });
  });

  it('throws NotFoundError for a broadcast not addressed to the caller', async () => {
    stubScopes({ 'BROADCAST#ORG#other': [broadcast({ broadcast_id: 'x' })] });
    await expect(dismissBroadcast(SUB, 'Employee', 'x', NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(db.putDismissal).not.toHaveBeenCalled();
  });
});
