/**
 * Shift times are "HH:MM" strings on the shift's start date. A shift whose end is *earlier* than its
 * start runs overnight and ends the next day (22:00–06:00). End equal to start is not a valid shift.
 * Keep in step with `shiftCrossesMidnight` in `frontend/src/app/core/utils/schedule.utils.ts`.
 */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return endTime < startTime;
}

/** True when the pair is a valid shift span: any two different times (end < start = next day). */
export function isValidShiftSpan(startTime: string, endTime: string): boolean {
  return endTime !== startTime;
}

/** Length in minutes, counting an overnight shift through midnight. */
export function shiftMinutes(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(endTime) - toMin(startTime);
  return diff > 0 ? diff : diff + 24 * 60;
}
