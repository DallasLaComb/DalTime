import type { ShiftType } from './models/manager/shift.model.js';

/**
 * A shift's type is derived from the time it STARTS — it is never chosen separately, so a 9–5
 * shift can never be labelled "Night". Keep in step with `deriveShiftType` in
 * `frontend/src/app/core/utils/schedule.utils.ts` (the boundary tests in both pin the same table).
 *
 *   Morning    starts 1:00 AM – 11:59 AM
 *   Afternoon  starts 12:00 PM – 4:59 PM
 *   Night      starts 5:00 PM – 12:59 AM (includes midnight)
 */
export function deriveShiftType(startTime: string): ShiftType {
  const hour = Number.parseInt(startTime.split(':')[0], 10);
  if (hour >= 1 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'night';
}
