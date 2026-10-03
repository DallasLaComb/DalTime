import {
  EMAIL_ERROR,
  PHONE_ERROR,
  emailError,
  formatPhone,
  isLegacyPhone,
  phoneDigits,
  phoneError,
} from './phone';

describe('phoneError — exactly 10 digits, optional', () => {
  it.each(['(555) 123-4567', '555-123-4567', '555.123.4567', '5551234567', ' 555 123 4567 '])(
    'accepts %s',
    (v) => {
      expect(phoneError(v)).toBeNull();
    },
  );

  it('treats empty as valid (phone is optional)', () => {
    expect(phoneError('')).toBeNull();
    expect(phoneError('   ')).toBeNull();
    expect(phoneError(null)).toBeNull();
    expect(phoneError(undefined)).toBeNull();
  });

  it.each(['555-0199', '12345', '15551234567', 'abcdefghij', '(555) 123-456'])(
    'rejects %s with "Phone must be 10 digits"',
    (v) => {
      expect(phoneError(v)).toBe(PHONE_ERROR);
    },
  );

  it('uses the exact message the spec asks for', () => {
    expect(PHONE_ERROR).toBe('Phone must be 10 digits');
  });
});

describe('phoneDigits / formatPhone', () => {
  it('strips formatting down to digits', () => {
    expect(phoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(phoneDigits(null)).toBe('');
  });

  it('formats a 10-digit number for display', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567');
  });

  it('leaves a number that is not 10 digits exactly as stored (legacy "555-0199")', () => {
    expect(formatPhone('555-0199')).toBe('555-0199');
    expect(formatPhone('')).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });
});

describe('isLegacyPhone', () => {
  it('flags a stored number that predates the 10-digit rule', () => {
    expect(isLegacyPhone('555-0199')).toBe(true);
    expect(isLegacyPhone('12345')).toBe(true);
  });

  it('does not flag a valid or an empty phone', () => {
    expect(isLegacyPhone('5551234567')).toBe(false);
    expect(isLegacyPhone('(555) 123-4567')).toBe(false);
    expect(isLegacyPhone('')).toBe(false);
    expect(isLegacyPhone(null)).toBe(false);
  });
});

describe('emailError', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com'])('accepts %s', (v) => {
    expect(emailError(v)).toBeNull();
  });

  it.each(['', 'plain', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@b .com'])(
    'rejects "%s" with "Enter a valid email address"',
    (v) => {
      expect(emailError(v)).toBe(EMAIL_ERROR);
    },
  );

  it('uses the exact message the spec asks for', () => {
    expect(EMAIL_ERROR).toBe('Enter a valid email address');
  });
});
