/**
 * Manager schedule actions — the manager view is where scheduling lives (an org admin gets here
 * through "View as Manager"): Generate Draft and Publish, with their confirmations and messages.
 */
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ManagerSchedule } from './schedule';
import { ManagerShiftsService } from './shifts.service';
import { ManagerShiftsNeededService } from '../shifts-needed/shifts-needed.service';
import { ManagerEmployeesService } from '../employees/employees.service';
import { ManagerLocationsService } from '../shifts-needed/locations.service';
import { ManagerScheduleService } from './schedule.service';
import { ManagerEmployeeAvailabilityService } from './employee-availability.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { Shift } from '../../../core/models/shift.model';
import { toDateKey } from '../../../core/utils/schedule.utils';

const draft = (i: number): Shift =>
  ({
    shift_id: `d${i}`,
    org_id: 'o',
    manager_id: 'me',
    employee_id: '',
    employee_name: '',
    location_id: 'loc-1',
    location_name: 'Main',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '17:00',
    type: 'morning',
    status: 'draft',
    created_at: '',
    updated_at: '',
  }) as Shift;

const LOCATIONS = [
  { location_id: 'loc-1', name: 'Main Floor' },
  { location_id: 'loc-2', name: 'Back Office' },
];

async function setup(
  shifts: Shift[],
  meta: { draftCount: number; maxDrafts: number; openSlots: number; openShifts?: number } = {
    draftCount: 2,
    maxDrafts: 10,
    openSlots: 4,
    openShifts: 0,
  },
  locations: object[] = LOCATIONS,
  employees: object[] = [],
  needed: object[] = [],
) {
  const needsApi = {
    list: vi.fn().mockReturnValue(of(needed)),
    remove: vi.fn().mockReturnValue(of(undefined)),
  };
  const shiftsApi = {
    list: vi.fn().mockReturnValue(of(shifts)),
    create: vi.fn().mockReturnValue(of(shifts[0])),
    update: vi.fn().mockReturnValue(of(shifts[0])),
    remove: vi.fn().mockReturnValue(of(undefined)),
  };
  const schedule = {
    getMeta: vi.fn().mockReturnValue(of(meta)),
    generateDraft: vi.fn(),
    publish: vi.fn().mockReturnValue(of({ published: shifts.length })),
  };
  await TestBed.configureTestingModule({
    imports: [ManagerSchedule],
    providers: [
      ...APP_TEST_PROVIDERS,
      { provide: ManagerShiftsService, useValue: shiftsApi },
      { provide: ManagerShiftsNeededService, useValue: needsApi },
      { provide: ManagerEmployeesService, useValue: { getAll: () => of(employees) } },
      { provide: ManagerLocationsService, useValue: { list: () => of(locations) } },
      { provide: ManagerScheduleService, useValue: schedule },
      {
        provide: ManagerEmployeeAvailabilityService,
        useValue: { getAllBundles: () => of(new Map()) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ManagerSchedule);
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
  const type = (id: string, value: string): void => {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  };
  return { fixture, q, click, type, schedule, shiftsApi, needsApi };
}

describe('ManagerSchedule — Publish', () => {
  it('says how many employees will see their shifts and how many open shifts are posted unassigned', async () => {
    const withEmployee = (i: number, emp: string) => ({ ...draft(i), employee_id: emp });
    const { q, click } = await setup([
      withEmployee(1, 'emp-1'),
      withEmployee(2, 'emp-1'),
      withEmployee(3, 'emp-2'),
      draft(4), // open
    ]);

    await click('publish-schedule');

    const text = q('publish-confirm-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('4 draft shifts');
    expect(q('publish-employee-count')!.textContent).toContain('2 employees');
    expect(text).toContain('1 open shift will be posted with no one assigned');
  });

  it('asks first: how many drafts, which month, and that employees will see them', async () => {
    const { q, click, schedule } = await setup([draft(1), draft(2), draft(3)]);

    await click('publish-schedule');

    const text = q('publish-confirm-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('3 draft shifts');
    expect(text).toMatch(/\w+ \d{4}/);
    expect(text).toContain('employees will be able to see them');
    expect(schedule.publish).not.toHaveBeenCalled();
  });

  it('publishes once confirmed, with plural-correct wording', async () => {
    const { q, click, schedule } = await setup([draft(1), draft(2), draft(3)]);

    await click('publish-schedule');
    await click('confirmation-modal-confirm');

    expect(schedule.publish).toHaveBeenCalledTimes(1);
    expect(q('schedule-action-result')!.textContent).toContain('3 shifts published');
  });

  it('says "1 shift published" for a single draft', async () => {
    const { q, click, schedule } = await setup([draft(1)]);
    schedule.publish.mockReturnValue(of({ published: 1 }));

    await click('publish-schedule');
    await click('confirmation-modal-confirm');

    expect(q('schedule-action-result')!.textContent).toContain('1 shift published');
  });

  it('does not publish when the dialog is cancelled', async () => {
    const { click, schedule } = await setup([draft(1), draft(2)]);

    await click('publish-schedule');
    await click('confirmation-modal-cancel');

    expect(schedule.publish).not.toHaveBeenCalled();
  });
});

describe('ManagerSchedule — Publish with no drafts', () => {
  const published = (): Shift => ({ ...draft(1), status: 'published', employee_id: 'emp-1' });

  it('shows Publish disabled, with a clear reason', async () => {
    const { q, schedule } = await setup([published()]);

    const button = (q('publish-schedule')!.querySelector('button') ??
      q('publish-schedule')) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(q('no-drafts-note')!.textContent).toMatch(/No draft shifts to publish in \w+ \d{4}\./);
    expect(q('no-drafts-note')!.textContent).toContain('1 shift published');
    expect(schedule.publish).not.toHaveBeenCalled();
  });

  it('clicking the disabled Publish does nothing (no dialog, no request)', async () => {
    const { q, click, schedule } = await setup([published()]);

    await click('publish-schedule');

    expect(q('publish-confirm-text')).toBeNull();
    expect(schedule.publish).not.toHaveBeenCalled();
  });

  it('enables Publish once there is a draft', async () => {
    const { q } = await setup([draft(1)]);
    const button = (q('publish-schedule')!.querySelector('button') ??
      q('publish-schedule')) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(q('no-drafts-note')).toBeNull();
  });
});

describe('ManagerSchedule — Generate Draft', () => {
  const result = (o: object) => ({
    created: 0,
    unfilled: 0,
    draftFailed: 0,
    draftCount: 3,
    maxDrafts: 10,
    openSlots: 1,
    ...o,
  });

  it('nobody available: counts the slots that stayed unfilled (not "0 shifts assigned")', async () => {
    const { q, click, schedule } = await setup([]);
    schedule.generateDraft.mockReturnValue(of(result({ created: 0, unfilled: 1 })));

    await click('generate-draft');
    await click('confirmation-modal-confirm');

    const t = q('schedule-action-result')!.textContent!;
    expect(t).toContain('Run 3/10: no one was available — 1 slot stayed unfilled.');
    expect(t).not.toContain('0 shifts assigned');
    expect(t).toContain('7 runs remaining');
  });

  it('some assigned: says how many were assigned and how many are still unfilled', async () => {
    const { q, click, schedule } = await setup([]);
    schedule.generateDraft.mockReturnValue(of(result({ created: 2, unfilled: 1, openSlots: 3 })));

    await click('generate-draft');
    await click('confirmation-modal-confirm');

    expect(q('schedule-action-result')!.textContent).toContain(
      'Run 3/10: 2 shifts assigned, 1 slot still unfilled.',
    );
  });

  it('nothing open: says so and does not claim a run was used', async () => {
    const { q, click, schedule } = await setup([]);
    schedule.generateDraft.mockReturnValue(of(result({ openSlots: 0, draftCount: 2 })));

    await click('generate-draft');
    await click('confirmation-modal-confirm');

    const t = q('schedule-action-result')!.textContent!;
    expect(t).toContain('No shifts needed to fill in');
    expect(t).not.toContain('Run ');
  });

  describe('status dialog', () => {
    const dialog = (q: (id: string) => Element | null) => q('generate-draft-status');

    it('shows "processing" with no way to close it while the run is pending, then needs Accept', async () => {
      const { q, click, schedule, fixture } = await setup([]);
      const pending = new Subject<ReturnType<typeof result>>();
      schedule.generateDraft.mockReturnValue(pending);

      expect(dialog(q)).toBeNull();
      await click('generate-draft');
      await click('confirmation-modal-confirm');

      expect(dialog(q)!.getAttribute('data-status')).toBe('processing');
      expect(q('generate-draft-status-text')!.textContent).toContain('Processing');
      const accept = q('generate-draft-status-accept') as HTMLButtonElement;
      expect(accept.disabled).toBe(true);

      // backdrop click, Escape and Enter do nothing while processing
      (dialog(q) as HTMLElement).click();
      dialog(q)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(dialog(q)!.getAttribute('data-status')).toBe('processing');
      expect(q('generate-draft-status')!.querySelector('[data-testid$="close"]')).toBeNull();

      pending.next(result({ created: 2, unfilled: 1, openSlots: 3 }));
      pending.complete();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(dialog(q)!.getAttribute('data-status')).toBe('success');
      expect(q('generate-draft-status-label')!.textContent).toContain('Success');
      expect(q('generate-draft-status-text')!.textContent).toContain(
        'Run 3/10: 2 shifts assigned, 1 slot still unfilled.',
      );
      // still on screen until acknowledged
      (dialog(q) as HTMLElement).click();
      fixture.detectChanges();
      expect(dialog(q)).toBeTruthy();

      await click('generate-draft-status-accept');
      expect(dialog(q)).toBeNull();
      expect(q('schedule-action-result')!.textContent).toContain('Run 3/10');
    });

    it('nobody available is still a completed run: shows the result and waits for Accept', async () => {
      const { q, click, schedule } = await setup([]);
      schedule.generateDraft.mockReturnValue(of(result({ created: 0, unfilled: 1 })));

      await click('generate-draft');
      await click('confirmation-modal-confirm');

      expect(dialog(q)!.getAttribute('data-status')).toBe('success');
      expect(q('generate-draft-status-text')!.textContent).toContain(
        'no one was available — 1 slot stayed unfilled.',
      );
      await click('generate-draft-status-accept');
      expect(dialog(q)).toBeNull();
    });

    it('a failed request shows "Failed" with the error text and needs Accept', async () => {
      const { q, click, schedule } = await setup([]);
      schedule.generateDraft.mockReturnValue(throwError(() => ({ error: {} })));

      await click('generate-draft');
      await click('confirmation-modal-confirm');

      expect(dialog(q)!.getAttribute('data-status')).toBe('failure');
      expect(q('generate-draft-status-label')!.textContent).toContain('Failed');
      expect(q('generate-draft-status-text')!.textContent).toContain(
        'Failed to generate draft schedule. Please try again.',
      );
      await click('generate-draft-status-accept');
      expect(dialog(q)).toBeNull();
    });

    it('cancelling the confirmation never opens the status dialog', async () => {
      const { q, click, schedule } = await setup([]);
      await click('generate-draft');
      await click('confirmation-modal-cancel');
      expect(dialog(q)).toBeNull();
      expect(schedule.generateDraft).not.toHaveBeenCalled();
    });
  });

  it('explains open shifts in the dialog: not generated, filled by hand', async () => {
    const { q, click } = await setup([], {
      draftCount: 2,
      maxDrafts: 10,
      openSlots: 0,
      openShifts: 3,
    });

    await click('generate-draft');

    const note = q('generate-draft-open-shifts')!.textContent!.replace(/\s+/g, ' ');
    expect(note).toContain('3 open shifts');
    expect(note).toContain('already exist');
    expect(q('generate-draft-open-shifts')!.textContent).toContain('Fill Shift');
  });

  it('warns in the dialog, before a run is spent, when there is nothing open', async () => {
    const { q, click, schedule } = await setup([], { draftCount: 2, maxDrafts: 10, openSlots: 0 });

    await click('generate-draft');

    expect(q('generate-draft-nothing-open')).toBeTruthy();
    expect(schedule.generateDraft).not.toHaveBeenCalled();
  });
});

const openShift = (over: Partial<Shift> = {}): Shift => ({
  ...draft(1),
  status: 'published',
  ...over,
});
const assignedShift = (over: Partial<Shift> = {}): Shift => ({
  ...draft(2),
  status: 'published',
  employee_id: 'emp-1',
  employee_name: 'Alice Smith',
  ...over,
});

describe('ManagerSchedule — edit and delete a shift', () => {
  it('an OPEN shift opens the Fill Shift tab, which offers Edit and Delete', async () => {
    const { q, click } = await setup([openShift()]);

    await click('shift-chip');

    expect(q('fill-shift-view')).toBeTruthy();
    expect(q('fill-edit-shift')).toBeTruthy();
    expect(q('fill-delete-shift')).toBeTruthy();
  });

  it('Edit from the Fill Shift tab opens the edit modal, prefilled, and saves via update', async () => {
    const { q, click, type, shiftsApi } = await setup([openShift({ location_id: 'loc-2' })]);

    await click('shift-chip');
    await click('fill-edit-shift');

    expect(q('modal-title')!.textContent).toContain('Edit Shift');
    expect((q('modal-location') as HTMLSelectElement).value).toBe('loc-2');
    type('modal-end', '18:00');
    await click('modal-save');

    expect(shiftsApi.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ location_id: 'loc-2', end_time: '18:00' }),
    );
    expect(q('fill-shift-view')).toBeNull(); // back on the schedule
  });

  it('Delete from the Fill Shift tab asks for confirmation first', async () => {
    const { q, click, shiftsApi } = await setup([openShift()]);

    await click('shift-chip');
    await click('fill-delete-shift');

    expect(q('delete-shift-text')).toBeTruthy();
    expect(shiftsApi.remove).not.toHaveBeenCalled();

    await click('confirmation-modal-confirm');

    expect(shiftsApi.remove).toHaveBeenCalledWith('d1');
    expect(q('fill-shift-view')).toBeNull();
  });

  it('cancelling the delete confirmation keeps the shift and stays on the Fill Shift tab', async () => {
    const { q, click, shiftsApi } = await setup([openShift()]);

    await click('shift-chip');
    await click('fill-delete-shift');
    await click('confirmation-modal-cancel');

    expect(shiftsApi.remove).not.toHaveBeenCalled();
    expect(q('confirmation-modal')).toBeNull();
    expect(q('fill-shift-view')).toBeTruthy();
    expect(q('shift-modal-backdrop')).toBeNull(); // never the edit modal
  });

  it('an assigned shift opens the edit modal, where Delete leads to a confirmation', async () => {
    const { q, click, shiftsApi } = await setup([assignedShift()]);

    await click('shift-chip');
    expect(q('modal-title')!.textContent).toContain('Edit Shift');
    await click('modal-delete');
    expect(shiftsApi.remove).not.toHaveBeenCalled();
    await click('confirmation-modal-confirm');

    expect(shiftsApi.remove).toHaveBeenCalledWith('d2');
  });
});

describe('ManagerSchedule — the delete dialog is its own dialog', () => {
  const dialogTitle = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement
      .querySelector('[data-testid="confirmation-modal"] h5')
      ?.textContent?.trim();

  it('is titled "Delete shift" — never "Edit Shift"', async () => {
    const { q, fixture, click } = await setup([assignedShift()]);

    await click('shift-chip');
    await click('modal-delete');

    expect(dialogTitle(fixture)).toBe('Delete shift');
    expect(q('modal-title')).toBeNull(); // the "Edit Shift" heading is gone with its modal
    expect(fixture.nativeElement.textContent).not.toContain('Edit Shift');
  });

  it('closes the edit modal when it opens, so the two never overlap', async () => {
    const { q, click } = await setup([assignedShift()]);

    await click('shift-chip');
    expect(q('shift-modal-backdrop')).toBeTruthy();
    await click('modal-delete');

    expect(q('shift-modal-backdrop')).toBeNull();
    expect(q('delete-shift-text')).toBeTruthy();
  });

  it('Cancel closes the dialog and does NOT bring back the edit modal', async () => {
    const { q, click, shiftsApi } = await setup([assignedShift()]);

    await click('shift-chip');
    await click('modal-delete');
    await click('confirmation-modal-cancel');

    expect(q('confirmation-modal')).toBeNull();
    expect(q('shift-modal-backdrop')).toBeNull();
    expect(q('modal-title')).toBeNull();
    expect(shiftsApi.remove).not.toHaveBeenCalled();
    expect(q('shift-chip')).toBeTruthy(); // the shift is still there
  });

  it('names what will be deleted: who, when, where', async () => {
    const { q, click } = await setup([assignedShift()]);

    await click('shift-chip');
    await click('modal-delete');

    const text = q('delete-shift-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Delete Alice Smith’s shift');
    expect(text).toContain('9:00 AM – 5:00 PM');
    expect(text).toContain('Main');
    expect(text).toContain("can't be undone");
  });

  it('says "the open shift" for a shift with no employee', async () => {
    const { q, click } = await setup([openShift()]);

    await click('shift-chip');
    await click('fill-delete-shift');

    expect(q('delete-shift-text')!.textContent).toContain('Delete the open shift');
  });

  it('a failed delete shows the error in the dialog and keeps it open', async () => {
    const { q, click, shiftsApi } = await setup([assignedShift()]);
    shiftsApi.remove.mockReturnValue(throwError(() => new Error('boom')));

    await click('shift-chip');
    await click('modal-delete');
    await click('confirmation-modal-confirm');

    expect(q('delete-shift-error')!.textContent).toContain('Failed to delete shift');
    expect(q('confirmation-modal')).toBeTruthy();
  });

  it('deleting removes the shift from the schedule', async () => {
    const { q, click } = await setup([assignedShift()]);

    await click('shift-chip');
    await click('modal-delete');
    await click('confirmation-modal-confirm');

    expect(q('confirmation-modal')).toBeNull();
    expect(q('shift-chip')).toBeNull();
  });
});

describe('ManagerSchedule — shift form validation', () => {
  it('does not silently pick a location: with several, none is preselected', async () => {
    const { q, click } = await setup([]);

    await click('add-shift');

    expect((q('modal-location') as HTMLSelectElement).value).toBe('');
  });

  it('saving with no location shows a field-level error and creates nothing', async () => {
    const { q, click, shiftsApi } = await setup([]);

    await click('add-shift');
    await click('modal-save');

    expect(q('error-location')!.textContent).toContain('Location is required');
    expect(shiftsApi.create).not.toHaveBeenCalled();
  });

  it('preselects the location when there is only one to choose', async () => {
    const { q, click } = await setup([], undefined, [LOCATIONS[0]]);

    await click('add-shift');

    expect((q('modal-location') as HTMLSelectElement).value).toBe('loc-1');
  });

  it('saves once a location is chosen', async () => {
    const { click, type, shiftsApi } = await setup([]);

    await click('add-shift');
    type('modal-location', 'loc-2');
    await click('modal-save');

    expect(shiftsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ location_id: 'loc-2' }),
    );
  });

  it('rejects an end time equal to the start time', async () => {
    const { q, click, type, shiftsApi } = await setup([]);

    await click('add-shift');
    type('modal-location', 'loc-1');
    type('modal-end', '09:00'); // start defaults to 09:00
    await click('modal-save');

    expect(q('error-end')!.textContent).toContain('different from the start');
    expect(shiftsApi.create).not.toHaveBeenCalled();
  });
});

describe('ManagerSchedule — open shifts are labelled honestly', () => {
  it('a published open shift is an "Open shift", never "Draft"', async () => {
    const { fixture, click } = await setup([openShift()]);

    await click('view-day');

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Open shift — no employee assigned');
    expect(text).not.toContain('Draft — no employee assigned');
  });

  it('a draft open shift says so', async () => {
    const { fixture, click } = await setup([openShift({ status: 'draft' })]);
    await click('view-day');
    expect(fixture.nativeElement.textContent).toContain('Draft open shift — no employee assigned');
  });
});

describe('ManagerSchedule — times are shown in AM/PM', () => {
  it('shows 12-hour times on the day card, never 24-hour', async () => {
    const { fixture, click } = await setup([
      openShift({ start_time: '13:30', end_time: '21:00', type: 'afternoon' }),
    ]);

    await click('view-day');

    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('1:30 PM');
    expect(text).toContain('9:00 PM');
    expect(text).not.toContain('13:30');
    expect(text).not.toContain('21:00');
  });
});

describe('ManagerSchedule — disabled employees are not schedulable', () => {
  const EMPLOYEES = [
    {
      employee_id: 'emp-on',
      first_name: 'Ada',
      last_name: 'Active',
      status: 'CONFIRMED',
      manager_id: 'me',
    },
    {
      employee_id: 'emp-off',
      first_name: 'Dee',
      last_name: 'Disabled',
      status: 'DISABLED',
      manager_id: 'me',
    },
  ];
  const optionNames = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '#modal-employee option',
      ) as NodeListOf<HTMLOptionElement>,
    ).map((o) => o.textContent!.replace(/\s+/g, ' ').trim());

  it('the Add Shift employee choices leave out a disabled employee', async () => {
    const { fixture, click } = await setup([], undefined, LOCATIONS, EMPLOYEES);

    await click('add-shift');

    const names = optionNames(fixture);
    expect(names).toContain('Ada Active');
    expect(names).not.toContain('Dee Disabled');
  });

  it('editing a shift that is already on a disabled employee still shows them, selected', async () => {
    const onDisabled = {
      ...draft(1),
      status: 'published' as const,
      employee_id: 'emp-off',
      employee_name: 'Dee Disabled',
    };
    const { fixture, click, q } = await setup([onDisabled], undefined, LOCATIONS, EMPLOYEES);

    await click('shift-chip');

    expect(optionNames(fixture)).toContain('Dee Disabled');
    expect((q('modal-employee') as HTMLSelectElement).value).toBe('emp-off');
  });
});

