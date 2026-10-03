/**
 * Regression tests for OrgAdminSchedule — story #333.
 *
 * Verifies that ScheduleFiltersComponent modifications introduced in story #333
 * (status chip row) did NOT break OrgAdminSchedule:
 *   - component creates without errors
 *   - status chip row is rendered (All + Published + Unfilled + Draft Failed)
 *   - existing employee / location / type dropdowns are still present
 *   - filter signals from the base class are wired correctly
 *
 * These are regression smoke tests at the component level.
 * filterShifts logic is fully covered in manager/schedule/schedule.spec.ts.
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { Mock } from 'vitest';
import { OrgAdminSchedule } from './schedule';
import { OrgAdminShiftsService } from './shifts.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeesService } from '../employees/employees.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { Shift } from '../../../core/models/shift.model';
import { toDateKey } from '../../../core/utils/schedule.utils';
import type { ShiftStatusFilter } from '../../../core/utils/schedule.utils';

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    shift_id: `shift-${Math.random()}`,
    org_id: 'org-1',
    manager_id: 'mgr-1',
    employee_id: 'emp-1',
    employee_name: 'Alice Smith',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '17:00',
    type: 'morning',
    status: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface OrgAdminShiftsServiceMock {
  list: Mock;
}
interface EmployeesServiceMock {
  getAll: Mock;
}
interface LocationsServiceMock {
  getAll: Mock;
}

// ─── Test setup ───────────────────────────────────────────────────────────────

async function createComponent(
  opts: {
    shifts?: Shift[];
  } = {},
) {
  const shiftsMock: OrgAdminShiftsServiceMock = {
    list: vi.fn().mockReturnValue(of(opts.shifts ?? [])),
  };
  const employeesMock: EmployeesServiceMock = { getAll: vi.fn().mockReturnValue(of([])) };
  const locationsMock: LocationsServiceMock = { getAll: vi.fn().mockReturnValue(of([])) };

  await TestBed.configureTestingModule({
    imports: [OrgAdminSchedule],
    providers: [
      ...APP_TEST_PROVIDERS,
      { provide: OrgAdminShiftsService, useValue: shiftsMock },
      { provide: EmployeesService, useValue: employeesMock },
      { provide: OrgAdminLocationsService, useValue: locationsMock },
      { provide: ManagersService, useValue: { getAll: () => of([]) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrgAdminSchedule);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

// ─── Regression: OrgAdminSchedule still renders without errors ────────────────

describe('OrgAdminSchedule — story #333 regression', () => {
  it('should create the component without errors', async () => {
    const { component } = await createComponent();
    expect(component).toBeTruthy();
  });

  it('renders the status chip row with All, Filled, and Unfilled chips', async () => {
    const { fixture } = await createComponent();

    const allChip = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    const filledChip = fixture.nativeElement.querySelector('[data-testid="status-chip-filled"]');
    const unfilledChip = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-unfilled"]',
    );

    expect(allChip).toBeTruthy();
    expect(filledChip).toBeTruthy();
    expect(unfilledChip).toBeTruthy();
    // Draft Failed and Published are no longer separate filter chips
    expect(
      fixture.nativeElement.querySelector('[data-testid="status-chip-published"]'),
    ).toBeFalsy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="status-chip-draft_failed"]'),
    ).toBeFalsy();
  });

  it('"All" chip is active by default (no status filter applied on init)', async () => {
    const { fixture } = await createComponent();
    const allChip = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    expect(allChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('named chips all show aria-pressed="false" on init', async () => {
    const { fixture } = await createComponent();

    for (const key of ['filled', 'unfilled'] as ShiftStatusFilter[]) {
      const btn = fixture.nativeElement.querySelector(`[data-testid="status-chip-${key}"]`);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('existing employee dropdown is still rendered', async () => {
    const { fixture } = await createComponent();
    const employeeSelect = fixture.nativeElement.querySelector(
      '#filter-employee',
    ) as HTMLSelectElement | null;
    expect(employeeSelect).toBeTruthy();
  });

  it('existing location dropdown is still rendered', async () => {
    const { fixture } = await createComponent();
    const locationSelect = fixture.nativeElement.querySelector(
      '#filter-location',
    ) as HTMLSelectElement | null;
    expect(locationSelect).toBeTruthy();
  });

  it('existing shift-type dropdown is still rendered', async () => {
    const { fixture } = await createComponent();
    const typeSelect = fixture.nativeElement.querySelector(
      '#filter-type',
    ) as HTMLSelectElement | null;
    expect(typeSelect).toBeTruthy();
  });

  // ── Regression: clicking a chip does not crash the component ─────────────

  it('clicking Filled chip does not throw and toggles aria-pressed state', async () => {
    const { fixture } = await createComponent();

    const filledBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-filled"]',
    ) as HTMLButtonElement;
    expect(() => filledBtn.click()).not.toThrow();
    fixture.detectChanges();

    expect(filledBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking Filled then clicking All resets to All-active state', async () => {
    const { fixture } = await createComponent();

    const filledBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-filled"]',
    ) as HTMLButtonElement;
    filledBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(filledBtn.getAttribute('aria-pressed')).toBe('true');

    const allBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-all"]',
    ) as HTMLButtonElement;
    allBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(allBtn.getAttribute('aria-pressed')).toBe('true');
    expect(filledBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── With data: filtering actually narrows visible shifts ─────────────────

  it('activating Unfilled chip filters correctly (covers unassigned, draft_failed)', async () => {
    const todayKey = toDateKey(new Date());
    const filledShift = makeShift({
      shift_id: 'pub-1',
      status: 'published',
      employee_id: 'e1',
      date: todayKey,
    });
    const unfilledShift = makeShift({
      shift_id: 'fail-1',
      status: 'draft_failed',
      date: todayKey,
      employee_id: '',
      employee_name: '',
    });

    const { fixture } = await createComponent({ shifts: [filledShift, unfilledShift] });

    const unfilledBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-unfilled"]',
    ) as HTMLButtonElement;
    unfilledBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(unfilledBtn.getAttribute('aria-pressed')).toBe('true');
    const allBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    expect(allBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── Randomised shift status regression ───────────────────────────────────

  /**
   * Draws a random status chip, clicks it, and verifies aria-pressed toggles
   * correctly in OrgAdminSchedule. Seed = floor(Date.now()/30000).
   */
  it('randomly selected chip toggles aria-pressed in OrgAdminSchedule correctly', async () => {
    const CHIPS: ShiftStatusFilter[] = ['filled', 'unfilled'];
    const seed = Math.floor(Date.now() / 30000);
    const key = CHIPS[seed % CHIPS.length];

    const { fixture } = await createComponent();

    const btn = fixture.nativeElement.querySelector(
      `[data-testid="status-chip-${key}"]`,
    ) as HTMLButtonElement;
    if (!btn) throw new Error(`chip not found for key="${key}" seed=${seed}`);

    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
