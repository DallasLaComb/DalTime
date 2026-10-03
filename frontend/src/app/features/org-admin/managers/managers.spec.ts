import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { ManagersComponent } from './managers';
import { ManagersService } from './managers.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { ManagerResponse } from '../../../core/models/manager.model';

const mockManager: ManagerResponse = {
  manager_id: 'mgr-123',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@acme.com',
  phone: '5551234567',
  org_id: 'org-123',
  org_admin_id: 'admin-123',
  status: 'FORCE_CHANGE_PASSWORD',
  employee_count: 5,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const mockManager2: ManagerResponse = {
  manager_id: 'mgr-456',
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@acme.com',
  phone: '',
  org_id: 'org-123',
  org_admin_id: 'admin-123',
  status: 'CONFIRMED',
  employee_count: 3,
  created_at: '2025-02-01T00:00:00.000Z',
  updated_at: '2025-02-01T00:00:00.000Z',
};

const disabledManager: ManagerResponse = {
  ...mockManager,
  manager_id: 'mgr-789',
  status: 'DISABLED',
};

function buildServiceMock(overrides: Partial<Record<keyof ManagersService, unknown>> = {}) {
  return {
    getAll: vi.fn().mockReturnValue(of([mockManager, mockManager2])),
    create: vi.fn().mockReturnValue(of(mockManager)),
    update: vi.fn().mockReturnValue(of(mockManager)),
    disable: vi.fn().mockReturnValue(of(undefined)),
    enable: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, testid: string): T {
  return fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as T;
}

function queryAll<T extends HTMLElement>(
  fixture: ComponentFixture<unknown>,
  testid: string,
): NodeListOf<T> {
  return fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`) as NodeListOf<T>;
}

describe('ManagersComponent', () => {
  let fixture: ComponentFixture<ManagersComponent>;
  let service: ReturnType<typeof buildServiceMock>;

  async function createComponent(
    serviceOverrides: Partial<Record<keyof ManagersService, unknown>> = {},
  ) {
    service = buildServiceMock(serviceOverrides);

    await TestBed.configureTestingModule({
      imports: [ManagersComponent],
      providers: [...APP_TEST_PROVIDERS, { provide: ManagersService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Pluralisation ──────────────────────────────────────────────────────────

  it('pluralises the employee count: 1 employee, 0 employees, 2 employees', async () => {
    await createComponent({
      getAll: vi.fn().mockReturnValue(
        of([
          { ...mockManager, manager_id: 'a', employee_count: 1 },
          { ...mockManager2, manager_id: 'b', employee_count: 0 },
          { ...mockManager2, manager_id: 'c', employee_count: 2 },
        ]),
      ),
    });
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('1 employee');
    expect(text).not.toContain('1 employees');
    expect(text).toContain('0 employees');
    expect(text).toContain('2 employees');
  });

  // ─── Loading state ──────────────────────────────────────────────────────────

  it('shows loading spinner while getAll is pending', async () => {
    const pending$ = new Subject();
    await createComponent({ getAll: vi.fn().mockReturnValue(pending$) });

    expect(query(fixture, 'loading-spinner')).toBeTruthy();
    expect(query(fixture, 'manager-row')).toBeNull();
    expect(query(fixture, 'empty-state')).toBeNull();
  });

  // ─── Success state ──────────────────────────────────────────────────────────

  it('renders the manager list when getAll returns results', async () => {
    await createComponent();

    expect(query(fixture, 'loading-spinner')).toBeNull();
    const names = queryAll(fixture, 'manager-name');
    expect(names[0].textContent?.trim()).toBe('John Doe');
    expect(names[1].textContent?.trim()).toBe('Jane Smith');
  });

  it('shows employee count', async () => {
    await createComponent();

    const counts = queryAll(fixture, 'employee-count');
    expect(counts[0].textContent).toContain('5');
  });

  it('shows Pending badge for FORCE_CHANGE_PASSWORD status', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([mockManager])) });

    const badges = queryAll(fixture, 'status-badge');
    expect(badges[0].textContent?.trim()).toBe('Pending');
  });

  it('shows Active badge for CONFIRMED status', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([mockManager2])) });

    const badges = queryAll(fixture, 'status-badge');
    expect(badges[0].textContent?.trim()).toBe('Active');
  });

  it('shows Disabled badge and no action buttons for DISABLED status', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([disabledManager])) });

    const badges = queryAll(fixture, 'status-badge');
    expect(badges[0].textContent?.trim()).toBe('Disabled');

    const editBtns = queryAll(fixture, 'edit-btn');
    const disableBtns = queryAll(fixture, 'disable-btn');
    expect(editBtns.length).toBe(0);
    expect(disableBtns.length).toBe(0);
  });

  // ─── Empty state ────────────────────────────────────────────────────────────

  it('shows the empty state when getAll returns an empty array', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([])) });

    expect(query(fixture, 'empty-state')).toBeTruthy();
    expect(query(fixture, 'empty-state').textContent).toContain('No managers registered yet');
  });

  // ─── Error state ────────────────────────────────────────────────────────────

  it('shows error alert when getAll fails', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) });

    const alert = query(fixture, 'error-alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Failed to load managers');
  });

  it('retry button re-fetches managers', async () => {
    const getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    await createComponent({ getAll });

    query<HTMLButtonElement>(fixture, 'error-alert-retry').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAll).toHaveBeenCalledTimes(2);
  });

  // ─── Register modal ─────────────────────────────────────────────────────────

  it('opens register modal with blank fields', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    expect(query(fixture, 'register-modal')).toBeTruthy();
    expect(query<HTMLInputElement>(fixture, 'first-name-input').value).toBe('');
    expect(query<HTMLInputElement>(fixture, 'last-name-input').value).toBe('');
    expect(query<HTMLInputElement>(fixture, 'email-input').value).toBe('');
  });

  it('shows required field errors when submitting blank register form', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-register-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'first-name-error')).toBeTruthy();
    expect(query(fixture, 'last-name-error')).toBeTruthy();
    expect(query(fixture, 'email-error')).toBeTruthy();
    expect(query(fixture, 'password-error')).toBeTruthy();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('calls create() with correct body when register form is valid', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const setInput = (testid: string, value: string) => {
      const input = query<HTMLInputElement>(fixture, testid);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    setInput('first-name-input', 'John');
    setInput('last-name-input', 'Doe');
    setInput('email-input', 'john@acme.com');
    setInput('password-input', 'Temp@1234');
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-register-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.create).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@acme.com',
      phone: undefined,
      temp_password: 'Temp@1234',
    });
    expect(query(fixture, 'register-modal')).toBeNull();
  });

  it('shows 409 inline error in register modal', async () => {
    await createComponent({
      create: vi.fn().mockReturnValue(throwError(() => ({ status: 409 }))),
    });

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const setInput = (testid: string, value: string) => {
      const input = query<HTMLInputElement>(fixture, testid);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    setInput('first-name-input', 'John');
    setInput('last-name-input', 'Doe');
    setInput('email-input', 'john@acme.com');
    setInput('password-input', 'Temp@1234');
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-register-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query(fixture, 'modal-error').textContent).toContain(
      'A user with this email already exists',
    );
  });

  // ─── Edit modal ─────────────────────────────────────────────────────────────

  it('opens edit modal with pre-populated fields and read-only email', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'edit-modal')).toBeTruthy();
    expect(query<HTMLInputElement>(fixture, 'edit-first-name-input').value).toBe('John');
    expect(query<HTMLInputElement>(fixture, 'edit-last-name-input').value).toBe('Doe');
    expect(query<HTMLInputElement>(fixture, 'edit-phone-input').value).toBe('5551234567');

    const emailDisplay = query<HTMLInputElement>(fixture, 'edit-email-display');
    expect(emailDisplay.value).toBe('john@acme.com');
    expect(emailDisplay.disabled).toBe(true);
  });

  it('calls update() with correct body when edit form is saved', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    const firstNameInput = query<HTMLInputElement>(fixture, 'edit-first-name-input');
    firstNameInput.value = 'Johnny';
    firstNameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-edit-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledWith('mgr-123', {
      first_name: 'Johnny',
      last_name: 'Doe',
      phone: '5551234567',
    });
    expect(query(fixture, 'edit-modal')).toBeNull();
  });

  it('shows required field error when edit first name is cleared', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    const firstNameInput = query<HTMLInputElement>(fixture, 'edit-first-name-input');
    firstNameInput.value = '';
    firstNameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-edit-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'edit-first-name-error')).toBeTruthy();
    expect(service.update).not.toHaveBeenCalled();
  });

  // ─── Disable modal ──────────────────────────────────────────────────────────

  it('opens disable modal with manager name and email', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'disable-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'confirmation-modal')).toBeTruthy();
    expect(query(fixture, 'disable-manager-name').textContent?.trim()).toBe('John Doe');
    expect(query(fixture, 'disable-manager-email').textContent?.trim()).toBe('john@acme.com');
  });

  const idle = { ...mockManager, employee_count: 0 };
  const openDisable = async (managers: ManagerResponse[], overrides = {}) => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of(managers)), ...overrides });
    queryAll<HTMLButtonElement>(fixture, 'disable-btn')[0].click();
    fixture.detectChanges();
  };
  const confirm = async () => {
    const btn = query<HTMLButtonElement>(fixture, 'confirmation-modal-confirm');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('calls disable() when confirm is clicked (a manager with no employees)', async () => {
    await openDisable([idle]);

    await confirm();

    expect(service.disable).toHaveBeenCalledWith('mgr-123', false);
    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });

  it('warns up front, with the employee count, that a manager with employees must be reassigned first', async () => {
    await openDisable([{ ...mockManager, employee_count: 3 }]);

    const blocked = query(fixture, 'disable-blocked');
    expect(blocked.textContent).toContain('manages 3 employees');
    expect(blocked.textContent).toContain('Reassign them');
    expect(query(fixture, 'disable-blocked-link').getAttribute('href')).toBe(
      '/org-admin/employees',
    );
    // and the confirm button can't be used
    expect(query<HTMLButtonElement>(fixture, 'confirmation-modal-confirm').disabled).toBe(true);
  });

  it('uses singular wording for one employee', async () => {
    await openDisable([{ ...mockManager, employee_count: 1 }]);
    expect(query(fixture, 'disable-blocked').textContent).toContain('manages 1 employee.');
  });

  it('shows the server’s reason when the disable is refused (409), and keeps the dialog open', async () => {
    const msg = 'Mona Lisa manages 2 employees. Reassign their employees to another manager first.';
    await openDisable([idle], {
      disable: vi.fn().mockReturnValue(throwError(() => ({ status: 409, error: { error: msg } }))),
    });

    await confirm();

    expect(query(fixture, 'disable-error').textContent).toContain(msg);
    expect(query(fixture, 'confirmation-modal')).toBeTruthy();
  });

  it('asks to acknowledge upcoming shifts, then "Disable anyway" retries with the acknowledgement', async () => {
    const ack = {
      status: 409,
      error: {
        error: 'Mona Lisa has 4 upcoming shifts that will stay on the schedule. Disable anyway?',
        requires_acknowledgement: true,
      },
    };
    const disable = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ack))
      .mockReturnValueOnce(of(undefined));
    await openDisable([idle], { disable });

    await confirm();
    expect(query(fixture, 'disable-error').textContent).toContain('4 upcoming shifts');
    expect(query(fixture, 'confirmation-modal-confirm').textContent).toContain('Disable anyway');

    await confirm();
    expect(disable).toHaveBeenLastCalledWith('mgr-123', true);
    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });

  it('lets a disabled manager be re-enabled, after a confirmation', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([disabledManager])) });

    const enableBtn = queryAll<HTMLButtonElement>(fixture, 'enable-btn')[0];
    expect(enableBtn).toBeTruthy();
    enableBtn.click();
    fixture.detectChanges();
    expect(query(fixture, 'confirmation-modal')).toBeTruthy();
    expect(service.enable).not.toHaveBeenCalled(); // nothing happens until confirmed

    query<HTMLButtonElement>(fixture, 'confirmation-modal-confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.enable).toHaveBeenCalledWith('mgr-789');
    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });

  it('does not re-enable when the confirmation is cancelled', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([disabledManager])) });

    queryAll<HTMLButtonElement>(fixture, 'enable-btn')[0].click();
    fixture.detectChanges();
    query<HTMLButtonElement>(fixture, 'confirmation-modal-cancel').click();
    fixture.detectChanges();

    expect(service.enable).not.toHaveBeenCalled();
  });

  it('closes disable modal when cancel is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'disable-btn')[0].click();
    fixture.detectChanges();
    expect(query(fixture, 'confirmation-modal')).toBeTruthy();

    query<HTMLButtonElement>(fixture, 'confirmation-modal-cancel').click();
    fixture.detectChanges();

    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });
});
