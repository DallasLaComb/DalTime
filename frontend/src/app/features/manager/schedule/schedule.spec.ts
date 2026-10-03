import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ManagerSchedule } from './schedule';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import { filterShifts } from '../../../core/utils/schedule.utils';
import type { ShiftStatusFilter } from '../../../core/utils/schedule.utils';
import type { Shift } from '../../../core/models/shift.model';

/** Minimal Shift factory — only the fields filterShifts inspects. */
function makeShift(overrides: Partial<Shift>): Shift {
  return {
    shift_id: 's1',
    org_id: 'org1',
    manager_id: 'm1',
    employee_id: 'e1',
    employee_name: 'Alice',
    location_id: 'l1',
    location_name: 'Main',
    date: '2026-06-01',
    start_time: '09:00',
    end_time: '17:00',
    type: 'morning',
    status: 'published',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('ManagerSchedule component', () => {
  let component: ManagerSchedule;
  let fixture: ComponentFixture<ManagerSchedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSchedule],
      providers: APP_TEST_PROVIDERS,
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerSchedule);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Verifies that clicking an amber shift chip (employee_id === '') routes to
   * openFillShiftViewForExistingShift, not openEditModal.  Story #360 requirement.
   */
  it('openShiftAction calls openFillShiftViewForExistingShift for unassigned shift', () => {
    const unassigned = makeShift({ shift_id: 'amber-1', employee_id: '' });
    // Cast to any-shaped object to spy on protected methods without TS access errors.
    const comp = component as unknown as Record<string, (s: Shift) => void>;
    const fillSpy = vi.spyOn(comp, 'openFillShiftViewForExistingShift');
    const editSpy = vi.spyOn(comp, 'openEditModal');
    comp['openShiftAction'](unassigned);
    expect(fillSpy).toHaveBeenCalledWith(unassigned);
    expect(editSpy).not.toHaveBeenCalled();
  });

  /**
   * Verifies that clicking an assigned shift chip still routes to openEditModal.
   * Story #360 requirement — ensures the dispatcher doesn't break the existing path.
   */
  it('openShiftAction calls openEditModal for an assigned shift', () => {
    const assigned = makeShift({ shift_id: 'assigned-1', employee_id: 'emp-99' });
    const comp = component as unknown as Record<string, (s: Shift) => void>;
    const fillSpy = vi.spyOn(comp, 'openFillShiftViewForExistingShift');
    const editSpy = vi.spyOn(comp, 'openEditModal');
    comp['openShiftAction'](assigned);
    expect(editSpy).toHaveBeenCalledWith(assigned);
    expect(fillSpy).not.toHaveBeenCalled();
  });
});

/**
 * Unit tests for the filterShifts utility — covers the status chip logic
 * introduced in story #333 (simplified in post-#333 revision to Filled/Unfilled).
 * "Filled" means employee_id !== ''; "Unfilled" means employee_id === ''.
 * Kept here because it exercises the same filter paths the manager schedule uses.
 */
describe('filterShifts — status chip logic', () => {
  // Filled: any shift that has an assigned employee
  const filledPublished = makeShift({ shift_id: 's-pub', status: 'published', employee_id: 'e1' });
  const filledDraft = makeShift({ shift_id: 's-draft', status: 'draft', employee_id: 'e1' });

  // Unfilled: any shift where no employee is assigned (regardless of status)
  const unfilledDraft = makeShift({
    shift_id: 's-udraft',
    status: 'draft',
    employee_id: '',
    employee_name: '',
  });
  const unfilledPublished = makeShift({
    shift_id: 's-upub',
    status: 'published',
    employee_id: '',
    employee_name: '',
  });
  const draftFailed = makeShift({
    shift_id: 's-failed',
    status: 'draft_failed',
    employee_id: '',
    employee_name: '',
  });

  const all = [filledPublished, filledDraft, unfilledDraft, unfilledPublished, draftFailed];

  it('should return all shifts when no status chips are selected (All state)', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(),
    });
    expect(result.length).toBe(5);
  });

  it('Filled chip returns only shifts with employee_id !== ""', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled']),
    });
    expect(result).toContain(filledPublished);
    expect(result).toContain(filledDraft);
    expect(result).not.toContain(unfilledDraft);
    expect(result).not.toContain(unfilledPublished);
    expect(result).not.toContain(draftFailed);
    expect(result.length).toBe(2);
  });

  it('Unfilled chip returns all shifts with employee_id === "" regardless of status', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['unfilled']),
    });
    expect(result).toContain(unfilledDraft);
    expect(result).toContain(unfilledPublished);
    expect(result).toContain(draftFailed);
    expect(result).not.toContain(filledPublished);
    expect(result).not.toContain(filledDraft);
    expect(result.length).toBe(3);
  });

  it('OR logic — Filled + Unfilled selected shows all shifts', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled', 'unfilled']),
    });
    expect(result.length).toBe(5);
  });

  it('should combine status chips with other filters using AND logic', () => {
    const result = filterShifts(all, {
      employee: '',
      location: 'l2',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled']),
    });
    expect(result.length).toBe(0);
  });

  it('should return all shifts when statusChips is undefined (backward compat)', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
    });
    expect(result.length).toBe(5);
  });

  it('Filled chip must NOT match shifts with empty employee_id', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled']),
    });
    expect(result).not.toContain(unfilledDraft);
    expect(result).not.toContain(unfilledPublished);
    expect(result).not.toContain(draftFailed);
  });

  it('Unfilled chip must NOT match shifts with assigned employees', () => {
    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['unfilled']),
    });
    expect(result).not.toContain(filledPublished);
    expect(result).not.toContain(filledDraft);
  });

  it('status chip + employee filter narrows to shifts matching both (AND, not OR)', () => {
    const result = filterShifts(all, {
      employee: 'e1',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled']),
    });
    expect(result).toContain(filledPublished);
    expect(result).toContain(filledDraft);
    expect(result).not.toContain(unfilledDraft);
    expect(result.length).toBe(2);
  });

  it('empty statusChips Set with employee filter still applies employee filter', () => {
    const result = filterShifts(all, {
      employee: 'e1',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(),
    });
    expect(result).toContain(filledPublished);
    expect(result).toContain(filledDraft);
    expect(result).not.toContain(unfilledDraft);
    expect(result).not.toContain(unfilledPublished);
    expect(result).not.toContain(draftFailed);
  });

  it('randomly selected chip returns correct non-empty subset', () => {
    const CHIPS: ShiftStatusFilter[] = ['filled', 'unfilled'];
    const seed = Math.floor(Date.now() / 30000);
    const chip = CHIPS[seed % CHIPS.length];

    const result = filterShifts(all, {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>([chip]),
    });

    expect(result.length).toBeGreaterThan(0);
    if (chip === 'filled') {
      expect(result.every((s) => s.employee_id !== '')).toBe(true);
    } else {
      expect(result.every((s) => s.employee_id === '')).toBe(true);
    }
  });

  it('returns empty array when chips are active but no shifts exist', () => {
    const result = filterShifts([], {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled', 'unfilled']),
    });
    expect(result).toEqual([]);
  });

  it('Filled chip returns empty when all shifts are unassigned', () => {
    const result = filterShifts([unfilledDraft, unfilledPublished, draftFailed], {
      employee: '',
      location: '',
      type: '',
      statusChips: new Set<ShiftStatusFilter>(['filled']),
    });
    expect(result).toEqual([]);
  });
});
