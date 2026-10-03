import type { Shift, ShiftType } from '../models/shift.model';
import type { EmployeeResponse } from '../models/employee.model';
import type { ManagerLocation } from '../models/manager-location.model';

export type ViewMode = 'day' | 'week' | 'month';

export const SHIFT_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700 border border-sky-200',
  afternoon: 'bg-amber-100 text-amber-700 border border-amber-200',
  night: 'bg-violet-100 text-violet-700 border border-violet-200',
};

export const SHIFT_BORDER_STYLES: Record<ShiftType, string> = {
  morning: 'border-l-sky-400',
  afternoon: 'border-l-amber-400',
  night: 'border-l-violet-400',
};

export const SHIFT_BADGE_STYLES: Record<ShiftType, string> = {
  morning: 'bg-sky-100 text-sky-700',
  afternoon: 'bg-amber-100 text-amber-700',
  night: 'bg-violet-100 text-violet-700',
};

/**
 * A shift's type is derived from the time it STARTS — it is never chosen separately, so a 9–5
 * shift can never be labelled "Night". Keep in step with `deriveShiftType` in
 * `backend/src/functions/shared/shift-type.ts` (both specs pin the same boundary table).
 */
export function deriveShiftType(startTime: string): ShiftType {
  const hour = Number.parseInt(startTime.split(':')[0], 10);
  if (hour >= 1 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'night';
}

/** The derivation rule, in display order — rendered verbatim by the shift-type hint. */
export const SHIFT_TYPE_RULES: readonly { type: ShiftType; label: string; range: string }[] = [
  { type: 'morning', label: 'Morning', range: 'starts 1:00 AM – 11:59 AM' },
  { type: 'afternoon', label: 'Afternoon', range: 'starts 12:00 PM – 4:59 PM' },
  { type: 'night', label: 'Night', range: 'starts 5:00 PM – 12:59 AM' },
];

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Shared schedule helper functions ─────────────────────────────────────────

export function getWeekStart(d: Date): Date {
  const result = new Date(d);
  result.setDate(d.getDate() - d.getDay());
  return result;
}

export function isToday(d: Date, today: Date): boolean {
  return toDateKey(d) === toDateKey(today);
}

export function isTodayDay(day: number | null, currentDate: Date, today: Date): boolean {
  if (day === null) return false;
  return (
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    day === today.getDate()
  );
}

export function dayAbbrev(d: Date): string {
  return d.toLocaleString('default', { weekday: 'short' });
}

export function employeeName(id: string, employees: EmployeeResponse[]): string {
  const emp = employees.find((e) => e.employee_id === id);
  return emp ? `${emp.first_name} ${emp.last_name}` : id;
}

export function shortName(id: string, employees: EmployeeResponse[]): string {
  const emp = employees.find((e) => e.employee_id === id);
  if (!emp) return id;
  return emp.last_name ? `${emp.first_name} ${emp.last_name[0]}.` : emp.first_name;
}

/** A location that can't be resolved (e.g. since removed) reads "Unknown location" — never its raw id. */
export const UNKNOWN_LOCATION = 'Unknown location';

export function locationName(id: string, locations: ManagerLocation[]): string {
  return locations.find((l) => l.location_id === id)?.name ?? UNKNOWN_LOCATION;
}

export function shortLocation(id: string, locations: ManagerLocation[]): string {
  const name = locationName(id, locations);
  return name.length > 8 ? name.slice(0, 8) + '…' : name;
}

export function shortTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'a' : 'p';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
}

/**
 * A shift whose end is earlier than its start runs overnight and ends the next day (22:00–06:00).
 * Keep in step with `crossesMidnight` in `backend/src/functions/shared/shift-time.ts`.
 */
export function shiftCrossesMidnight(start: string, end: string): boolean {
  return end < start;
}

