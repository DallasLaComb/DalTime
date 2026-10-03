import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { OrgAdminLocationsComponent } from './locations';
import { OrgAdminLocationsService } from './locations.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { ManagerLocation } from '../../../core/models/manager-location.model';

const mockLocation: ManagerLocation = {
  location_id: 'loc-123',
  org_id: 'org-123',
  name: 'Main Office',
  address: '123 Main St',
  created_by: 'user-123',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const mockLocation2: ManagerLocation = {
  location_id: 'loc-456',
  org_id: 'org-123',
  name: 'Downtown Site',
  created_by: 'user-123',
  created_at: '2026-02-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
};

function buildServiceMock(
  overrides: Partial<Record<keyof OrgAdminLocationsService, unknown>> = {},
) {
  return {
    getAll: vi.fn().mockReturnValue(of([mockLocation, mockLocation2])),
    create: vi.fn().mockReturnValue(of(mockLocation)),
    update: vi.fn().mockReturnValue(of(mockLocation)),
    remove: vi.fn().mockReturnValue(of(undefined)),
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

describe('OrgAdminLocationsComponent', () => {
  let fixture: ComponentFixture<OrgAdminLocationsComponent>;
  let service: ReturnType<typeof buildServiceMock>;

  async function createComponent(
    serviceOverrides: Partial<Record<keyof OrgAdminLocationsService, unknown>> = {},
  ) {
    service = buildServiceMock(serviceOverrides);

    await TestBed.configureTestingModule({
      imports: [OrgAdminLocationsComponent],
      providers: [...APP_TEST_PROVIDERS, { provide: OrgAdminLocationsService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAdminLocationsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  it('shows loading spinner while getAll is pending', async () => {
    const pending$ = new Subject();
    await createComponent({ getAll: vi.fn().mockReturnValue(pending$) });

    expect(query(fixture, 'loading-spinner')).toBeTruthy();
    expect(query(fixture, 'location-row')).toBeNull();
  });

  // ─── Success ────────────────────────────────────────────────────────────────

  it('renders the location list when getAll returns results', async () => {
    await createComponent();

    expect(query(fixture, 'loading-spinner')).toBeNull();
    const names = queryAll(fixture, 'location-name');
    expect(names[0].textContent?.trim()).toBe('Main Office');
    expect(names[1].textContent?.trim()).toBe('Downtown Site');
  });

  it('shows address when present', async () => {
    await createComponent();

    const addresses = queryAll(fixture, 'location-address');
    expect(addresses[0].textContent?.trim()).toBe('123 Main St');
  });

  it('flags a legacy location that has no address instead of hiding it', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([mockLocation2])) });

    expect(queryAll(fixture, 'location-address-missing')[0].textContent).toContain('edit to add');
  });

  // ─── Empty ──────────────────────────────────────────────────────────────────

  it('shows empty state when getAll returns an empty array', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([])) });

    expect(query(fixture, 'empty-state')).toBeTruthy();
    expect(query(fixture, 'empty-state').textContent).toContain('No locations added yet');
  });

  // ─── Error ──────────────────────────────────────────────────────────────────

  it('shows error alert when getAll fails', async () => {
    await createComponent({
      getAll: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
    });

    const alert = query(fixture, 'error-alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Failed to load locations');
  });

  it('retry button re-fetches locations', async () => {
    const getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    await createComponent({ getAll });

    query<HTMLButtonElement>(fixture, 'error-alert-retry').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAll).toHaveBeenCalledTimes(2);
  });

  // ─── Create modal ────────────────────────────────────────────────────────────

  it('opens create modal with blank fields', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    expect(query(fixture, 'create-modal')).toBeTruthy();
    expect(query<HTMLInputElement>(fixture, 'name-input').value).toBe('');
    expect(query<HTMLInputElement>(fixture, 'address-input').value).toBe('');
  });

  it('shows required name error when submitting blank create form', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-create-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'name-error')).toBeTruthy();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('calls create() with correct body when form is valid', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'name-input');
    nameInput.value = 'Main Office';
    nameInput.dispatchEvent(new Event('input'));

    const addressInput = query<HTMLInputElement>(fixture, 'address-input');
    addressInput.value = '123 Main St';
    addressInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-create-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.create).toHaveBeenCalledWith({
      name: 'Main Office',
      address: '123 Main St',
    });
    expect(query(fixture, 'create-modal')).toBeNull();
  });

  it('requires an address to create a location', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'name-input');
    nameInput.value = 'Warehouse';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-create-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.create).not.toHaveBeenCalled();
    expect(query(fixture, 'address-error').textContent).toContain('Address is required');
  });

  it('shows inline error when create() fails', async () => {
    await createComponent({
      create: vi
        .fn()
        .mockReturnValue(
          throwError(() => ({ error: { error: 'name must be 100 characters or fewer' } })),
        ),
    });

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'name-input');
    nameInput.value = 'Office';
    nameInput.dispatchEvent(new Event('input'));
    const addressInput = query<HTMLInputElement>(fixture, 'address-input');
    addressInput.value = '1 Main St';
    addressInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-create-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query(fixture, 'modal-error').textContent).toContain(
      'name must be 100 characters or fewer',
    );
  });

  // ─── Edit modal ──────────────────────────────────────────────────────────────

  it('opens edit modal pre-populated with existing values', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'edit-modal')).toBeTruthy();
    expect(query<HTMLInputElement>(fixture, 'edit-name-input').value).toBe('Main Office');
    expect(query<HTMLInputElement>(fixture, 'edit-address-input').value).toBe('123 Main St');
  });

  it('calls update() with correct body when edit form is saved', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'edit-name-input');
    nameInput.value = 'HQ';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-edit-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledWith('loc-123', {
      name: 'HQ',
      address: '123 Main St',
    });
    expect(query(fixture, 'edit-modal')).toBeNull();
  });

  it('shows required name error when edit name is cleared', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-btn')[0].click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'edit-name-input');
    nameInput.value = '';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-edit-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'edit-name-error')).toBeTruthy();
    expect(service.update).not.toHaveBeenCalled();
  });

  // ─── Delete modal ────────────────────────────────────────────────────────────

  it('opens delete modal with location name', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'delete-modal')).toBeTruthy();
    expect(query(fixture, 'delete-modal-entity-name').textContent?.trim()).toBe('Main Office');
  });

  it('calls remove() when confirm is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-btn')[0].click();
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'delete-modal-confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.remove).toHaveBeenCalledWith('loc-123');
    expect(query(fixture, 'delete-modal')).toBeNull();
  });

  it('warns in the delete modal that locations in use cannot be deleted', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'delete-modal-note').textContent).toContain('shifts');
    expect(query(fixture, 'delete-modal-note').textContent).toContain('assigned');
  });

  it('keeps the modal open and shows the reason when the delete is blocked (409)', async () => {
    const msg = 'Main Office has 3 shifts and 2 assigned people. Reassign or remove them first.';
    await createComponent({
      remove: vi.fn().mockReturnValue(throwError(() => ({ status: 409, error: { error: msg } }))),
    });

    queryAll<HTMLButtonElement>(fixture, 'delete-btn')[0].click();
    fixture.detectChanges();
    query<HTMLButtonElement>(fixture, 'delete-modal-confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query(fixture, 'delete-modal')).toBeTruthy();
    expect(query(fixture, 'delete-modal-error').textContent).toContain(msg);
  });

  it('closes delete modal when cancel is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-btn')[0].click();
    fixture.detectChanges();
    expect(query(fixture, 'delete-modal')).toBeTruthy();

    query<HTMLButtonElement>(fixture, 'delete-modal-cancel').click();
    fixture.detectChanges();

    expect(query(fixture, 'delete-modal')).toBeNull();
  });
});
