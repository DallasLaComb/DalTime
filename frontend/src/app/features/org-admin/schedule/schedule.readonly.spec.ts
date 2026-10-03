/**
 * OrgAdminSchedule is a READ-ONLY oversight view. An org admin oversees the organization; adding,
 * editing and deleting shifts, Generate Draft, Publish and templates are manager work, done in
 * "View as Manager". These tests pin that split so scheduling controls can't creep back in.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OrgAdminSchedule } from './schedule';
import { OrgAdminShiftsService } from './shifts.service';
import { OrgAdminShiftsNeededService } from './shifts-needed.service';
import { OrgAdminManagerOptionsService } from '../manager-options.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeesService } from '../employees/employees.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { Shift } from '../../../core/models/shift.model';
import { toDateKey } from '../../../core/utils/schedule.utils';

const MANAGER = { manager_id: 'mgr-1', first_name: 'Mona', last_name: 'Lisa', status: 'CONFIRMED' };
const SELF = { manager_id: 'admin-1', first_name: 'Olive', last_name: 'Admin (you)' };

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    shift_id: 'shift-1',
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
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

async function setup(shifts: Shift[] = [], needed: object[] = [], neededFails = false) {
  const shiftsMock = { list: vi.fn().mockReturnValue(of(shifts)) };
  const neededMock = {
    list: vi.fn().mockReturnValue(neededFails ? throwError(() => new Error('boom')) : of(needed)),
  };
  await TestBed.configureTestingModule({
    imports: [OrgAdminSchedule],
    providers: [
      ...APP_TEST_PROVIDERS,
      { provide: OrgAdminShiftsService, useValue: shiftsMock },
      { provide: OrgAdminShiftsNeededService, useValue: neededMock },
      {
        provide: OrgAdminManagerOptionsService,
        useValue: { self: signal(SELF), withSelf: <T extends object>(m: T[]) => [SELF, ...m] },
      },
      { provide: ManagersService, useValue: { getAll: () => of([MANAGER]) } },
      {
        provide: EmployeesService,
        useValue: {
          getAll: () =>
            of([
              {
                employee_id: 'emp-1',
                first_name: 'Alice',
                last_name: 'Smith',
                manager_id: 'mgr-1',
              },
            ]),
        },
      },
      {
        provide: OrgAdminLocationsService,
        useValue: { getAll: () => of([{ location_id: 'loc-1', name: 'Main Floor' }]) },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrgAdminSchedule);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const q = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const click = async (id: string): Promise<void> => {
    const el = q(id)!;
    (el.querySelector('button') ?? el).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, q, click, shiftsMock, neededMock };
}

describe('OrgAdminSchedule — read-only oversight', () => {
  it('has no scheduling controls: no Add Shift, Generate Draft, Publish, manager picker or templates', async () => {
    const { q, fixture } = await setup([makeShift()]);

    for (const id of [
      'add-shift',
      'generate-draft',
      'publish-schedule',
      'schedule-manager',
      'schedule-tools',
      'apply-template',
      'template-list',
    ]) {
      expect(q(id), id).toBeNull();
    }
    expect(fixture.nativeElement.textContent).not.toContain('Add Shift');
  });

  it('still shows the shifts, the filters and the exports', async () => {
    const { q } = await setup([makeShift()]);

    expect(q('shift-chip')).toBeTruthy();
    expect(q('export-csv')).toBeTruthy();
    expect(q('export-pdf')).toBeTruthy();
  });

  it('clicking a shift does not open an editor', async () => {
    const { q, fixture } = await setup([makeShift()]);

    q('shift-chip')!.click();
    fixture.detectChanges();

    expect(q('shift-modal-backdrop')).toBeNull();
    expect(q('modal-save')).toBeNull();
    expect(q('modal-delete')).toBeNull();
  });

  it('points to View as Manager for scheduling, and says where open slots are counted', async () => {
    const { q } = await setup([makeShift()]);

    const note = q('oversight-note')!.textContent!.replace(/\s+/g, ' ');
    expect(note).toContain('Read-only');
    expect(note).toContain('Not yet scheduled');
    expect(note).toContain('Overview');
    expect(note).toContain('View as Manager');
  });

  it('the empty state explains who schedules instead of offering to add a shift', async () => {
    const { fixture } = await setup([]);

    const text = fixture.nativeElement
      .querySelector('app-empty-state')
      .textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Shifts appear here once managers schedule them');
    expect(text).toContain('View as Manager');
    expect(text).not.toContain('add a shift');
  });

  it('with only open slots the empty state says slots need an employee (not "No shifts yet")', async () => {
    const need = {
      shift_id: 'sn-1',
      org_id: 'org-1',
      manager_id: 'mgr-1',
      location_id: 'loc-1',
      date: toDateKey(new Date()),
      start_time: '09:00',
      end_time: '13:00',
      employee_count: 2,
    };
    const { fixture } = await setup([], [need]);
    const text = fixture.nativeElement
      .querySelector('app-empty-state')
      .textContent.replace(/\s+/g, ' ');
    expect(text).not.toContain('No shifts yet');
    expect(text).toContain('Some slots still need an employee');
    expect(text).toContain('View as Manager');
  });

  it('never calls anything but the list endpoint', async () => {
    const { shiftsMock } = await setup([makeShift()]);

    expect(shiftsMock.list).toHaveBeenCalled();
    expect(Object.keys(shiftsMock)).toEqual(['list']);
  });
});

describe('OrgAdminSchedule — how shifts read', () => {
  it('shows an overnight shift as ending the next day on its chip and day card', async () => {
    const { q, click } = await setup([
      makeShift({ start_time: '22:00', end_time: '06:00', type: 'night' }),
    ]);

    expect(q('shift-chip')!.textContent).toContain('10p–6a (+1)');
    await click('view-day');
    expect(q('next-day')!.textContent).toContain('+1 day');
  });

  it('says "Unknown location" for a removed location — never a raw id', async () => {
    const { fixture, click } = await setup([makeShift({ location_id: '43b1e55a-b86f-4961-adb6' })]);

    await click('view-day');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Unknown location');
    expect(text).not.toContain('43b1e55a');
  });

  it('names an open shift and the manager whose schedule it is on', async () => {
    const { fixture, click } = await setup([makeShift({ employee_id: '' })]);

    await click('view-day');

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Open shift');
    expect(text).toContain('Mona Lisa');
  });

  it('names the admin as "Olive Admin (you)" on a shift they own (one name, one "(you)")', async () => {
    const { fixture, click } = await setup([makeShift({ manager_id: 'admin-1' })]);

    await click('view-day');

    expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain('Olive Admin (you)');
  });
});

describe('OrgAdminSchedule — "not yet scheduled" slots (read-only)', () => {
  const NEED = {
    shift_id: 'sn-1',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 2,
  };
  const assigned = (employee_id: string) =>
    makeShift({ start_time: '09:00', end_time: '13:00', employee_id });

  it('loads the month’s shifts-needed alongside the shifts', async () => {
    const { neededMock } = await setup([], [NEED]);
    expect(neededMock.list).toHaveBeenCalled();
  });

  it('shows a labelled card on the day, with manager, location and employees needed', async () => {
    const { q, fixture, click } = await setup([], [NEED]);

    await click('view-day');

    expect(q('unfilled-card')).toBeTruthy();
    const text = q('unfilled-card')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Not Yet Scheduled');
    expect(text).toContain('Mona Lisa');
    expect(text).toContain('2 employees needed');
    // read-only: the card is not a button and offers no action
    expect(q('unfilled-card')!.querySelector('button')).toBeNull();
    void fixture;
  });

  it('counts the slots in the day header and the footer, apart from the shifts', async () => {
    const { q, click } = await setup([assigned('emp-1')], [NEED]);

    await click('view-day');

    expect(q('day-unscheduled')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '· 1 slot not yet scheduled',
    );
    expect(q('total-unscheduled')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '· 1 slot not yet scheduled',
    );
  });

  it('an assigned shift fills a slot; an open shift (no employee) does not', async () => {
    const full = await setup([assigned('emp-1'), assigned('emp-2')], [NEED]);
    await full.click('view-day');
    expect(full.q('unfilled-card')).toBeNull();
    expect(full.q('total-unscheduled')).toBeNull();
    TestBed.resetTestingModule();

    const open = await setup([assigned('')], [NEED]);
    await open.click('view-day');
    expect(open.q('total-unscheduled')!.textContent).toContain('2 slots');
  });

  it('shows slots for every manager — the admin’s own and another manager’s — each named', async () => {
    const { q, fixture, click } = await setup(
      [],
      [
        NEED, // Mona Lisa (mgr-1)
        {
          ...NEED,
          shift_id: 'sn-2',
          manager_id: 'admin-1',
          start_time: '14:00',
          end_time: '18:00',
        },
      ],
    );

    await click('view-day');

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="unfilled-card"]',
      ) as NodeListOf<HTMLElement>,
    ).map((c) => c.textContent!.replace(/\s+/g, ' '));
    expect(cards).toHaveLength(2);
    expect(cards.some((t) => t.includes('Mona Lisa') && t.includes('9:00 AM'))).toBe(true);
    expect(cards.some((t) => t.includes('Olive Admin (you)') && t.includes('2:00 PM'))).toBe(true);
    // each need asks for 2 employees, so 2 needs = 4 employee-slots
    expect(q('total-unscheduled')!.textContent).toContain('4 slots');
  });

  it('still renders the calendar when the shifts-needed call fails', async () => {
    const { q, fixture } = await setup([makeShift()], [], true);

    expect(q('shift-chip')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-error-alert')).toBeNull();
    expect(q('total-unscheduled')).toBeNull();
    // ...and it says so, instead of silently showing no slots (the cause of "slots missing")
    expect(q('slots-error')!.textContent).toContain('"not yet scheduled" slots');
  });

  it('shows no warning when the slots loaded', async () => {
    const { q } = await setup([makeShift()], []);
    expect(q('slots-error')).toBeNull();
  });
});

describe('OrgAdminSchedule — times are shown in AM/PM', () => {
  it('shows 12-hour times on the day card, never 24-hour', async () => {
    const { fixture, click } = await setup([makeShift({ start_time: '14:00', end_time: '22:30' })]);

    await click('view-day');

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('2:00 PM');
    expect(text).toContain('10:30 PM');
    expect(text).not.toContain('14:00');
    expect(text).not.toContain('22:30');
  });
});

describe('OrgAdminSchedule — Month view "not scheduled" chip (regression: "1:NaNa")', () => {
  const need = (over: object = {}) => ({
    shift_id: 'sn-1',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });

  it('shows "9a–1p", never NaN, and a correct plural tooltip', async () => {
    const { fixture } = await setup([], [need({ employee_count: 2 })]);

    const chip = fixture.nativeElement.querySelector(
      '[data-testid="unfilled-chip"]',
    ) as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.textContent!.replace(/\s+/g, ' ')).toContain('9a–1p');
    expect(chip.textContent).not.toMatch(/NaN|null|undefined/);
    expect(chip.getAttribute('title')).toContain('2 positions needed');
    expect(chip.getAttribute('title')).not.toContain('position(s)');
  });
});

describe('OrgAdminSchedule — footer counts match what is on screen (regression: month totals in Day/Week)', () => {
  // A slot ~10 days from today, in the same month: a different day AND a different week.
  const today = new Date();
  const other = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() <= 15 ? today.getDate() + 10 : today.getDate() - 10,
  );
  const slot = (over: object = {}) => ({
    shift_id: 'sn-x',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(other),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });

  it('Day view: a slot on another day is not counted in the footer', async () => {
    const { fixture, q, click } = await setup([], [slot()]);

    await click('view-day');

    expect(q('total-unscheduled')).toBeNull();
    expect(q('unfilled-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
  });

  it('Week view: a slot in another week is not counted in the footer', async () => {
    const { q, click } = await setup([], [slot()]);

    await click('view-week');

    expect(q('total-unscheduled')).toBeNull();
  });

  it('Month view: the same slot is counted', async () => {
    const { q } = await setup([], [slot()]);

    expect(q('total-unscheduled')!.textContent!.replace(/\s+/g, ' ')).toContain(
      '1 slot not yet scheduled',
    );
  });

  it('a slot on the viewed day is counted in Day view', async () => {
    const { q, click } = await setup([], [slot({ date: toDateKey(today) })]);

    await click('view-day');

    expect(q('total-unscheduled')!.textContent).toContain('1 slot');
    expect(q('day-unscheduled')!.textContent).toContain('1 slot');
  });
});

describe('OrgAdminSchedule — "not yet scheduled" chip tooltip (#29)', () => {
  const need = (over: object = {}) => ({
    shift_id: 'sn-1',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });
  const titles = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="unfilled-chip"]',
      ) as NodeListOf<HTMLElement>,
    ).map((c) => c.getAttribute('title')!);

  it('names the time range, the manager and the positions — same time text as the Manager view', async () => {
    const { fixture } = await setup([], [need()]);

    expect(titles(fixture)[0]).toBe(
      'Not yet scheduled · 9:00 AM – 1:00 PM · Mona Lisa · 1 position needed',
    );
  });

  it('shows the admin as "(you)" for the admin’s own slot, and pluralises positions', async () => {
    const { fixture } = await setup([], [need({ manager_id: 'admin-1', employee_count: 2 })]);

    expect(titles(fixture)[0]).toBe(
      'Not yet scheduled · 9:00 AM – 1:00 PM · Olive Admin (you) · 2 positions needed',
    );
  });

  it('is 12-hour, never 24-hour', async () => {
    const { fixture } = await setup([], [need({ start_time: '13:30', end_time: '21:00' })]);

    expect(titles(fixture)[0]).toContain('1:30 PM – 9:00 PM');
    expect(titles(fixture)[0]).not.toMatch(/13:30|21:00/);
  });
});

describe('OrgAdminSchedule — "filtered from N total" counts slots too (#30)', () => {
  const today = new Date();
  const need = (over: object = {}) => ({
    shift_id: 'sn-x',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 4,
    ...over,
  });
  const setLocation = (
    fixture: { componentInstance: unknown; detectChanges: () => void },
    id: string,
  ) => {
    (fixture.componentInstance as { setLocationFilter: (e: Event) => void }).setLocationFilter({
      target: { value: id },
    } as unknown as Event);
    fixture.detectChanges();
  };
  const footer = (fixture: { nativeElement: HTMLElement }) =>
    (fixture.nativeElement.querySelector('[data-testid="filtered-from"]')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  it('a filter that hides 4 slots says so, instead of "filtered from 0 total"', async () => {
    const { fixture, click } = await setup([], [need()]);
    await click('view-day');

    setLocation(fixture, 'loc-2'); // the 4 slots are at loc-1

    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
    expect(footer(fixture)).toBe('— filtered from 4 total (0 shifts + 4 slots not yet scheduled)');
  });

  it('counts shifts and slots together in the total', async () => {
    const { fixture, click } = await setup(
      [makeShift({ start_time: '15:00', end_time: '19:00' })],
      [need()],
    );
    await click('view-day');

    setLocation(fixture, 'loc-2');

    expect(footer(fixture)).toBe('— filtered from 5 total (1 shift + 4 slots not yet scheduled)');
  });

  it('shows no "filtered from" text without a filter', async () => {
    const { fixture, click } = await setup([], [need()]);
    await click('view-day');

    expect(footer(fixture)).toBe('');
  });

  it('with no slots the total is just the shifts (no breakdown)', async () => {
    const { fixture, click } = await setup([makeShift()], []);
    await click('view-day');

    setLocation(fixture, 'loc-2');

    expect(footer(fixture)).toBe('— filtered from 1 total');
  });
});

describe('OrgAdminSchedule — failed vs not-yet-scheduled slot wording', () => {
  const today = new Date();
  const need = () => ({
    shift_id: 'sn-f',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  });
  const failedMarker = () =>
    makeShift({
      status: 'draft_failed',
      employee_id: '',
      location_id: 'loc-1',
      start_time: '09:00',
      end_time: '13:00',
    });
  const slotText = (fixture: { nativeElement: HTMLElement }, testid: string) =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        `[data-testid="${testid}"]`,
      ) as NodeListOf<HTMLElement>,
    ).map((e) => e.textContent!.replace(/\s+/g, ' ').trim());
  const chipTitles = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="unfilled-chip"]',
      ) as NodeListOf<HTMLElement>,
    ).map((e) => e.getAttribute('title') ?? '');

  it('a slot Generate Draft could not fill reads "Unfilled" on its chip and in its tooltip', async () => {
    const { fixture } = await setup([failedMarker()], [need()]);

    expect(slotText(fixture, 'unfilled-chip')[0]).toContain('Unfilled');
    expect(slotText(fixture, 'unfilled-chip')[0]).not.toContain('Not Scheduled');
    expect(chipTitles(fixture)[0]).toContain(
      'Unfilled — no employee available · 9:00 AM – 1:00 PM',
    );
    expect(chipTitles(fixture)[0]).not.toContain('Not yet scheduled');
  });

  it('and as "Unfilled — no employee available" on its day card', async () => {
    const { fixture, click } = await setup([failedMarker()], [need()]);
    await click('view-day');

    const card = slotText(fixture, 'unfilled-card')[0];
    expect(card).toContain('Unfilled — no employee available');
    expect(card).not.toContain('Not Yet Scheduled');
    expect(card).toContain('1 employee needed');
  });

  it('a slot nobody has tried yet still reads "Not yet scheduled"', async () => {
    const { fixture, click } = await setup([], [need()]);

    expect(slotText(fixture, 'unfilled-chip')[0]).toContain('Not Scheduled');
    expect(chipTitles(fixture)[0]).toContain('Not yet scheduled · 9:00 AM – 1:00 PM');
    await click('view-day');
    expect(slotText(fixture, 'unfilled-card')[0]).toContain('Not Yet Scheduled');
    expect(slotText(fixture, 'unfilled-card')[0]).not.toContain('Unfilled');
  });
});

describe('OrgAdminSchedule — draft_failed markers are not shifts (each failed slot appears ONCE)', () => {
  const today = new Date();
  const need = () => ({
    shift_id: 'sn-f',
    org_id: 'org-1',
    manager_id: 'mgr-1',
    location_id: 'loc-1',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  });
  const marker = () =>
    makeShift({
      status: 'draft_failed',
      employee_id: '',
      location_id: 'loc-1',
      start_time: '09:00',
      end_time: '13:00',
    });
  const count = (fixture: { nativeElement: HTMLElement }, testid: string) =>
    fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`).length;

  it('a failed slot shows as one "Unfilled" slot chip and NO extra shift chip for its marker', async () => {
    const { fixture } = await setup([marker()], [need()]);

    expect(count(fixture, 'unfilled-chip')).toBe(1);
    expect(count(fixture, 'shift-chip')).toBe(0);
  });

  it('on the Day view: one slot card, no shift card for the marker', async () => {
    const { fixture, click } = await setup([marker()], [need()]);
    await click('view-day');

    expect(count(fixture, 'unfilled-card')).toBe(1);
    expect(count(fixture, 'shift-card')).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('0 shifts');
  });

  it('the marker is not counted as a shift in the footer', async () => {
    const { fixture, click } = await setup([marker()], [need()]);
    await click('view-day');

    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
  });

  it('a marker whose slot no longer exists is invisible (no stray "Unfilled" shift chip)', async () => {
    const { fixture } = await setup([marker()], []);

    expect(count(fixture, 'shift-chip')).toBe(0);
    expect(count(fixture, 'unfilled-chip')).toBe(0);
  });
});
