import type { BroadcastRecord, CreateBroadcastBody } from '@daltime/contracts';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '../../../../src/functions/shared/errors.js';

vi.mock('../../../../src/functions/web-admin/broadcasts/db.js', () => ({
  BROADCAST_GSI1PK: 'BROADCAST',
  organizationExists: vi.fn(),
  putBroadcast: vi.fn(),
  queryActiveBroadcasts: vi.fn(),
  deleteBroadcast: vi.fn(),
}));

import * as db from '../../../../src/functions/web-admin/broadcasts/db.js';
import {
  broadcastPartitionKey,
  createBroadcast,
  deleteBroadcast,
  listActiveBroadcasts,
} from '../../../../src/functions/web-admin/broadcasts/service.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const WADMIN = 'WADMIN#uuid-1';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.organizationExists).mockResolvedValue(true);
});

function lastPut(): BroadcastRecord {
  return vi.mocked(db.putBroadcast).mock.calls[0][0];
}

describe('broadcastPartitionKey()', () => {
  it.each<[CreateBroadcastBody, string]>([
    [{ message: 'm', severity: 'INFO', target_scope: 'ALL' }, 'BROADCAST#ALL'],
    [{ message: 'm', severity: 'INFO', target_scope: 'ORG', org_id: 'o1' }, 'BROADCAST#ORG#o1'],
    [
      { message: 'm', severity: 'INFO', target_scope: 'ORG_ROLE', org_id: 'o1', role: 'Employee' },
      'BROADCAST#ORG#o1#ROLE#Employee',
    ],
  ])('maps %o to %s', (body, expected) => {
    expect(broadcastPartitionKey(body)).toBe(expected);
  });
});

describe('createBroadcast()', () => {
  it('stores an ALL broadcast with no expiry under the sentinel SK and no ttl', async () => {
    const res = await createBroadcast(
      { message: 'Known issue with availability', severity: 'WARNING', target_scope: 'ALL' },
      WADMIN,
      NOW,
    );

    const record = lastPut();
    expect(record.PK).toBe('BROADCAST#ALL');
    expect(record.SK).toBe(`9999-12-31T23:59:59.999Z#${record.broadcast_id}`);
    expect(record.GSI1PK).toBe('BROADCAST');
    expect(record.GSI1SK).toBe(record.SK);
    expect(record.ttl).toBeUndefined();
    expect(record.expires_at).toBeUndefined();
    expect(record.target_org_id).toBeUndefined();
    expect(record.created_by_web_admin_id).toBe(WADMIN);
    expect(record.created_at).toBe(NOW.toISOString());
    expect(db.organizationExists).not.toHaveBeenCalled();

    expect(res).not.toHaveProperty('PK');
    expect(res).not.toHaveProperty('GSI1PK');
    expect(res).not.toHaveProperty('ttl');
    expect(res.broadcast_id).toBe(record.broadcast_id);
  });

  it('leads the SK with expires_at and sets ttl = expiry + 1 day', async () => {
    const expires = '2026-10-01T03:00:00.000Z';
    await createBroadcast(
      { message: 'Maintenance', severity: 'INFO', target_scope: 'ALL', expires_at: expires },
      WADMIN,
      NOW,
    );
    const record = lastPut();
    expect(record.SK.startsWith(`${expires}#`)).toBe(true);
    expect(record.expires_at).toBe(expires);
    expect(record.ttl).toBe(Date.parse(expires) / 1000 + 86400);
  });

  it('stores an ORG_ROLE broadcast with its targeting fields after verifying the org', async () => {
    await createBroadcast(
      {
        message: 'm',
        severity: 'CRITICAL',
        target_scope: 'ORG_ROLE',
        org_id: 'o1',
        role: 'Manager',
      },
      WADMIN,
      NOW,
    );
    expect(db.organizationExists).toHaveBeenCalledWith('o1');
    const record = lastPut();
    expect(record.PK).toBe('BROADCAST#ORG#o1#ROLE#Manager');
    expect(record.target_org_id).toBe('o1');
    expect(record.target_role).toBe('Manager');
  });

  it('does not store target_role for an ORG broadcast', async () => {
    await createBroadcast(
      { message: 'm', severity: 'INFO', target_scope: 'ORG', org_id: 'o1', role: 'Manager' },
      WADMIN,
      NOW,
    );
    expect(lastPut().target_role).toBeUndefined();
  });

  it('throws NotFoundError for an unknown org', async () => {
    vi.mocked(db.organizationExists).mockResolvedValue(false);
    await expect(
      createBroadcast(
        { message: 'm', severity: 'INFO', target_scope: 'ORG', org_id: 'nope' },
        WADMIN,
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(db.putBroadcast).not.toHaveBeenCalled();
  });

  it('throws ValidationError for an expiry in the past', async () => {
    await expect(
      createBroadcast(
        {
          message: 'm',
          severity: 'INFO',
          target_scope: 'ALL',
          expires_at: '2026-09-29T11:59:59.000Z',
        },
        WADMIN,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.putBroadcast).not.toHaveBeenCalled();
  });
});

const activeRecord: BroadcastRecord = {
  PK: 'BROADCAST#ORG#o1',
  SK: '9999-12-31T23:59:59.999Z#b1',
  GSI1PK: 'BROADCAST',
  GSI1SK: '9999-12-31T23:59:59.999Z#b1',
  broadcast_id: 'b1',
  message: 'm',
  severity: 'INFO',
  target_scope: 'ORG',
  target_org_id: 'o1',
  created_at: '2026-09-01T00:00:00.000Z',
  created_by_web_admin_id: WADMIN,
};

describe('listActiveBroadcasts()', () => {
  it('queries with the current time and strips keys', async () => {
    vi.mocked(db.queryActiveBroadcasts).mockResolvedValue([activeRecord]);
    const res = await listActiveBroadcasts(NOW);
    expect(db.queryActiveBroadcasts).toHaveBeenCalledWith(NOW.toISOString());
    expect(res).toEqual([
      {
        broadcast_id: 'b1',
        message: 'm',
        severity: 'INFO',
        target_scope: 'ORG',
        target_org_id: 'o1',
        created_at: '2026-09-01T00:00:00.000Z',
        created_by_web_admin_id: WADMIN,
      },
    ]);
  });
});

describe('deleteBroadcast()', () => {
  it('deletes the matching active broadcast by its full key', async () => {
    vi.mocked(db.queryActiveBroadcasts).mockResolvedValue([activeRecord]);
    await deleteBroadcast('b1', WADMIN, NOW);
    expect(db.deleteBroadcast).toHaveBeenCalledWith(
      'BROADCAST#ORG#o1',
      '9999-12-31T23:59:59.999Z#b1',
    );
  });

  it('throws NotFoundError when the id is not active', async () => {
    vi.mocked(db.queryActiveBroadcasts).mockResolvedValue([activeRecord]);
    await expect(deleteBroadcast('other', WADMIN, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(db.deleteBroadcast).not.toHaveBeenCalled();
  });
});
