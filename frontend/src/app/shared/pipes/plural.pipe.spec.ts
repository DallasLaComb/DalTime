import { PluralPipe } from './plural.pipe';

describe('PluralPipe', () => {
  const pipe = new PluralPipe();

  it('uses the singular for exactly one', () => {
    expect(pipe.transform(1, 'employee')).toBe('1 employee');
  });

  it('uses the plural for zero and many', () => {
    expect(pipe.transform(0, 'employee')).toBe('0 employees');
    expect(pipe.transform(2, 'employee')).toBe('2 employees');
  });

  it('treats a missing count as zero and accepts an irregular plural', () => {
    expect(pipe.transform(undefined, 'person', 'people')).toBe('0 people');
    expect(pipe.transform(1, 'person', 'people')).toBe('1 person');
  });
});
