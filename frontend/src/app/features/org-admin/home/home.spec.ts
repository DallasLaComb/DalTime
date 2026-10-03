import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrgAdminHome } from './home';
import { OrgAdminOverviewService, type OrgAdminOverview } from './overview.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

const OVERVIEW: OrgAdminOverview = {
  week_start: '2026-07-05',
  week_end: '2026-07-11',
  unfilled_slots: 5,
  unfilled_shifts: 3,
  drafts_to_publish: 7,
  drafts_window_days: 60,
  open_swap_requests: 2,
  headcount: {
    employees: 12,
    managers: 2,
    locations: 3,
    pending_invites: 1,
    disabled_employees: 0,
    disabled_managers: 0,
    unassigned_employees: 2,
  },
  own_schedule: { employees: 0, unfilled_slots: 0, unfilled_shifts: 0, drafts: 0 },
  managers: [
    {
      manager_id: 'm1',
      name: 'Ann Lee',
      employees: 8,
      unfilled_slots: 5,
      unfilled_shifts: 3,
      drafts: 7,
    },
    {
      manager_id: 'm2',
      name: 'Bob Ray',
      employees: 4,
      unfilled_slots: 0,
      unfilled_shifts: 0,
      drafts: 0,
    },
  ],
};

describe('OrgAdminHome', () => {
  let fixture: ComponentFixture<OrgAdminHome>;
  const get = vi.fn();

  const q = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string | undefined => q(id)?.textContent?.replace(/\s+/g, ' ').trim();

  async function mount(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [OrgAdminHome],
      providers: [...APP_TEST_PROVIDERS, { provide: OrgAdminOverviewService, useValue: { get } }],
    }).compileComponents();
    fixture = TestBed.createComponent(OrgAdminHome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    get.mockReset().mockReturnValue(of(OVERVIEW));
  });

  it('shows the four headline numbers', async () => {
    await mount();
    expect(text('tile-unfilled-value')).toBe('5');
    expect(text('tile-drafts-value')).toBe('7');
    expect(text('tile-requests-value')).toBe('2');
    expect(text('tile-headcount-value')).toBe('12');
    expect(text('tile-unfilled')).toContain('across 3 shifts');
    expect(text('tile-drafts')).toContain('next 60 days');
    expect(text('tile-headcount')).toContain('2 managers');
  });

  it('labels the week', async () => {
    await mount();
    expect(text('home-week')).toBe('Week of Jul 5 – Jul 11');
  });

  it('links the tiles to the pages where the work is done', async () => {
    await mount();
    expect(q('tile-unfilled')!.getAttribute('href')).toBe('/org-admin/schedule');
    expect(q('tile-drafts')!.getAttribute('href')).toBe('/org-admin/schedule');
    expect(q('tile-headcount')!.getAttribute('href')).toBe('/org-admin/employees');
  });

  it('lets a long name wrap on phones (keeping its "(you)") and gives it a tooltip', async () => {
    await mount();
    const name = fixture.nativeElement.querySelector(
      '[data-testid="home-manager-name"]',
    ) as HTMLElement;
    // `truncate` is only applied from the sm breakpoint up, so on a phone the whole name shows.
    expect(name.classList.contains('truncate')).toBe(false);
    expect(name.classList.contains('sm:truncate')).toBe(true);
    expect(name.classList.contains('break-words')).toBe(true);
    expect(name.getAttribute('title')).toBe(name.textContent!.trim());
  });

  it('says when the totals include the admin’s own schedule, so the numbers add up', async () => {
    get.mockReturnValue(
      of({
        ...OVERVIEW,
        own_schedule: { employees: 2, unfilled_slots: 1, unfilled_shifts: 1, drafts: 3 },
      }),
    );
    await mount();
    const body = text('home-own-schedule')!;
    expect(body).toContain('your own schedule');
    expect(body).toContain('1 open slot');
    expect(body).toContain('3 drafts');
    expect(body).toContain('2 employees');
  });

  it('shows no own-schedule note when the admin schedules nothing', async () => {
    await mount();
    expect(q('home-own-schedule')).toBeNull();
  });

  it('pluralises the headcount: "1 location", "1 manager", "1 employee"', async () => {
    get.mockReturnValue(
      of({
        ...OVERVIEW,
        headcount: { ...OVERVIEW.headcount, employees: 1, managers: 1, locations: 1 },
      }),
    );
    await mount();
    expect(text('tile-headcount-detail')).toBe('1 employee · 1 manager · 1 location');
  });

  it('pluralises larger headcounts too', async () => {
    await mount();
    expect(text('tile-headcount-detail')).toBe('12 employees · 2 managers · 3 locations');
  });

  it('says the headcount is active only, and how many disabled people it leaves out', async () => {
    get.mockReturnValue(
      of({
        ...OVERVIEW,
        headcount: { ...OVERVIEW.headcount, disabled_employees: 2, disabled_managers: 1 },
      }),
    );
    await mount();
    expect(text('tile-headcount-disabled')).toContain('Active only');
    expect(text('tile-headcount-disabled')).toContain('2 disabled employees');
    expect(text('tile-headcount-disabled')).toContain('1 disabled manager');
  });

  it('shows no disabled note when nobody is disabled', async () => {
    await mount();
    expect(q('tile-headcount-disabled')).toBeNull();
  });

  it('links the "have not set a password" note to the Pending-filtered Employees and Managers pages', async () => {
    await mount();
    expect(text('attention-invites')).toContain('active people only');
    expect(q('pending-employees-link')!.getAttribute('href')).toBe(
      '/org-admin/employees?status=pending',
    );
    expect(q('pending-managers-link')!.getAttribute('href')).toBe(
      '/org-admin/managers?status=pending',
    );
  });

  it('lists each manager with their numbers and scaled bars', async () => {
    await mount();
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="home-manager-row"]'),
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Ann Lee');
    expect(rows[0].textContent).toContain('7 drafts');
    expect(rows[1].textContent).toContain('0 drafts');
    const bars = rows.map((r) => (r.querySelectorAll('.h-2 > .h-2')[0] as HTMLElement).style.width);
    expect(bars).toEqual(['100%', '0%']);
  });

  it('calls out people who have not set a password and employees with no manager', async () => {
    await mount();
    expect(text('attention-invites')).toContain('1 person has not set a password');
    expect(text('attention-unassigned')).toContain('2 employees have no manager');
  });

  it('hides the attention list when there is nothing to flag', async () => {
    get.mockReturnValue(
      of({
        ...OVERVIEW,
        headcount: {
          ...OVERVIEW.headcount,
          pending_invites: 0,
          disabled_employees: 0,
          disabled_managers: 0,
          unassigned_employees: 0,
        },
      }),
    );
    await mount();
    expect(q('home-attention')).toBeNull();
  });

  it('shows an empty state and zero tiles for a brand-new org', async () => {
    get.mockReturnValue(
      of({
        ...OVERVIEW,
        unfilled_slots: 0,
        unfilled_shifts: 0,
        drafts_to_publish: 0,
        open_swap_requests: 0,
        headcount: {
          employees: 0,
          managers: 0,
          locations: 0,
          pending_invites: 0,
          disabled_employees: 0,
          disabled_managers: 0,
          unassigned_employees: 0,
        },
        managers: [],
      }),
    );
    await mount();
    expect(text('tile-unfilled-value')).toBe('0');
    expect(q('home-no-managers')).toBeTruthy();
  });

  it('shows an error when the overview cannot be loaded', async () => {
    get.mockReturnValue(throwError(() => new Error('boom')));
    await mount();
    expect(fixture.nativeElement.textContent).toContain('Failed to load the overview');
    expect(q('home-tiles')).toBeNull();
  });
});
