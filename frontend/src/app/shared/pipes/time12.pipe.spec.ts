import { Time12Pipe } from './time12.pipe';

describe('Time12Pipe — never military time', () => {
  const pipe = new Time12Pipe();

  it.each([
    ['09:00', '9:00 AM'],
    ['13:30', '1:30 PM'],
    ['17:00', '5:00 PM'],
    ['12:00', '12:00 PM'],
    ['00:00', '12:00 AM'],
    ['00:15', '12:15 AM'],
    ['23:59', '11:59 PM'],
    ['06:05:00', '6:05 AM'],
  ])('%s → %s', (input, expected) => {
    expect(pipe.transform(input)).toBe(expected);
  });

  it('passes through empty or non-time values instead of throwing', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('soon')).toBe('soon');
  });
});
