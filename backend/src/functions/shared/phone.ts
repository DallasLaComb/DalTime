import { ValidationError } from './errors.js';

export const PHONE_ERROR = 'Phone must be 10 digits';

/** Digits only: "(555) 123-4567" → "5551234567". */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * The stored form of a phone number: exactly 10 digits, or '' for none. Formatted input such as
 * "(555) 123-4567" or "555-123-4567" is accepted and stripped. Anything else that isn't empty
 * is rejected, so a malformed number can't be written. (Numbers stored before this rule — e.g. a
 * 7-digit "555-0199" — are left alone until someone edits them, then must be corrected.)
 */
export function canonicalPhone(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return '';
  const digits = phoneDigits(trimmed);
  if (digits.length !== 10) throw new ValidationError(PHONE_ERROR);
  return digits;
}
