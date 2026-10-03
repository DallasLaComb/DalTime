import { getMetadataRecord } from '../../shared/dynamo.js';
import type {
  WebAdminMetadata,
  WebAdminCaller,
} from '../../shared/models/web-admin/web-admin.model.js';

/**
 * Fetch the WebAdmin reverse-lookup record for the given Cognito sub.
 *
 * Reads: PK = USER#<sub>, SK = METADATA (base table GetItem — no GSI needed).
 *
 * Returns a `WebAdminCaller` containing the fields the auth and service layers
 * need at runtime, or `null` if no record exists for the given sub.
 *
 * Callers must treat `null` as a hard 403 (fail closed). A missing record means
 * the Cognito user has not been provisioned as a WebAdmin in DynamoDB, even
 * if they passed the Cognito group check.
 *
 * This function intentionally does NOT filter on `status`. A `DISABLED`
 * WebAdmin record will be returned as non-null; the caller (requireWebAdminWithLookup
 * in shared/auth.ts) is responsible for checking `status === 'ACTIVE'` before
 * allowing the request through.
 */
export async function getWebAdminLookup(sub: string): Promise<WebAdminCaller | null> {
  // `getMetadataRecord` requires `T extends Record<string, unknown>`. WebAdminMetadata
  // has literal-typed fields that don't satisfy an index signature, so we fetch as a
  // plain record and cast to the known shape after the null check.
  const raw = await getMetadataRecord<Record<string, unknown>>(sub);
  if (!raw) return null;
  const record = raw as unknown as WebAdminMetadata;
  return {
    sub: record.sub,
    web_admin_id: record.web_admin_id,
    email: record.email,
    status: record.status,
  };
}
