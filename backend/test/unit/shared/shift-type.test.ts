import { describe, it, expect } from 'vitest';
import { deriveShiftType } from '../../../src/functions/shared/shift-type.js';

/**
 * The boundary table below is duplicated in
 * frontend/src/app/core/utils/schedule.utils.spec.ts — the two implementations must agree.
 */
describe('deriveShiftType (by start time)', () => {
  it.each([
    ['00:00', 'night'],
    ['00:59', 'night'],
    ['01:00', 'morning'],
    ['09:00', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'afternoon'],
    ['16:59', 'afternoon'],
    ['17:00', 'night'],
    ['22:00', 'night'],
    ['23:59', 'night'],
  ])('%s → %s', (start, expected) => {
    expect(deriveShiftType(start)).toBe(expected);
  });
});
