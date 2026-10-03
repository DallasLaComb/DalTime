/**
 * Phone numbers are exactly 10 digits (optional). Formatted input is accepted and stored as 10
 * digits; anything else is rejected with "Phone must be 10 digits" on EVERY endpoint that takes one.
 */
import { describe, it, expect } from 'vitest';
import {
  CreateEmployeeBody,
  CreateManagerBody,
  CreateManagerEmployeeBody,
  UpdateEmployeeBody,
  UpdateEmployeeProfileBody,
  UpdateManagerBody,
  UpdateManagerEmployeeBody,
  UpdateManagerProfileBody,
} from '@daltime/contracts';
import { canonicalPhone, PHONE_ERROR } from '../../../src/functions/shared/phone.js';
import { parseWithContract } from '../../../src/functions/shared/contract-validation.js';
import { ValidationError } from '../../../src/functions/shared/errors.js';

describe('canonicalPhone', () => {
  it.each([
    ['(555) 123-4567', '5551234567'],
    ['555-123-4567', '5551234567'],
    ['555.123.4567', '5551234567'],
    ['5551234567', '5551234567'],
    ['  555 123 4567  ', '5551234567'],
  ])('stores %s as %s', (input, expected) => {
    expect(canonicalPhone(input)).toBe(expected);
  });

  it('treats empty / missing as "no phone"', () => {
    expect(canonicalPhone('')).toBe('');
    expect(canonicalPhone('   ')).toBe('');
    expect(canonicalPhone(undefined)).toBe('');
    expect(canonicalPhone(null)).toBe('');
  });

  it.each(['555-0199', '12345', '55512345678', 'abcdefghij', '(555) 123-456'])(
    'rejects %s with "Phone must be 10 digits"',
    (input) => {
      expect(() => canonicalPhone(input)).toThrow(new ValidationError(PHONE_ERROR));
    },
  );
});

const email = {
  email: 'jane@acme.com',
  first_name: 'Jane',
  last_name: 'Smith',
  temp_password: 'Temp@1234',
};
const bodies: [string, (phone: string) => unknown][] = [
  [
    'create employee (org-admin)',
    (phone) => parseWithContract(CreateEmployeeBody, { ...email, phone }),
  ],
  ['update employee (org-admin)', (phone) => parseWithContract(UpdateEmployeeBody, { phone })],
  ['create manager', (phone) => parseWithContract(CreateManagerBody, { ...email, phone })],
  ['update manager', (phone) => parseWithContract(UpdateManagerBody, { phone })],
  [
    'create employee (manager)',
    (phone) => parseWithContract(CreateManagerEmployeeBody, { ...email, phone }),
  ],
  ['update employee (manager)', (phone) => parseWithContract(UpdateManagerEmployeeBody, { phone })],
  ['manager profile', (phone) => parseWithContract(UpdateManagerProfileBody, { phone })],
  ['employee profile', (phone) => parseWithContract(UpdateEmployeeProfileBody, { phone })],
];

describe.each(bodies)('%s — phone contract', (_name, parse) => {
  it('accepts formatted 10-digit input and an empty value', () => {
    expect(() => parse('(555) 123-4567')).not.toThrow();
    expect(() => parse('555-123-4567')).not.toThrow();
    expect(() => parse('')).not.toThrow();
  });

  it('rejects 7-digit, 11-digit and non-numeric input with the clear message', () => {
    for (const bad of ['555-0199', '15551234567', 'not a phone']) {
      expect(() => parse(bad)).toThrow(/Phone must be 10 digits/);
    }
  });
});