/** Length in minutes, counting an overnight shift through midnight. */
export function shiftMinutes(start: string, end: string): number {
  const toMin = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(end) - toMin(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

/** "10p–6a (+1)" — compact range for chips; flags an end that falls on the next day. */
export function shortTimeRange(start: string, end: string): string {
  return `${shortTime(start)}–${shortTime(end)}${shiftCrossesMidnight(start, end) ? ' (+1)' : ''}`;
}

/** "14:30" → "2:30 PM", "00:00" → "12:00 AM". Anything that isn't HH:MM is returned unchanged. */
export function formatTime12(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return time ?? '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "10:00 PM – 6:00 AM (+1)" — full range for detail views and exports. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12(start)} – ${formatTime12(end)}${shiftCrossesMidnight(start, end) ? ' (+1)' : ''}`;
}

export function buildViewLabel(currentDate: Date, viewMode: ViewMode): string {
  if (viewMode === 'month')
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  if (viewMode === 'week') {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.toLocaleString('default', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return currentDate.toLocaleString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildCalendarWeeks(currentDate: Date): (number | null)[][] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...new Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function buildWeekDays(currentDate: Date): Date[] {
  const weekStart = getWeekStart(currentDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function scheduleExportFilename(currentDate: Date, viewMode: ViewMode): string {
  if (viewMode === 'month')
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  if (viewMode === 'week') return `week-of-${toDateKey(getWeekStart(currentDate))}`;
  return toDateKey(currentDate);
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "2026-11-10" → "Nov 10, 2026". Parsed as a local date, so it never slips a day across time zones. */
export function formatDateWithYear(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Shared schedule filter/grouping utilities ─────────────────────────────────

/**
 * Display-level status filter chips.
 * 'filled'   → employee_id !== '' (shift has an assigned employee)
 * 'unfilled' → employee_id === '' (no assigned employee — covers published-open,
 *              draft_failed, and any other unassigned status)
 *
 * This is separate from ShiftStatus because the filter groups by assignment state,
 * not by backend status value.
 */
export type ShiftStatusFilter = 'filled' | 'unfilled';

export interface ShiftFilters {
  employee: string;
  location: string;
  type: string;
  /** OR-logic: show shifts that match any chip in this set.
   *  An empty set means "All" — no status filter applied. */
  statusChips?: Set<ShiftStatusFilter>;
}

/**
 * Returns true if a given shift matches the active status chip selection.
 * Uses OR logic — a shift passes if it matches any chip in the set.
 * Returns true when the set is empty (no chip selected = show all).
 */
function matchesStatusChips(shift: Shift, chips: Set<ShiftStatusFilter>): boolean {
  if (chips.size === 0) return true;
  if (chips.has('filled') && shift.employee_id !== '') return true;
  if (chips.has('unfilled') && shift.employee_id === '') return true;
  return false;
}

/**
 * Filters a flat array of shifts by the active filter values.
 * Status chips use OR logic — a shift is shown if it matches any selected chip.
 * Employee/location/type filters use AND logic with each other.
 */
export function filterShifts(shifts: Shift[], filters: ShiftFilters): Shift[] {
  return shifts.filter((s) => {
    if (filters.employee && s.employee_id !== filters.employee) return false;
    if (filters.location && s.location_id !== filters.location) return false;
    if (filters.type && s.type !== filters.type) return false;
    if (filters.statusChips && !matchesStatusChips(s, filters.statusChips)) return false;
    return true;
  });
}

export function groupShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = map.get(shift.date) ?? [];
    map.set(shift.date, [...existing, shift]);
  }
  return map;
}

/** A staffing need: one date/location/time block that wants `employee_count` people. */
export interface NeedLike {
  date: string;
  location_id: string;
  start_time: string;
  end_time: string;
  employee_count: number;
}

/**
 * The needs that still lack people, with how many are missing. A need is filled only by a shift WITH
 * an employee on the same date/location/time (an open shift doesn't fill it). Pass `locationFilter`
 * to narrow to one location; omit it for the unfiltered picture.
 */
export function computeUnfilledSlots<N extends NeedLike>(
  needed: N[],
  shifts: (Pick<Shift, 'date' | 'location_id' | 'start_time' | 'end_time' | 'employee_id'> & {
    status?: string;
  })[],
  locationFilter = '',
): { shiftNeeded: N; remaining: number; failed: boolean }[] {
  const result: { shiftNeeded: N; remaining: number; failed: boolean }[] = [];
  for (const sn of needed) {
    if (locationFilter && sn.location_id !== locationFilter) continue;
    const filled = shifts.filter(
      (s) =>
        s.date === sn.date &&
        s.location_id === sn.location_id &&
        s.start_time === sn.start_time &&
        s.end_time === sn.end_time &&
        s.employee_id !== '',
    ).length;
    const remaining = sn.employee_count - filled;
    if (remaining > 0) {
      // The scheduler leaves a `draft_failed` marker on a slot it tried and couldn't fill.
      const failed = shifts.some(
        (s) =>
          s.status === 'draft_failed' &&
          s.date === sn.date &&
          s.location_id === sn.location_id &&
          s.start_time === sn.start_time &&
          s.end_time === sn.end_time,
      );
      result.push({ shiftNeeded: sn, remaining, failed });
    }
  }
  return result;
}

/**
 * How a slot that still lacks people is worded. Never attempted = "Not yet scheduled"; Generate Draft
 * ran and nobody was available = "Unfilled — no employee available".
 */
export function unfilledSlotLabels(failed: boolean): {
  tooltip: string;
  chip: string;
  card: string;
} {
  return failed
    ? {
        tooltip: 'Unfilled — no employee available',
        chip: 'Unfilled',
        card: 'Unfilled — no employee available',
      }
    : { tooltip: 'Not yet scheduled', chip: 'Not Scheduled', card: 'Not Yet Scheduled' };
}

/** Whether a `YYYY-MM-DD` date falls in the month, week or day being viewed. */
export function isDateInView(date: string, currentDate: Date, viewMode: ViewMode): boolean {
  if (viewMode === 'week') {
    const weekStart = getWeekStart(currentDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      if (toDateKey(d) === date) return true;
    }
    return false;
  }
  if (viewMode === 'day') return date === toDateKey(currentDate);
  return date.startsWith(toMonthKey(currentDate));
}

export function getVisibleShifts(
  filteredShifts: Shift[],
  currentDate: Date,
  viewMode: ViewMode,
): Shift[] {
  return filteredShifts.filter((s) => isDateInView(s.date, currentDate, viewMode));
}

// ── Generate / publish result messages ─────────────────────────────────────────

/** "1 slot" / "3 slots". A missing or non-numeric count reads as 0 — never "null" or "NaN". */
const countOf = (n: number | null | undefined, one: string, many = `${one}s`): string => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `${v} ${v === 1 ? one : many}`;
};

export interface GenerateOutcome {
  created: number;
  unfilled: number;
  draftCount: number;
  maxDrafts: number;
  /** Slots that were open before the run; 0 means there was nothing to fill (no run consumed). */
  openSlots?: number;
  /** Open shifts (no employee) this month. Generate Draft fills shifts needed, not these. */
  openShifts?: number;
}

/** Whose schedule and which month a message is about; `managerName` is omitted on the manager's own page. */
export interface ScheduleScope {
  managerName?: string | null;
  monthLabel: string;
}

/**
 * Generate Draft fills SHIFTS NEEDED (the slots on the Shifts needed page). A shift that already
 * exists with no employee is an "open shift": it is staffed by hand (Fill Shift), not generated.
 * Say so, so "nothing to fill" next to a visible open shift is never a mystery.
 */
export function noOpenShiftsMessage(
  { managerName, monthLabel }: ScheduleScope,
  openShifts = 0,
): string {
  const base = `No shifts needed to fill${managerName ? ` for ${managerName}` : ''} in ${monthLabel}.`;
  return openShifts > 0
    ? `${base} ${countOf(openShifts, 'open shift')} already exist${openShifts === 1 ? 's' : ''} with no employee — Generate Draft doesn't fill those; click one and use Fill Shift.`
    : base;
}

/** The three Generate Draft outcomes: nothing open, open but nobody available, or shifts assigned. */
export function generateDraftMessage(r: GenerateOutcome, scope: ScheduleScope): string {
  // Nothing was open. `created === 0 && unfilled === 0` means the same thing for a response from a
  // backend that predates `openSlots`: never claim "0 slots stayed unfilled".
  if (r.openSlots === 0 || (r.created === 0 && r.unfilled === 0))
    return noOpenShiftsMessage(scope, r.openShifts);
  const run = `Run ${r.draftCount}/${r.maxDrafts}`;
  if (r.created === 0) {
    return `${run}: no one was available — ${countOf(r.unfilled, 'slot')} stayed unfilled.`;
  }
  const assigned = `${countOf(r.created, 'shift')} assigned`;
  return r.unfilled > 0
    ? `${run}: ${assigned}, ${countOf(r.unfilled, 'slot')} still unfilled.`
    : `${run}: ${assigned}.`;
}

/** "1 position needed" / "2 positions needed" — the tooltip on a not-yet-scheduled slot. */
export function positionsNeeded(remaining: number): string {
  return `${countOf(remaining, 'position')} needed`;
}

export function publishedMessage(published: number): string {
  return published === 0
    ? 'No draft shifts were published.'
    : `${countOf(published, 'shift')} published — now visible to employees.`;
}

export function noDraftsToPublishMessage({ managerName, monthLabel }: ScheduleScope): string {
  return `There are no draft shifts to publish${managerName ? ` for ${managerName}` : ''} in ${monthLabel}.`;
}
