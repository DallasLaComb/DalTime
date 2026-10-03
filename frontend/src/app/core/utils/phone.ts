/**
 * Phone and email rules shared by every form. A phone is OPTIONAL but, when given, must be exactly
 * 10 digits once formatting is stripped — "(555) 123-4567" and "555-123-4567" are fine, "555-0199"
 * (7 digits) is not. The backend enforces the same rule and stores the 10 digits only.
 */
export const PHONE_ERROR = 'Phone must be 10 digits';
export const EMAIL_ERROR = 'Enter a valid email address';

export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** An error message, or null when the phone is empty (optional) or exactly 10 digits. */
export function phoneError(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value === '') return null;
  return phoneDigits(value).length === 10 ? null : PHONE_ERROR;
}

/** An error message, or null when `raw` looks like an email address. Empty is an error. */
export function emailError(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : EMAIL_ERROR;
}

/** "5551234567" → "(555) 123-4567". Anything that isn't 10 digits is returned unchanged. */
export function formatPhone(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  const digits = phoneDigits(value);
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * A stored phone that predates the 10-digit rule (e.g. "555-0199"). It is shown as-is and flagged,
 * and must be corrected the next time the person is edited.
 */
export function isLegacyPhone(raw: string | null | undefined): boolean {
  const value = (raw ?? '').trim();
  return value !== '' && phoneDigits(value).length !== 10;
}
