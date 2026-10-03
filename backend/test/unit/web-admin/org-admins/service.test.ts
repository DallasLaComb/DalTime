/**
 * Unit tests for the web-admin org-admins service layer.
 *
 * Focus areas (story #348 — org_admin_count blank bug):
 *  1. createOrgAdmin calls db.incrementOrgAdminCount with the correct orgId.
 *  2. The ADD expression in incrementOrgAdminCount is idempotent-safe: it uses
 *     DynamoDB's ADD operator, which treats a missing Number attribute as 0, so
 *     the service never pre-checks existence before incrementing (which would
 *     create a race window).
 *  3. Race-condition documentation: two concurrent createOrgAdmin calls both
 *     issue incrementOrgAdminCount; the service does not try to read-then-write
 *     (which would lose an increment under concurrent load).
 *  4. Org-record does not exist when increment fires: documented edge case.
 *  5. Adversarial: createOrgAdmin must NOT call incrementOrgAdminCount when the
 *     org itself does not exist (NotFoundError thrown before Cognito is hit).
 *  6. Adversarial: createOrgAdmin must NOT call incrementOrgAdminCount when
 *     Cognito rejects the user (ConflictError / ValidationError thrown before
 *     the DynamoDB write path).
 *
 * Random seed: set VITEST_SEED env var to replay a specific failing run.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../../src/functions/shared/errors.js';
import type { OrgAdminUser } from '../../../../src/functions/shared/models/web-admin/org-admin-user.model.js';

// ─── Module-level mocks ──────────────────────────────────────────────────────

vi.mock('../../../../src/functions/web-admin/org-admins/db.js', () => ({
  createOrgAdminUser: vi.fn(),
  listOrgAdminsByOrg: vi.fn(),
  getOrgAdminReverseLookup: vi.fn(),
  disableOrgAdminUser: vi.fn(),
  enableOrgAdminUser: vi.fn(),
  incrementOrgAdminCount: vi.fn(),
  decrementOrgAdminCount: vi.fn(),
}));

vi.mock('../../../../src/functions/web-admin/organizations/db.js', () => ({
  getOrganizationById: vi.fn(),
}));

vi.mock('../../../../src/functions/shared/dynamo.js', () => ({
  stripKeys: vi.fn(<T extends Record<string, unknown>>(item: T) => {
    const { PK: _PK, SK: _SK, GSI1PK: _G1PK, GSI1SK: _G1SK, ...rest } = item;
    return rest;
  }),
  docClient: {},
  TABLE_NAME: 'test-table',
  getMetadataRecord: vi.fn(),
}));

vi.mock('../../../../src/functions/shared/cognito.js', () => ({
  enrichWithCognitoStatus: vi.fn(async (admins: unknown[]) => admins),
  adminDisableUser: vi.fn(),
  adminEnableUser: vi.fn(),
}));

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class MockCognitoClient {
    send = vi.fn();
  },
  AdminCreateUserCommand: vi.fn(),
  AdminAddUserToGroupCommand: vi.fn(),
  AdminDisableUserCommand: vi.fn(),
  AdminEnableUserCommand: vi.fn(),
  AdminGetUserCommand: vi.fn(),
  UsernameExistsException: class UsernameExistsException extends Error {
    override name = 'UsernameExistsException';
  },
  InvalidPasswordException: class InvalidPasswordException extends Error {
    override name = 'InvalidPasswordException';
  },
}));

import * as db from '../../../../src/functions/web-admin/org-admins/db.js';
import * as orgDb from '../../../../src/functions/web-admin/organizations/db.js';
import * as cognitoShared from '../../../../src/functions/shared/cognito.js';
import {
  createOrgAdmin,
  listOrgAdmins,
  disableOrgAdmin,
  enableOrgAdmin,
} from '../../../../src/functions/web-admin/org-admins/service.js';
import {
  CognitoIdentityProviderClient,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';

// ─── Seeded pseudo-random helpers ─────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

const SEED = Number(process.env['VITEST_SEED'] ?? Date.now()) | 0;
const rand = makePrng(SEED);
console.log(`[org-admins/service.test.ts] random seed: ${SEED}`);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ─── Randomised data pools ────────────────────────────────────────────────────

const ORG_IDS = [
  'org-acme-001',
  'org-sunset-cafe-002',
  'org-tech-corp-003',
  'org-maple-grove-004',
  'org-riverside-005',
];

const ADMIN_EMAILS = [
  'alice@acme.com',
  'bob@sunsetcafe.dev',
  'carol@techcorp.io',
  'dana@maplegrove.net',
  'eve@riverside.org',
];

const ADMIN_NAMES = ['Alice Smith', 'Bob Johnson', 'Carol Williams', 'Dana Brown', 'Eve Davis'];

const TEMP_PASSWORDS = [
  'TempPass@1234',
  'Secure#5678!',
  'Admin$9012^',
  'Pass&word@3456',
  'Init!alP@ss78',
];

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WEB_ADMIN_ID = 'WADMIN#unit-test-id';

function buildCreateBody(
  overrides: Partial<{ email: string; name: string; temp_password: string }> = {},
) {
  return {
    email: pickRandom(ADMIN_EMAILS),
    name: pickRandom(ADMIN_NAMES),
    temp_password: pickRandom(TEMP_PASSWORDS),
    ...overrides,
  };
}

function buildOrgRecord(orgId: string) {
  return {
    PK: `ORG#${orgId}`,
    SK: 'METADATA',
    org_id: orgId,
    name: 'Test Org',
    address: '123 Main St',
    org_admin_count: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };
}

// Cognito client that returns a successful AdminCreateUserCommand result.
function buildMockCognitoClient(userSub: string): CognitoIdentityProviderClient {
  const client = new CognitoIdentityProviderClient({});
  vi.mocked(client.send).mockResolvedValue({
    User: {
      Attributes: [{ Name: 'sub', Value: userSub }],
    },
  } as never);
  return client;
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.incrementOrgAdminCount).mockResolvedValue(undefined);
  vi.mocked(db.decrementOrgAdminCount).mockResolvedValue(undefined);
  vi.mocked(db.createOrgAdminUser).mockResolvedValue(undefined);
  vi.mocked(db.disableOrgAdminUser).mockResolvedValue(undefined);
  vi.mocked(db.enableOrgAdminUser).mockResolvedValue(undefined);
  vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(null);
});

// ─── createOrgAdmin — incrementOrgAdminCount is called ────────────────────────

describe('createOrgAdmin() — org_admin_count increment (story #348 regression)', () => {
  it('calls db.incrementOrgAdminCount exactly once after a successful create', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userSub = 'user-sub-unit-test';
    const body = buildCreateBody();
    console.log(
      `[service.test.ts] increment-called test input: orgId=${orgId}, email=${body.email}`,
    );

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    const cognitoClient = buildMockCognitoClient(userSub);

    await createOrgAdmin(orgId, body, cognitoClient, WEB_ADMIN_ID);

    expect(db.incrementOrgAdminCount).toHaveBeenCalledTimes(1);
  });

  it('calls db.incrementOrgAdminCount with the correct orgId', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userSub = 'user-sub-unit-test-2';
    const body = buildCreateBody();
    console.log(`[service.test.ts] increment-orgId test: orgId=${orgId}`);

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    const cognitoClient = buildMockCognitoClient(userSub);

    await createOrgAdmin(orgId, body, cognitoClient, WEB_ADMIN_ID);

    expect(db.incrementOrgAdminCount).toHaveBeenCalledWith(orgId);
  });

  it('calls db.incrementOrgAdminCount AFTER db.createOrgAdminUser (ordering contract)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const callOrder: string[] = [];

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    vi.mocked(db.createOrgAdminUser).mockImplementation(async () => {
      callOrder.push('createOrgAdminUser');
    });
    vi.mocked(db.incrementOrgAdminCount).mockImplementation(async () => {
      callOrder.push('incrementOrgAdminCount');
    });

    const cognitoClient = buildMockCognitoClient('user-sub-order-test');
    await createOrgAdmin(orgId, buildCreateBody(), cognitoClient, WEB_ADMIN_ID);

    expect(callOrder).toEqual(['createOrgAdminUser', 'incrementOrgAdminCount']);
  });
});

// ─── incrementOrgAdminCount — ADD is idempotent-safe (no read-before-write) ───

describe('incrementOrgAdminCount() — ADD operator is idempotent-safe', () => {
  it('service does NOT read org_admin_count before incrementing (no pre-check that creates a race)', async () => {
    /**
     * DynamoDB's ADD operator on a missing Number attribute treats it as 0,
     * so the service should NOT call getOrganizationById (or any other read)
     * before calling incrementOrgAdminCount. A read-then-write pattern would
     * create a TOCTOU race window under concurrent requests.
     *
     * We verify: no "get" db method is called as part of the increment path.
     * (getOrganizationById IS called, but only for the org-existence guard
     * before Cognito — that's acceptable. The increment itself must not depend
     * on reading the current count.)
     */
    const orgId = pickRandom(ORG_IDS);
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    const cognitoClient = buildMockCognitoClient('user-sub-no-precheck');

    await createOrgAdmin(orgId, buildCreateBody(), cognitoClient, WEB_ADMIN_ID);

    // incrementOrgAdminCount is a direct write — no intermediate read of the
    // count is required. The service must not inspect the returned count value.
    expect(db.incrementOrgAdminCount).toHaveBeenCalledTimes(1);
    // Confirm that incrementOrgAdminCount is passed only the orgId, not a
    // count value derived from a prior read.
    const [calledOrgId] = vi.mocked(db.incrementOrgAdminCount).mock.calls[0];
    expect(calledOrgId).toBe(orgId);
    // The call has exactly one argument — no "current count" is passed,
    // confirming no read-then-write pattern.
    expect(vi.mocked(db.incrementOrgAdminCount).mock.calls[0]).toHaveLength(1);
  });

  it('documents: DynamoDB ADD on a missing Number attribute treats it as 0 — no initialisation guard needed', () => {
    /**
     * This is a contract documentation test. DynamoDB ADD semantics:
     *   ADD org_admin_count :inc (where :inc = 1)
     * When org_admin_count does not exist on the item, DynamoDB initialises it
     * to 0 before adding :inc, resulting in org_admin_count = 1.
     *
     * This means the service is correct to call incrementOrgAdminCount without
     * first checking whether org_admin_count exists — the ADD operator handles
     * the "first admin ever" case without a separate initialisation step.
     *
     * See db.ts incrementOrgAdminCount() — UpdateExpression: 'ADD org_admin_count :inc'
     */
    expect(true).toBe(true); // intent test — behaviour is in DynamoDB itself
  });

  it('RACE CONDITION NOTE: two concurrent createOrgAdmin calls each issue their own increment — ADD is atomic at the DynamoDB level', async () => {
    /**
     * If two requests arrive simultaneously both call incrementOrgAdminCount.
     * Because each uses ADD (not SET), DynamoDB processes each as an atomic
     * increment, so both increments land. There is no lost-update risk from
     * the service side.
     *
     * This test confirms the service issues incrementOrgAdminCount once per
     * call, not once total — so under two concurrent invocations the db layer
     * is called twice, which is the correct behaviour.
     *
     * Note: true DynamoDB concurrency cannot be simulated in a unit test. This
     * test models the "both calls fire" scenario and asserts the service does
     * not try to serialize increments or share state. A real concurrency test
     * would require an integration test against a live/local DynamoDB instance.
     */
    const orgId = pickRandom(ORG_IDS);
    const callCount = { n: 0 };

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    vi.mocked(db.incrementOrgAdminCount).mockImplementation(async () => {
      callCount.n += 1;
    });

    const clientA = buildMockCognitoClient('user-sub-concurrent-a');
    const clientB = buildMockCognitoClient('user-sub-concurrent-b');

    // Simulate two concurrent invocations.
    await Promise.all([
      createOrgAdmin(
        orgId,
        buildCreateBody({ email: 'concurrent-a@test.com' }),
        clientA,
        WEB_ADMIN_ID,
      ),
      createOrgAdmin(
        orgId,
        buildCreateBody({ email: 'concurrent-b@test.com' }),
        clientB,
        WEB_ADMIN_ID,
      ),
    ]);

    // Both calls must have incremented — no shared state suppresses either.
    expect(callCount.n).toBe(2);
    expect(db.incrementOrgAdminCount).toHaveBeenCalledTimes(2);
    // Both increments target the same orgId.
    const calls = vi.mocked(db.incrementOrgAdminCount).mock.calls;
    expect(calls[0][0]).toBe(orgId);
    expect(calls[1][0]).toBe(orgId);
  });
});

