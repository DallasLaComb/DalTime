import { displayAddress, formatAddress, parseAddress } from './address.utils';

describe('address utils', () => {
  it('parses a legacy value with no spaces', () => {
    expect(parseAddress('Meriden,CT,06489')).toEqual({
      street: '',
      city: 'Meriden',
      state: 'CT',
      zip: '06489',
    });
  });

  it('parses a full formatted address', () => {
    expect(parseAddress('12 Main St, Meriden, CT 06489')).toEqual({
      street: '12 Main St',
      city: 'Meriden',
      state: 'CT',
      zip: '06489',
    });
  });

  it('keeps an unparseable value whole in street', () => {
    expect(parseAddress('Somewhere out west')).toEqual({
      street: 'Somewhere out west',
      city: '',
      state: '',
      zip: '',
    });
  });

  it('formats parts and skips empty ones', () => {
    expect(
      formatAddress({ street: '12 Main St', city: 'Meriden', state: 'ct', zip: '06489' }),
    ).toBe('12 Main St, Meriden, CT 06489');
    expect(formatAddress({ street: '', city: 'Meriden', state: 'CT', zip: '06489' })).toBe(
      'Meriden, CT 06489',
    );
  });

  it('displays a legacy value with proper spacing', () => {
    expect(displayAddress('Meriden,CT,06489')).toBe('Meriden, CT 06489');
    expect(displayAddress('Somewhere out west')).toBe('Somewhere out west');
  });
});
