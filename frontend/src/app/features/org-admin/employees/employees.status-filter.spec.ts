/**
 * Employees page — status filter. The selection lives in the URL (?status=), so a reload keeps it
 * and the Overview can link straight to "Pending".
 */
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { EmployeesComponent } from './employees';
import { EmployeesService } from './employees.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { EmployeeResponse } from '../../../core/models/employee.model';

const emp = (id: string, status: EmployeeResponse['status']): EmployeeResponse => ({
  employee_id: id,
  first_name: id,
  last_name: 'M',
  email: `${id}@x.com`,
  phone: '',
  org_id: 'o',
  manager_id: 'mgr-1',
  status,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});
const EMPLOYEES = [
  emp('Ann', 'CONFIRMED'),
  emp('Bob', 'DISABLED'),
  emp('Cy', 'DISABLED'),
  emp('Di', 'FORCE_CHANGE_PASSWORD'),
];

async function open(url: string, employees = EMPLOYEES) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      ...APP_TEST_PROVIDERS.slice(1), // the shared router is replaced by one that knows this route
      provideRouter([{ path: 'org-admin/employees', component: EmployeesComponent }]),
      { provide: EmployeesService, useValue: { getAll: () => of(employees) } },
    ],
  }).compileComponents();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, EmployeesComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement as HTMLElement;
  const names = () =>
    Array.from(
      root.querySelectorAll('[data-testid="employee-row"] [data-testid="employee-name"]'),
    ).map((e) => e.textContent!.trim());
  const select = () =>
    root.querySelector('select[data-testid="status-filter-select"]') as HTMLSelectElement;
  const choose = async (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  return { harness, root, names, select, choose, router: TestBed.inject(Router) };
}

describe('EmployeesComponent — status filter', () => {
  it('defaults to All, so disabled employees are visible (and marked)', async () => {
    const { names, select, root } = await open('/org-admin/employees');
    expect(select().value).toBe('all');
    expect(names()).toEqual(['Ann M', 'Bob M', 'Cy M', 'Di M']);
    const badges = Array.from(
      root.querySelectorAll('[data-testid="employee-row"] [data-testid="status-badge"]'),
    ).map((b) => b.textContent!.trim());
    expect(badges).toEqual(['Active', 'Disabled', 'Disabled', 'Pending']);
  });

  it('shows counts on each option', async () => {
    const { select } = await open('/org-admin/employees');
    expect(Array.from(select().options).map((o) => o.textContent!.trim())).toEqual([
      'All (4)',
      'Active (1)',
      'Disabled (2)',
      'Pending (1)',
    ]);
  });

  it.each([
    ['active', ['Ann M']],
    ['disabled', ['Bob M', 'Cy M']],
    ['pending', ['Di M']],
  ])('?status=%s shows only those employees', async (status, expected) => {
    const { names, select } = await open(`/org-admin/employees?status=${status}`);
    expect(select().value).toBe(status);
    expect(names()).toEqual(expected);
  });

  it('choosing an option filters the list and writes ?status= to the URL', async () => {
    const { names, choose, router } = await open('/org-admin/employees');
    await choose('disabled');
    expect(names()).toEqual(['Bob M', 'Cy M']);
    expect(router.url).toContain('status=disabled');
  });

  it('choosing All clears the query param', async () => {
    const { choose, router } = await open('/org-admin/employees?status=pending');
    await choose('all');
    expect(router.url).not.toContain('status=');
  });

  it('survives a reload: opening the saved URL restores the filter', async () => {
    const first = await open('/org-admin/employees');
    await first.choose('pending');
    const saved = first.router.url;
    const reloaded = await open(saved);
    expect(reloaded.select().value).toBe('pending');
    expect(reloaded.names()).toEqual(['Di M']);
  });

  it('ignores an unknown ?status= value and cleans it out of the URL', async () => {
    const { names, select, router, harness } = await open('/org-admin/employees?status=bogus');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(select().value).toBe('all');
    expect(names()).toHaveLength(4);
    expect(router.url).not.toContain('status=');
  });

  it('keeps a valid status in the URL (only unrecognised values are removed)', async () => {
    const { router, harness } = await open('/org-admin/employees?status=disabled');
    await harness.fixture.whenStable();
    expect(router.url).toContain('status=disabled');
  });

  it('keeps other query params when it removes a bad status', async () => {
    const { router, harness } = await open('/org-admin/employees?status=bogus&x=1');
    await harness.fixture.whenStable();
    expect(router.url).not.toContain('status=');
    expect(router.url).toContain('x=1');
  });

  it('shows a friendly empty state when the filter matches nobody', async () => {
    const { root } = await open('/org-admin/employees?status=disabled', [emp('Ann', 'CONFIRMED')]);
    expect(root.querySelector('[data-testid="status-filter-empty"]')!.textContent).toContain(
      'No disabled employees.',
    );
    expect(root.querySelectorAll('[data-testid="employee-row"]')).toHaveLength(0);
  });
});