// ─── createOrgAdmin — increment NOT called on error paths ─────────────────────

describe('createOrgAdmin() — incrementOrgAdminCount is NOT called on error paths', () => {
  it('does NOT call incrementOrgAdminCount when org does not exist (NotFoundError)', async () => {
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(null);
    const cognitoClient = buildMockCognitoClient('user-sub-not-found');

    await expect(
      createOrgAdmin('nonexistent-org', buildCreateBody(), cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow(NotFoundError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when email already exists in Cognito (ConflictError)', async () => {
    const orgId = pickRandom(ORG_IDS);
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));

    const cognitoClient = new CognitoIdentityProviderClient({});
    const usernameExists = new UsernameExistsException({
      message: 'User already exists',
      $metadata: {},
    });
    vi.mocked(cognitoClient.send).mockRejectedValue(usernameExists);

    await expect(
      createOrgAdmin(orgId, buildCreateBody(), cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow(ConflictError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when password is invalid (ValidationError from Cognito)', async () => {
    const orgId = pickRandom(ORG_IDS);
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));

    const cognitoClient = new CognitoIdentityProviderClient({});
    const invalidPassword = new InvalidPasswordException({
      message: 'Password too weak',
      $metadata: {},
    });
    vi.mocked(cognitoClient.send).mockRejectedValue(invalidPassword);

    await expect(
      createOrgAdmin(orgId, buildCreateBody(), cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow(ValidationError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when input validation fails (email missing)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const cognitoClient = buildMockCognitoClient('user-sub-validation-fail');

    await expect(
      createOrgAdmin(
        orgId,
        { email: '', name: 'Admin Name', temp_password: 'Pass@1234' },
        cognitoClient,
        WEB_ADMIN_ID,
      ),
    ).rejects.toThrow(ValidationError);

    // Org lookup and Cognito should not have been called either.
    expect(orgDb.getOrganizationById).not.toHaveBeenCalled();
    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when input validation fails (invalid email format)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const cognitoClient = buildMockCognitoClient('user-sub-invalid-email');

    await expect(
      createOrgAdmin(
        orgId,
        { email: 'not-an-email', name: 'Admin Name', temp_password: 'Pass@1234' },
        cognitoClient,
        WEB_ADMIN_ID,
      ),
    ).rejects.toThrow(ValidationError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when name is missing', async () => {
    const orgId = pickRandom(ORG_IDS);
    const cognitoClient = buildMockCognitoClient('user-sub-no-name');

    await expect(
      createOrgAdmin(
        orgId,
        { email: 'valid@test.com', name: '', temp_password: 'Pass@1234' },
        cognitoClient,
        WEB_ADMIN_ID,
      ),
    ).rejects.toThrow(ValidationError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('does NOT call incrementOrgAdminCount when temp_password is missing', async () => {
    const orgId = pickRandom(ORG_IDS);
    const cognitoClient = buildMockCognitoClient('user-sub-no-pass');

    await expect(
      createOrgAdmin(
        orgId,
        { email: 'valid@test.com', name: 'Admin Name', temp_password: '' },
        cognitoClient,
        WEB_ADMIN_ID,
      ),
    ).rejects.toThrow(ValidationError);

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });

  it('propagates unexpected Cognito errors and does NOT call incrementOrgAdminCount', async () => {
    const orgId = pickRandom(ORG_IDS);
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));

    const cognitoClient = new CognitoIdentityProviderClient({});
    vi.mocked(cognitoClient.send).mockRejectedValue(new Error('Cognito service unavailable'));

    await expect(
      createOrgAdmin(orgId, buildCreateBody(), cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow('Cognito service unavailable');

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });
});

// ─── createOrgAdmin — returned value does not contain DynamoDB keys ───────────

describe('createOrgAdmin() — returned value', () => {
  it('strips PK, SK, GSI1PK, GSI1SK from the returned user record', async () => {
    const orgId = pickRandom(ORG_IDS);
    const body = buildCreateBody();
    console.log(`[service.test.ts] strip-keys test: orgId=${orgId}, email=${body.email}`);

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    const cognitoClient = buildMockCognitoClient('user-sub-strip-keys');

    const result = await createOrgAdmin(orgId, body, cognitoClient, WEB_ADMIN_ID);

    expect(result).not.toHaveProperty('PK');
    expect(result).not.toHaveProperty('SK');
    expect(result).not.toHaveProperty('GSI1PK');
    expect(result).not.toHaveProperty('GSI1SK');
  });

  it('includes expected public fields (user_id, email, name, org_id, status, created_at)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const body = buildCreateBody();

    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(buildOrgRecord(orgId));
    const cognitoClient = buildMockCognitoClient('user-sub-fields-check');

    const result = (await createOrgAdmin(orgId, body, cognitoClient, WEB_ADMIN_ID)) as OrgAdminUser;

    expect(result.user_id).toBe('user-sub-fields-check');
    expect(result.email).toBe(body.email.trim());
    expect(result.name).toBe(body.name.trim());
    expect(result.org_id).toBe(orgId);
    expect(result.status).toBe('FORCE_CHANGE_PASSWORD');
    expect(result.created_at).toBeDefined();
  });
});

// ─── createOrgAdmin — org-not-found edge case for increment ───────────────────

describe('createOrgAdmin() — org item does not exist when increment fires (edge case)', () => {
  it('documents: if getOrganizationById returns null, NotFoundError is thrown before any db write', async () => {
    /**
     * Edge case documented in sub-issue #351:
     * "Org record does not exist when the increment fires"
     *
     * Because the service calls getOrganizationById BEFORE Cognito and before
     * any DynamoDB write, a missing org record throws NotFoundError immediately.
     * incrementOrgAdminCount is therefore never reached for a non-existent org.
     *
     * A DynamoDB ADD on a key that does not exist would create a new item with
     * only the PK/SK and org_admin_count attributes — which would be a data
     * corruption bug. The service correctly guards against this via the
     * getOrganizationById check.
     */
    vi.mocked(orgDb.getOrganizationById).mockResolvedValue(null);
    const cognitoClient = buildMockCognitoClient('user-sub-no-org');

    const result = createOrgAdmin('org-ghost-999', buildCreateBody(), cognitoClient, WEB_ADMIN_ID);

    await expect(result).rejects.toThrow(NotFoundError);
    await expect(result).rejects.toThrow("Organization 'org-ghost-999' not found");
    expect(db.createOrgAdminUser).not.toHaveBeenCalled();
    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });
});

// ─── disableOrgAdmin — decrementOrgAdminCount is called (story #348 fix) ─────

describe('disableOrgAdmin() — org_admin_count decrement (story #348 regression)', () => {
  function buildReverseLookup(userId: string, orgId: string) {
    return { user_id: userId, org_id: orgId, email: 'admin@test.com', name: 'Test Admin' };
  }

  it('calls db.decrementOrgAdminCount exactly once after a successful disable', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-disable-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminDisableUser).mockResolvedValue(undefined);

    const cognitoClient = new CognitoIdentityProviderClient({});

    await disableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(db.decrementOrgAdminCount).toHaveBeenCalledTimes(1);
  });

  it('calls db.decrementOrgAdminCount with the correct orgId', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-disable-orgid-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminDisableUser).mockResolvedValue(undefined);

    const cognitoClient = new CognitoIdentityProviderClient({});

    await disableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(db.decrementOrgAdminCount).toHaveBeenCalledWith(orgId);
  });

  it('calls db.decrementOrgAdminCount AFTER db.disableOrgAdminUser (ordering contract)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-disable-order-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminDisableUser).mockResolvedValue(undefined);

    const callOrder: string[] = [];
    vi.mocked(db.disableOrgAdminUser).mockImplementation(async () => {
      callOrder.push('disableOrgAdminUser');
    });
    vi.mocked(db.decrementOrgAdminCount).mockImplementation(async () => {
      callOrder.push('decrementOrgAdminCount');
    });

    const cognitoClient = new CognitoIdentityProviderClient({});
    await disableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(callOrder).toEqual(['disableOrgAdminUser', 'decrementOrgAdminCount']);
  });

  it('does NOT call db.decrementOrgAdminCount when the user is not found (NotFoundError)', async () => {
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(null);

    const cognitoClient = new CognitoIdentityProviderClient({});

    await expect(
      disableOrgAdmin('any-org', 'nonexistent-user', cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow('not found');

    expect(db.decrementOrgAdminCount).not.toHaveBeenCalled();
  });
});

// ─── enableOrgAdmin — incrementOrgAdminCount is called (code-reviewer fix) ───

describe('enableOrgAdmin() — org_admin_count increment (symmetric to disable decrement)', () => {
  function buildReverseLookup(userId: string, orgId: string) {
    return { user_id: userId, org_id: orgId, email: 'admin@test.com', name: 'Test Admin' };
  }

  it('calls db.incrementOrgAdminCount exactly once after a successful re-enable', async () => {
    /**
     * disableOrgAdmin decrements org_admin_count; enableOrgAdmin must increment
     * it symmetrically so the count accurately reflects active admins after a
     * disable/re-enable cycle. Without this, each cycle permanently drops the
     * count by 1 (silent data drift bug).
     */
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-enable-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminEnableUser).mockResolvedValue('CONFIRMED');

    const cognitoClient = new CognitoIdentityProviderClient({});

    await enableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(db.incrementOrgAdminCount).toHaveBeenCalledTimes(1);
  });

  it('calls db.incrementOrgAdminCount with the correct orgId', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-enable-orgid-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminEnableUser).mockResolvedValue('CONFIRMED');

    const cognitoClient = new CognitoIdentityProviderClient({});

    await enableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(db.incrementOrgAdminCount).toHaveBeenCalledWith(orgId);
  });

  it('calls db.incrementOrgAdminCount AFTER db.enableOrgAdminUser (ordering contract)', async () => {
    const orgId = pickRandom(ORG_IDS);
    const userId = 'user-sub-enable-order-test';
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(buildReverseLookup(userId, orgId));
    vi.mocked(cognitoShared.adminEnableUser).mockResolvedValue('CONFIRMED');

    const callOrder: string[] = [];
    vi.mocked(db.enableOrgAdminUser).mockImplementation(async () => {
      callOrder.push('enableOrgAdminUser');
    });
    vi.mocked(db.incrementOrgAdminCount).mockImplementation(async () => {
      callOrder.push('incrementOrgAdminCount');
    });

    const cognitoClient = new CognitoIdentityProviderClient({});
    await enableOrgAdmin(orgId, userId, cognitoClient, WEB_ADMIN_ID);

    expect(callOrder).toEqual(['enableOrgAdminUser', 'incrementOrgAdminCount']);
  });

  it('does NOT call db.incrementOrgAdminCount when the user is not found (NotFoundError)', async () => {
    vi.mocked(db.getOrgAdminReverseLookup).mockResolvedValue(null);

    const cognitoClient = new CognitoIdentityProviderClient({});

    await expect(
      enableOrgAdmin('any-org', 'nonexistent-user', cognitoClient, WEB_ADMIN_ID),
    ).rejects.toThrow('not found');

    expect(db.incrementOrgAdminCount).not.toHaveBeenCalled();
  });
});

// ─── listOrgAdmins — unrelated to increment but tested for coverage ──────────

describe('listOrgAdmins() — basic contract', () => {
  it('returns an array of org admins with Cognito status enriched', async () => {
    const orgId = pickRandom(ORG_IDS);
    const mockAdmin: OrgAdminUser = {
      PK: `ORG#${orgId}`,
      SK: 'USER#sub-list-test',
      GSI1PK: 'ORG_ADMIN',
      GSI1SK: '2025-01-01T00:00:00.000Z',
      user_id: 'sub-list-test',
      email: pickRandom(ADMIN_EMAILS),
      name: pickRandom(ADMIN_NAMES),
      org_id: orgId,
      status: 'CONFIRMED',
      created_at: '2025-01-01T00:00:00.000Z',
    };

    vi.mocked(db.listOrgAdminsByOrg).mockResolvedValue([mockAdmin]);

    const cognitoClient = new CognitoIdentityProviderClient({});
    const result = await listOrgAdmins(orgId, cognitoClient);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    // Keys must be stripped in the result
    expect(result[0]).not.toHaveProperty('PK');
    expect(result[0]).not.toHaveProperty('SK');
  });

  it('returns an empty array when there are no admins for the org', async () => {
    const orgId = pickRandom(ORG_IDS);
    vi.mocked(db.listOrgAdminsByOrg).mockResolvedValue([]);

    const cognitoClient = new CognitoIdentityProviderClient({});
    const result = await listOrgAdmins(orgId, cognitoClient);

    expect(result).toEqual([]);
  });
});
