import { describe, it, expect } from 'vitest';
import { stripKeys } from '../../../src/functions/shared/dynamo.js';

describe('stripKeys()', () => {
  it('removes single-table key attributes from a DynamoDB item', () => {
    const item = {
      PK: 'ORG#123',
      SK: 'METADATA',
      GSI1PK: 'ORG',
      GSI1SK: '2025-01-01T00:00:00Z',
      org_id: '123',
      name: 'Acme Corp',
      address: '123 Main St',
    };

    const result = stripKeys(item);

    expect(result).toEqual({
      org_id: '123',
      name: 'Acme Corp',
      address: '123 Main St',
    });
    expect(result).not.toHaveProperty('PK');
    expect(result).not.toHaveProperty('SK');
    expect(result).not.toHaveProperty('GSI1PK');
    expect(result).not.toHaveProperty('GSI1SK');
  });
});
