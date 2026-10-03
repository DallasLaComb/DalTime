/**
 * An OrgAdmin's reverse-lookup has no `manager_id`; in "view as manager" their own id stands in,
 * since that is the key their employees, shifts and templates are filed under.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/lib-dynamodb', async (orig) => ({
  ...(await orig<object>()),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));

import { getMetadataRecord } from '../../../src/functions/shared/dynamo.js';

beforeEach(() => send.mockReset());

describe('getMetadataRecord — manager_id', () => {
  it('supplies the OrgAdmin’s own id as manager_id', async () => {
    send.mockResolvedValue({ Item: { user_id: 'admin-1', org_id: 'org-1' } });
    await expect(getMetadataRecord('admin-1')).resolves.toMatchObject({
      org_id: 'org-1',
      manager_id: 'admin-1',
    });
  });

  it('leaves a real manager’s own manager_id alone', async () => {
    send.mockResolvedValue({ Item: { user_id: 'm-1', manager_id: 'm-1', org_id: 'org-1' } });
    await expect(getMetadataRecord('m-1')).resolves.toMatchObject({ manager_id: 'm-1' });
  });

  it('does not invent a manager_id for records without an org (e.g. a WebAdmin)', async () => {
    send.mockResolvedValue({ Item: { user_id: 'wa-1' } });
    await expect(getMetadataRecord('wa-1')).resolves.not.toHaveProperty('manager_id');
  });

  it('does not invent one for an employee record', async () => {
    send.mockResolvedValue({ Item: { employee_id: 'e-1', org_id: 'org-1', manager_id: 'm-1' } });
    await expect(getMetadataRecord('e-1')).resolves.toMatchObject({ manager_id: 'm-1' });
  });

  it('returns null when there is no record', async () => {
    send.mockResolvedValue({});
    await expect(getMetadataRecord('x')).resolves.toBeNull();
  });
});
