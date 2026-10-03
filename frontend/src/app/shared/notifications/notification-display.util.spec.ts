import { formatNotificationTimestamp, getNotificationDisplay } from './notification-display.util';

describe('getNotificationDisplay()', () => {
  it('returns the known label/icon for each of the 4 currently-known types', () => {
    expect(getNotificationDisplay('INFO').label).toBe('Info');
    expect(getNotificationDisplay('APPROVAL').label).toBe('Approval');
    expect(getNotificationDisplay('REQUEST').label).toBe('Request');
    expect(getNotificationDisplay('SHIFT').label).toBe('Shift');
  });

  // This is the explicit extensibility test required by the story: a notification
  // type the frontend has never seen before (simulating a future backend-added
  // NotificationType) must still resolve to a sane, non-throwing default rather
  // than erroring or returning undefined.
  it('falls back to a generic label/icon for an unrecognized/future type value', () => {
    const result = getNotificationDisplay('FUTURE_TYPE');
    expect(result.label).toBe('Notification');
    expect(result.icon).toBeTruthy();
  });

  it('falls back for an empty string type', () => {
    const result = getNotificationDisplay('');
    expect(result.label).toBe('Notification');
  });
});

describe('formatNotificationTimestamp()', () => {
  it('formats a valid ISO timestamp without throwing', () => {
    expect(formatNotificationTimestamp('2026-06-18T12:00:00.000Z')).toBeTruthy();
  });

  it('returns the raw string unchanged for an unparseable timestamp instead of throwing', () => {
    expect(formatNotificationTimestamp('not-a-date')).toBe('not-a-date');
  });
});
