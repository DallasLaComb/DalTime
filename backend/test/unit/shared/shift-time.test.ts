import { describe, it, expect } from 'vitest';
import {
  crossesMidnight,
  isValidShiftSpan,
  shiftMinutes,
} from '../../../src/functions/shared/shift-time.js';
import { deriveShiftType } from '../../../src/functions/shared/shift-type.js';

describe('overnight shift time rules', () => {
  it('treats an end earlier than the start as crossing midnight', () => {
    expect(crossesMidnight('22:00', '06:00')).toBe(true);
    expect(crossesMidnight('09:00', '17:00')).toBe(false);
    expect(crossesMidnight('16:00', '00:00')).toBe(true); // ends at midnight
  });

  it('accepts any two different times and rejects equal ones', () => {
    expect(isValidShiftSpan('22:00', '06:00')).toBe(true);
    expect(isValidShiftSpan('09:00', '17:00')).toBe(true);
    expect(isValidShiftSpan('09:00', '09:00')).toBe(false);
  });

  it('computes length through midnight', () => {
    expect(shiftMinutes('22:00', '06:00')).toBe(8 * 60);
    expect(shiftMinutes('09:00', '17:30')).toBe(8.5 * 60);
    expect(shiftMinutes('16:00', '00:00')).toBe(8 * 60);
  });

  it('derives the type from the start time, so a 22:00 start is Night', () => {
    expect(deriveShiftType('22:00')).toBe('night');
  });
});
