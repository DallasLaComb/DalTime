/**
 * `sam local` takes each function's environment (TABLE_NAME, USER_POOL_ID) from env.local.json, and
 * a function with no entry gets no real table name — every call 500s. That is how the org-admin
 * "not yet scheduled" slots silently vanished locally. The committed example must list exactly the
 * functions in the template, so a new function can't be forgotten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../..');
const template = readFileSync(resolve(root, 'infra/template.yaml'), 'utf8');
const example = JSON.parse(
  readFileSync(resolve(root, 'backend/env.local.json.example'), 'utf8'),
) as Record<string, Record<string, string>>;

const functions = [
  ...template.matchAll(/^ {2}(\w+Function):\n {4}Type: AWS::Serverless::Function/gm),
].map((m) => m[1]);

describe('backend/env.local.json.example', () => {
  it('finds the template’s functions', () => {
    expect(functions.length).toBeGreaterThan(20);
  });

  it('has an entry for every function in infra/template.yaml', () => {
    const missing = functions.filter((f) => !(f in example));
    expect(missing).toEqual([]);
  });

  it('has no entries for functions that no longer exist', () => {
    const stale = Object.keys(example).filter((k) => !functions.includes(k));
    expect(stale).toEqual([]);
  });

  it('gives every function a TABLE_NAME', () => {
    const without = functions.filter((f) => !example[f]?.TABLE_NAME);
    expect(without).toEqual([]);
  });

  it('gives a function that calls Cognito its USER_POOL_ID', () => {
    for (const f of ['ManagersFunction', 'OrgAdminOverviewFunction', 'EmployeesFunction']) {
      expect(example[f]?.USER_POOL_ID, f).toBeTruthy();
    }
  });
});
