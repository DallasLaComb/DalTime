/**
 * Deleting a shift need or a template removes data that can't be recovered, so both ask first.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ManagerShiftsNeededComponent } from './shifts-needed';
import { ManagerShiftsNeededService } from './shifts-needed.service';
import { ManagerLocationsService } from './locations.service';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import { toMonthKey } from '../../../core/utils/schedule.utils';

const monthDate = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${toMonthKey(d)}-10`;
};

const NEED = {
  shift_id: 'sn-1',
  org_id: 'o',
  manager_id: 'me',
  date: monthDate(),
  start_time: '09:00',
  end_time: '13:00',
  employee_count: 2,
  location_id: 'loc-1',
  location_name: 'Main Floor',
};
const TEMPLATE = {
  template_id: 'tpl-1',
  name: 'Weekday',
  location_id: 'loc-1',
  location_name: 'Main Floor',
  shift_blocks: [],
};

async function setup() {
  const needs = {
    list: vi.fn().mockReturnValue(of([NEED])),
    remove: vi.fn().mockReturnValue(of(undefined)),
  };
  const templates = {
    list: vi.fn().mockReturnValue(of([TEMPLATE])),
    remove: vi.fn().mockReturnValue(of(undefined)),
  };
  await TestBed.configureTestingModule({
    imports: [ManagerShiftsNeededComponent],
    providers: [
      ...APP_TEST_PROVIDERS,
      { provide: ManagerShiftsNeededService, useValue: needs },
      {
        provide: ManagerLocationsService,
        useValue: { list: () => of([{ location_id: 'loc-1', name: 'Main Floor' }]) },
      },
      { provide: ScheduleTemplatesService, useValue: templates },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ManagerShiftsNeededComponent);
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
  return { q, click, needs, templates };
}

describe('ManagerShiftsNeeded — delete a shift need', () => {
  it('asks for confirmation instead of deleting immediately', async () => {
    const { q, click, needs } = await setup();

    await click('delete-shift-btn');

    expect(needs.remove).not.toHaveBeenCalled();
    const text = q('delete-shift-confirm-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('9:00 AM–1:00 PM');
    expect(text).toContain('Main Floor');
  });

  it('deletes once confirmed', async () => {
    const { q, click, needs } = await setup();

    await click('delete-shift-btn');
    await click('confirmation-modal-confirm');

    expect(needs.remove).toHaveBeenCalledWith('sn-1');
    expect(q('shift-card')).toBeNull();
  });

  it('keeps the shift need when the dialog is cancelled', async () => {
    const { q, click, needs } = await setup();

    await click('delete-shift-btn');
    await click('confirmation-modal-cancel');

    expect(needs.remove).not.toHaveBeenCalled();
    expect(q('shift-card')).toBeTruthy();
    expect(q('delete-shift-confirm-text')).toBeNull();
  });
});

describe('ManagerShiftsNeeded — times are shown in AM/PM', () => {
  it('lists the need as 9:00 AM – 1:00 PM and confirms deletion in the same form', async () => {
    const { q, click } = await setup();

    const card = q('shift-time')!.textContent!.replace(/\s+/g, ' ');
    expect(card).toContain('9:00 AM');
    expect(card).toContain('1:00 PM');
    expect(card).not.toContain('09:00');

    await click('delete-shift-btn');
    const confirm = q('delete-shift-confirm-text')!.textContent!.replace(/\s+/g, ' ');
    expect(confirm).toContain('9:00 AM–1:00 PM');
  });
});

describe('ManagerShiftsNeeded — dates read like the rest of the page, not as 2026-11-10', () => {
  it('the delete-shift dialog shows "Nov 10, 2026", never the ISO date', async () => {
    const { q, click } = await setup();

    await click('delete-shift-btn');

    const text = q('delete-shift-confirm-text')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toMatch(/Delete the shift need on [A-Z][a-z]{2} 10, \d{4} from/);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('ManagerShiftsNeeded — delete a template', () => {
  it('asks first, then deletes once confirmed', async () => {
    const { q, click, templates } = await setup();

    await click('templates-btn');
    await click('delete-template-btn');
    expect(templates.remove).not.toHaveBeenCalled();
    expect(q('delete-template-confirm-text')!.textContent).toContain('Weekday');

    await click('confirmation-modal-confirm');
    expect(templates.remove).toHaveBeenCalledWith('tpl-1');
  });

  it('does not delete when cancelled', async () => {
    const { click, templates } = await setup();

    await click('templates-btn');
    await click('delete-template-btn');
    await click('confirmation-modal-cancel');

    expect(templates.remove).not.toHaveBeenCalled();
  });
});