describe('ManagerSchedule — Month view "not scheduled" chip (regression: "1:NaNa")', () => {
  const need = (over: object = {}) => ({
    shift_id: 'sn-1',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });
  const chips = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="unfilled-chip"]'),
    ) as HTMLElement[];

  it('shows "9a–1p" for a 9:00 AM – 1:00 PM slot — never NaN', async () => {
    const { fixture } = await setup([], undefined, LOCATIONS, [], [need()]);

    const chip = chips(fixture)[0];
    expect(chip).toBeTruthy();
    expect(chip.textContent!.replace(/\s+/g, ' ')).toContain('9a–1p');
    expect(chip.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it.each([
    ['08:00', '12:00', '8a–12p'],
    ['12:00', '20:00', '12p–8p'],
    ['16:00', '23:30', '4p–11:30p'],
    ['22:00', '06:00', '10p–6a (+1)'],
  ])('formats %s–%s as %s', async (start, end, expected) => {
    const { fixture } = await setup(
      [],
      undefined,
      LOCATIONS,
      [],
      [need({ start_time: start, end_time: end })],
    );
    expect(chips(fixture)[0].textContent!.replace(/\s+/g, ' ')).toContain(expected);
  });

  it('the tooltip says "1 position needed" / "2 positions needed", never "position(s)"', async () => {
    const one = await setup([], undefined, LOCATIONS, [], [need({ employee_count: 1 })]);
    expect(chips(one.fixture)[0].getAttribute('title')).toContain('1 position needed');
    TestBed.resetTestingModule();
    const two = await setup([], undefined, LOCATIONS, [], [need({ employee_count: 2 })]);
    const title = chips(two.fixture)[0].getAttribute('title')!;
    expect(title).toContain('2 positions needed');
    expect(title).not.toContain('position(s)');
    expect(title).toContain('9:00 AM'); // the tooltip is still 12-hour
  });
});

describe('ManagerSchedule — overnight shifts in the form, header and tooltips', () => {
  it('previews "10:00 PM – 6:00 AM (+1)" in the Add Shift form, with an overnight note', async () => {
    const { q, click, type } = await setup([]);

    await click('add-shift');
    type('modal-start', '22:00');
    type('modal-end', '06:00');

    const preview = q('modal-time-range')!.textContent!.replace(/\s+/g, ' ');
    expect(preview).toContain('10:00 PM – 6:00 AM (+1)');
    expect(preview).toContain('overnight, ends the next day');
  });

  it('previews a same-day shift without any next-day marker', async () => {
    const { q, click, type } = await setup([]);

    await click('add-shift');
    type('modal-start', '09:00');
    type('modal-end', '17:00');

    expect(q('modal-time-range')!.textContent).toContain('9:00 AM – 5:00 PM');
    expect(q('modal-time-range')!.textContent).not.toContain('(+1)');
  });

  it('shows no preview while the times are equal (nothing to preview)', async () => {
    const { q, click, type } = await setup([]);

    await click('add-shift');
    type('modal-end', '09:00'); // start defaults to 09:00

    expect(q('modal-time-range')).toBeNull();
  });

  it('the preview also appears when editing a shift', async () => {
    const night = {
      ...draft(1),
      status: 'published' as const,
      employee_id: 'emp-1',
      start_time: '22:00',
      end_time: '06:00',
      type: 'night' as const,
    };
    const { q, click } = await setup([night]);

    await click('shift-chip');

    expect(q('modal-time-range')!.textContent).toContain('10:00 PM – 6:00 AM (+1)');
  });

  it('a field error clears as soon as the field is corrected — no stale error until Save', async () => {
    const { q, click, type } = await setup([]);

    await click('add-shift');
    type('modal-location', 'loc-1');
    type('modal-end', '09:00'); // equal to the 09:00 start
    await click('modal-save');
    expect(q('error-end')!.textContent).toContain('different from the start');

    type('modal-end', '17:00'); // fix it — no Save
    expect(q('error-end')).toBeNull();
  });

  it('an error that is still wrong stays, and a new one appears live after the first Save', async () => {
    const { q, click, type } = await setup([]);

    await click('add-shift');
    await click('modal-save'); // location missing
    expect(q('error-location')).toBeTruthy();

    type('modal-start', ''); // now the start is missing too, without another Save
    expect(q('error-start')!.textContent).toContain('Start time is required');
    expect(q('error-location')).toBeTruthy();
  });

  it('shows no errors before the first Save attempt', async () => {
    const { q, click } = await setup([]);

    await click('add-shift');

    expect(q('error-location')).toBeNull();
    expect(q('error-end')).toBeNull();
  });

  it('the Fill Shift header marks an overnight shift "(+1)"', async () => {
    const night = {
      ...draft(1),
      status: 'published' as const,
      start_time: '22:00',
      end_time: '06:00',
      type: 'night' as const,
    };
    const { q, click } = await setup([night]);

    await click('shift-chip');

    expect(q('fill-shift-view')!.textContent!.replace(/\s+/g, ' ')).toContain(
      '10:00 PM – 6:00 AM (+1)',
    );
  });

  it('the chip tooltip marks the next day, and stays 12-hour', async () => {
    const night = {
      ...draft(1),
      status: 'published' as const,
      employee_id: 'emp-1',
      start_time: '22:00',
      end_time: '06:00',
      type: 'night' as const,
    };
    const { q } = await setup([night]);

    const title = q('shift-chip')!.getAttribute('title')!;
    expect(title).toContain('10:00 PM – 6:00 AM (+1)');
    expect(title).not.toMatch(/22:00|06:00/);
  });

  it('a same-day chip tooltip has no next-day marker', async () => {
    const day = { ...draft(1), status: 'published' as const, employee_id: 'emp-1' };
    const { q } = await setup([day]);

    expect(q('shift-chip')!.getAttribute('title')).toContain('9:00 AM – 5:00 PM');
    expect(q('shift-chip')!.getAttribute('title')).not.toContain('(+1)');
  });
});

describe('ManagerSchedule — footer counts match what is on screen (regression: month totals in Day/Week)', () => {
  // A slot ~10 days from today, in the same month: a different day AND a different week.
  const today = new Date();
  const other = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() <= 15 ? today.getDate() + 10 : today.getDate() - 10,
  );
  const slot = (over: object = {}) => ({
    shift_id: 'sn-x',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(other),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });

  it('Day view: a slot on another day is not counted in the footer', async () => {
    const { fixture, q, click } = await setup([], undefined, LOCATIONS, [], [slot()]);

    await click('view-day');

    expect(q('total-unscheduled')).toBeNull();
    expect(q('unfilled-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
  });

  it('Week view: a slot in another week is not counted in the footer', async () => {
    const { q, click } = await setup([], undefined, LOCATIONS, [], [slot()]);

    await click('view-week');

    expect(q('total-unscheduled')).toBeNull();
  });

  it('Month view: the same slot is counted', async () => {
    const { q } = await setup([], undefined, LOCATIONS, [], [slot()]);

    expect(q('total-unscheduled')!.textContent!.replace(/\s+/g, ' ')).toContain(
      '1 slot not yet scheduled',
    );
  });

  it('a slot on the viewed day is counted in Day view', async () => {
    const { q, click } = await setup(
      [],
      undefined,
      LOCATIONS,
      [],
      [slot({ date: toDateKey(today) })],
    );

    await click('view-day');

    expect(q('total-unscheduled')!.textContent).toContain('1 slot');
    expect(q('day-unscheduled')!.textContent).toContain('1 slot');
  });
});

describe('ManagerSchedule — "filtered from N total" counts slots too (#30)', () => {
  const today = new Date();
  const need = (over: object = {}) => ({
    shift_id: 'sn-x',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
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
    const { fixture, click } = await setup([], undefined, LOCATIONS, [], [need()]);
    await click('view-day');

    setLocation(fixture, 'loc-2'); // the 4 slots are at loc-1

    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
    expect(footer(fixture)).toBe('— filtered from 4 total (0 shifts + 4 slots not yet scheduled)');
  });

  it('counts shifts and slots together in the total', async () => {
    const { fixture, click } = await setup(
      [
        {
          ...draft(1),
          status: 'published' as const,
          employee_id: 'emp-1',
          start_time: '15:00',
          end_time: '19:00',
        },
      ],
      undefined,
      LOCATIONS,
      [],
      [need()],
    );
    await click('view-day');

    setLocation(fixture, 'loc-2');

    expect(footer(fixture)).toBe('— filtered from 5 total (1 shift + 4 slots not yet scheduled)');
  });

  it('shows no "filtered from" text without a filter', async () => {
    const { fixture, click } = await setup([], undefined, LOCATIONS, [], [need()]);
    await click('view-day');

    expect(footer(fixture)).toBe('');
  });

  it('with no slots the total is just the shifts (no breakdown)', async () => {
    const { fixture, click } = await setup(
      [{ ...draft(1), status: 'published' as const, employee_id: 'emp-1' }],
      undefined,
      LOCATIONS,
      [],
      [],
    );
    await click('view-day');

    setLocation(fixture, 'loc-2');

    expect(footer(fixture)).toBe('— filtered from 1 total');
  });
});

describe('ManagerSchedule — delete a shift needed from its "Not yet scheduled" slot', () => {
  const need = (over: object = {}) => ({
    shift_id: 'sn-10',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
    ...over,
  });
  const openSlot = async () => {
    const ctx = await setup([], undefined, LOCATIONS, [], [need()]);
    await ctx.click('unfilled-chip');
    return ctx;
  };

  it('clicking a slot opens its Fill Shift tab, which offers "Delete shift needed"', async () => {
    const { q } = await openSlot();

    expect(q('fill-shift-view')).toBeTruthy();
    expect(q('fill-delete-need')).toBeTruthy();
    expect(q('fill-delete-need')!.textContent).toContain('Delete shift needed');
  });

  it('a real shift does not get the shift-needed button (and a slot does not get the shift buttons)', async () => {
    const { q } = await openSlot();
    expect(q('fill-delete-shift')).toBeNull();
    expect(q('fill-edit-shift')).toBeNull();
  });

  it('asks first, naming the date, time, location and head-count — and deletes nothing yet', async () => {
    const { q, click, needsApi } = await openSlot();

    await click('fill-delete-need');

    const text = q('delete-need-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Delete the shift needed on');
    expect(text).toContain('9:00 AM – 1:00 PM');
    expect(text).toContain('Main Floor');
    expect(text).toContain('1 employee needed');
    expect(text).toContain('Shifts already created from it are not removed');
    expect(needsApi.remove).not.toHaveBeenCalled();
  });

  it('the dialog is titled "Delete shift needed"', async () => {
    const { fixture, click } = await openSlot();

    await click('fill-delete-need');

    expect(
      fixture.nativeElement
        .querySelector('[data-testid="confirmation-modal"] h5')
        ?.textContent?.trim(),
    ).toBe('Delete shift needed');
  });

  it('Cancel keeps the slot and stays on the Fill Shift tab', async () => {
    const { q, click, needsApi } = await openSlot();

    await click('fill-delete-need');
    await click('confirmation-modal-cancel');

    expect(needsApi.remove).not.toHaveBeenCalled();
    expect(q('confirmation-modal')).toBeNull();
    expect(q('fill-shift-view')).toBeTruthy();
  });

  it('confirming deletes it, returns to the schedule, and the slot is gone', async () => {
    const { q, click, needsApi } = await openSlot();

    await click('fill-delete-need');
    await click('confirmation-modal-confirm');

    expect(needsApi.remove).toHaveBeenCalledWith('sn-10');
    expect(q('fill-shift-view')).toBeNull();
    expect(q('unfilled-chip')).toBeNull();
    expect(q('total-unscheduled')).toBeNull();
  });

  it('a failed delete shows the error in the dialog and keeps the slot', async () => {
    const { q, click, needsApi } = await openSlot();
    needsApi.remove.mockReturnValue(throwError(() => new Error('boom')));

    await click('fill-delete-need');
    await click('confirmation-modal-confirm');

    expect(q('delete-need-error')!.textContent).toContain('Failed to delete the shift needed');
    expect(q('confirmation-modal')).toBeTruthy();
    expect(q('fill-shift-view')).toBeTruthy();
  });
});

describe('ManagerSchedule — failed vs not-yet-scheduled slot wording', () => {
  const today = new Date();
  const need = () => ({
    shift_id: 'sn-f',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  });
  const failedMarker = () => ({
    ...draft(9),
    status: 'draft_failed' as const,
    employee_id: '',
    location_id: 'loc-1',
    date: toDateKey(today),
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
    const { fixture } = await setup([failedMarker()], undefined, LOCATIONS, [], [need()]);

    expect(slotText(fixture, 'unfilled-chip')[0]).toContain('Unfilled');
    expect(slotText(fixture, 'unfilled-chip')[0]).not.toContain('Not Scheduled');
    expect(chipTitles(fixture)[0]).toContain(
      'Unfilled — no employee available · 9:00 AM – 1:00 PM',
    );
    expect(chipTitles(fixture)[0]).not.toContain('Not yet scheduled');
  });

  it('and as "Unfilled — no employee available" on its day card', async () => {
    const { fixture, click } = await setup([failedMarker()], undefined, LOCATIONS, [], [need()]);
    await click('view-day');

    const card = slotText(fixture, 'unfilled-card')[0];
    expect(card).toContain('Unfilled — no employee available');
    expect(card).not.toContain('Not Yet Scheduled');
    expect(card).toContain('1 employee needed');
  });

  it('a slot nobody has tried yet still reads "Not yet scheduled"', async () => {
    const { fixture, click } = await setup([], undefined, LOCATIONS, [], [need()]);

    expect(slotText(fixture, 'unfilled-chip')[0]).toContain('Not Scheduled');
    expect(chipTitles(fixture)[0]).toContain('Not yet scheduled · 9:00 AM – 1:00 PM');
    await click('view-day');
    expect(slotText(fixture, 'unfilled-card')[0]).toContain('Not Yet Scheduled');
    expect(slotText(fixture, 'unfilled-card')[0]).not.toContain('Unfilled');
  });
});

describe('ManagerSchedule — draft_failed markers are not shifts (each failed slot appears ONCE)', () => {
  const today = new Date();
  const need = () => ({
    shift_id: 'sn-f',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  });
  const marker = () => ({
    ...draft(9),
    status: 'draft_failed' as const,
    employee_id: '',
    location_id: 'loc-1',
    date: toDateKey(today),
    start_time: '09:00',
    end_time: '13:00',
  });
  const count = (fixture: { nativeElement: HTMLElement }, testid: string) =>
    fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`).length;

  it('a failed slot shows as one "Unfilled" slot chip and NO extra shift chip for its marker', async () => {
    const { fixture } = await setup([marker()], undefined, LOCATIONS, [], [need()]);

    expect(count(fixture, 'unfilled-chip')).toBe(1);
    expect(count(fixture, 'shift-chip')).toBe(0);
  });

  it('on the Day view: one slot card, no shift card for the marker', async () => {
    const { fixture, click } = await setup([marker()], undefined, LOCATIONS, [], [need()]);
    await click('view-day');

    expect(count(fixture, 'unfilled-card')).toBe(1);
    expect(count(fixture, 'shift-card')).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('0 shifts');
  });

  it('the marker is not counted as a shift in the footer', async () => {
    const { fixture, click } = await setup([marker()], undefined, LOCATIONS, [], [need()]);
    await click('view-day');

    expect(fixture.nativeElement.textContent).toContain('0 shifts in view');
  });

  it('a marker whose slot no longer exists is invisible (no stray "Unfilled" shift chip)', async () => {
    const { fixture } = await setup([marker()], undefined, LOCATIONS, [], []);

    expect(count(fixture, 'shift-chip')).toBe(0);
    expect(count(fixture, 'unfilled-chip')).toBe(0);
  });
});

describe('ManagerSchedule — empty-state wording with only open slots', () => {
  const need = {
    shift_id: 'sn-e',
    org_id: 'o',
    manager_id: 'me',
    location_id: 'loc-1',
    location_name: 'Main Floor',
    date: toDateKey(new Date()),
    start_time: '09:00',
    end_time: '13:00',
    employee_count: 1,
  };
  const emptyText = (fixture: { nativeElement: HTMLElement }) =>
    (fixture.nativeElement.querySelector('app-empty-state')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  it('no shifts and no slots: invites you to schedule your first shift', async () => {
    const { fixture } = await setup([]);
    expect(emptyText(fixture)).toContain('No shifts yet');
    expect(emptyText(fixture)).toContain('schedule your first shift');
  });

  it('only open slots: does not claim there is nothing to schedule — points to Generate Draft', async () => {
    const { fixture } = await setup([], undefined, undefined, undefined, [need]);
    const t = emptyText(fixture);
    expect(t).not.toContain('No shifts yet');
    expect(t).not.toContain('first shift');
    expect(t).toContain('Some slots still need an employee');
    expect(t).toContain('Generate Draft');
  });
});
