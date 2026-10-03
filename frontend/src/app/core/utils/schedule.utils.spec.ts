import {
  computeUnfilledSlots,
  formatDateWithYear,
  deriveShiftType,
  isDateInView,
  positionsNeeded,
  publishedMessage,
  noOpenShiftsMessage,
  generateDraftMessage,
  formatTimeRange,
  locationName,
  shiftCrossesMidnight,
  shiftMinutes,
  shortLocation,
  shortTimeRange,
  UNKNOWN_LOCATION,
  unfilledSlotLabels,
} from './schedule.utils';

describe('deriveShiftType (by start time)', () => {
  // Same boundary table as backend/test/unit/shared/shift-type.test.ts — the two must agree.
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

describe('locationName / shortLocation', () => {
  const locations = [{ location_id: 'loc-1', name: 'Platt High School' }] as never;

  it('resolves a known location', () => {
    expect(locationName('loc-1', locations)).toBe('Platt High School');
  });

  it('says "Unknown location" for an unresolvable id — never the raw id', () => {
    expect(locationName('43b1e55a-b86f-4961-adb6-a5d2a4917fcd', locations)).toBe(UNKNOWN_LOCATION);
    expect(shortLocation('43b1e55a-b86f-4961-adb6-a5d2a4917fcd', locations)).not.toContain('43b1');
  });
});

describe('overnight shift helpers', () => {
  it('flags an end earlier than the start as crossing midnight', () => {
    expect(shiftCrossesMidnight('22:00', '06:00')).toBe(true);
    expect(shiftCrossesMidnight('09:00', '17:00')).toBe(false);
  });

  it('counts the length through midnight (the weekly-hours cap relies on this)', () => {
    expect(shiftMinutes('22:00', '06:00')).toBe(480);
    expect(shiftMinutes('09:00', '17:00')).toBe(480);
    expect(shiftMinutes('16:00', '00:00')).toBe(480);
  });

  it('formats ranges, marking the next day', () => {
    expect(formatTimeRange('22:00', '06:00')).toBe('10:00 PM – 6:00 AM (+1)');
    expect(formatTimeRange('09:00', '17:30')).toBe('9:00 AM – 5:30 PM');
    expect(shortTimeRange('22:00', '06:00')).toBe('10p–6a (+1)');
    expect(shortTimeRange('09:00', '17:00')).toBe('9a–5p');
  });
});

describe('generateDraftMessage — the three outcomes', () => {
  const scope = { managerName: 'Mona Lisa', monthLabel: 'November 2026' };
  const base = { created: 0, unfilled: 0, draftCount: 2, maxDrafts: 10, openSlots: 1 };

  it('nobody available: counts the slots that stayed unfilled', () => {
    expect(generateDraftMessage({ ...base, unfilled: 1 }, scope)).toBe(
      'Run 2/10: no one was available — 1 slot stayed unfilled.',
    );
    expect(generateDraftMessage({ ...base, unfilled: 3, openSlots: 3 }, scope)).toBe(
      'Run 2/10: no one was available — 3 slots stayed unfilled.',
    );
  });

  it('some assigned: says how many were assigned and how many are still unfilled', () => {
    expect(generateDraftMessage({ ...base, created: 2, unfilled: 1, openSlots: 3 }, scope)).toBe(
      'Run 2/10: 2 shifts assigned, 1 slot still unfilled.',
    );
    expect(generateDraftMessage({ ...base, created: 1, unfilled: 0 }, scope)).toBe(
      'Run 2/10: 1 shift assigned.',
    );
  });

  it('nothing open: says so, with no run label', () => {
    expect(generateDraftMessage({ ...base, openSlots: 0 }, scope)).toBe(
      'No shifts needed to fill for Mona Lisa in November 2026.',
    );
  });

  it('never reports "0 slots stayed unfilled", even without openSlots in the response', () => {
    const { openSlots: _omit, ...legacy } = base;
    void _omit;
    const msg = generateDraftMessage(legacy, scope);
    expect(msg).toBe('No shifts needed to fill for Mona Lisa in November 2026.');
    expect(msg).not.toContain('0 slots');
  });
});

describe('Generate Draft explains what it considers open', () => {
  const scope = { monthLabel: 'October 2026' };
  const base = { created: 0, unfilled: 0, draftCount: 2, maxDrafts: 10, openSlots: 0 };

  it('says no shifts are NEEDED, and explains that existing open shifts are filled by hand', () => {
    const msg = generateDraftMessage({ ...base, openShifts: 2 }, scope);
    expect(msg).toContain('No shifts needed to fill in October 2026.');
    expect(msg).toContain('2 open shifts already exist with no employee');
    expect(msg).toContain('Fill Shift');
  });

  it('singular grammar for one open shift', () => {
    expect(noOpenShiftsMessage(scope, 1)).toContain('1 open shift already exists with no employee');
  });

  it('adds nothing when there are no open shifts', () => {
    expect(noOpenShiftsMessage(scope, 0)).toBe('No shifts needed to fill in October 2026.');
    expect(generateDraftMessage({ ...base }, scope)).not.toContain('open shift');
  });

  it('never prints "null" or "NaN", whatever the response holds', () => {
    const bad = { ...base, openSlots: 3, created: 0, unfilled: null as unknown as number };
    for (const msg of [
      generateDraftMessage(bad, scope),
      generateDraftMessage({ ...bad, unfilled: NaN, created: 2 }, scope),
      generateDraftMessage({ ...bad, unfilled: undefined as unknown as number, created: 1 }, scope),
    ]) {
      expect(msg).not.toMatch(/null|NaN|undefined/);
    }
  });
});

describe('publishedMessage — pluralised', () => {
  it('1 shift published / 5 shifts published', () => {
    expect(publishedMessage(1)).toBe('1 shift published — now visible to employees.');
    expect(publishedMessage(5)).toBe('5 shifts published — now visible to employees.');
  });

  it('says nothing was published for zero', () => {
    expect(publishedMessage(0)).toBe('No draft shifts were published.');
  });
});

describe('positionsNeeded', () => {
  it('is singular for one and plural otherwise — no "position(s)"', () => {
    expect(positionsNeeded(1)).toBe('1 position needed');
    expect(positionsNeeded(2)).toBe('2 positions needed');
    expect(positionsNeeded(0)).toBe('0 positions needed');
  });
});

describe('isDateInView', () => {
  const wed = new Date(2026, 9, 14); // Wed 14 Oct 2026 — week Sun 11 … Sat 17

  it('month: any date in the same month', () => {
    expect(isDateInView('2026-10-01', wed, 'month')).toBe(true);
    expect(isDateInView('2026-10-31', wed, 'month')).toBe(true);
    expect(isDateInView('2026-11-01', wed, 'month')).toBe(false);
  });

  it('week: Sunday–Saturday of the viewed week only', () => {
    expect(isDateInView('2026-10-11', wed, 'week')).toBe(true);
    expect(isDateInView('2026-10-17', wed, 'week')).toBe(true);
    expect(isDateInView('2026-10-10', wed, 'week')).toBe(false);
    expect(isDateInView('2026-10-18', wed, 'week')).toBe(false);
  });

  it('day: that day only', () => {
    expect(isDateInView('2026-10-14', wed, 'day')).toBe(true);
    expect(isDateInView('2026-10-15', wed, 'day')).toBe(false);
  });
});

describe('computeUnfilledSlots', () => {
  const need = (over: object = {}) => ({
    date: '2026-11-10',
    location_id: 'loc-1',
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 3,
    ...over,
  });
  const shift = (employee_id: string, over: object = {}) => ({
    date: '2026-11-10',
    location_id: 'loc-1',
    start_time: '09:00',
    end_time: '13:00',
    employee_id,
    ...over,
  });

  it('subtracts the shifts that have an employee', () => {
    const r = computeUnfilledSlots([need()], [shift('e1'), shift('e2')]);
    expect(r).toHaveLength(1);
    expect(r[0].remaining).toBe(1);
  });

  it('an open shift (no employee) does not fill a slot', () => {
    expect(computeUnfilledSlots([need()], [shift('')])[0].remaining).toBe(3);
  });

  it('drops a need that is fully staffed', () => {
    expect(computeUnfilledSlots([need({ employee_count: 1 })], [shift('e1')])).toEqual([]);
  });

  it('ignores shifts at another location or time', () => {
    const r = computeUnfilledSlots(
      [need()],
      [shift('e1', { location_id: 'loc-2' }), shift('e2', { start_time: '10:00' })],
    );
    expect(r[0].remaining).toBe(3);
  });

  it('narrows to one location when asked, and covers everything when not', () => {
    const needs = [need(), need({ location_id: 'loc-2' })];
    expect(computeUnfilledSlots(needs, [])).toHaveLength(2);
    expect(computeUnfilledSlots(needs, [], 'loc-2')).toHaveLength(1);
    expect(computeUnfilledSlots(needs, [], 'loc-9')).toHaveLength(0);
  });
});

describe('formatDateWithYear', () => {
  it('reads "Nov 10, 2026"', () => {
    expect(formatDateWithYear('2026-11-10')).toBe('Nov 10, 2026');
    expect(formatDateWithYear('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDateWithYear('2027-12-31')).toBe('Dec 31, 2027');
  });

  it('is a local date: the day never slips across a time-zone boundary', () => {
    expect(formatDateWithYear('2026-03-08')).toBe('Mar 8, 2026');
    expect(formatDateWithYear('2026-11-01')).toBe('Nov 1, 2026');
  });
});

describe('a slot Generate Draft already tried and could not fill', () => {
  const need = {
    date: '2026-11-10',
    location_id: 'loc-1',
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  };
  const marker = (over: object = {}) => ({
    date: '2026-11-10',
    location_id: 'loc-1',
    start_time: '09:00',
    end_time: '13:00',
    employee_id: '',
    status: 'draft_failed',
    ...over,
  });

  it('is flagged failed when the scheduler left a draft_failed marker for the same slot', () => {
    expect(computeUnfilledSlots([need], [marker()])[0].failed).toBe(true);
  });

  it('is not failed when nothing has been attempted', () => {
    expect(computeUnfilledSlots([need], [])[0].failed).toBe(false);
  });

  it('ignores a marker for a different location or time', () => {
    expect(computeUnfilledSlots([need], [marker({ location_id: 'loc-2' })])[0].failed).toBe(false);
    expect(computeUnfilledSlots([need], [marker({ start_time: '10:00' })])[0].failed).toBe(false);
  });

  it('a plain open shift (published, no employee) is not a "failed" marker', () => {
    expect(computeUnfilledSlots([need], [marker({ status: 'published' })])[0].failed).toBe(false);
  });

  it('the marker never counts as filling the slot', () => {
    expect(computeUnfilledSlots([need], [marker()])[0].remaining).toBe(1);
  });

  it('words a failed slot "Unfilled — no employee available" and an untried one "Not yet scheduled"', () => {
    expect(unfilledSlotLabels(true)).toEqual({
      tooltip: 'Unfilled — no employee available',
      chip: 'Unfilled',
      card: 'Unfilled — no employee available',
    });
    expect(unfilledSlotLabels(false)).toEqual({
      tooltip: 'Not yet scheduled',
      chip: 'Not Scheduled',
      card: 'Not Yet Scheduled',
    });
  });
});
