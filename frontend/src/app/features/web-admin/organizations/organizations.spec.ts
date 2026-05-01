import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrganizationsComponent } from './organizations';
import { OrganizationService } from '../../../services/organization.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { Organization } from '../../../core/models/organization.model';

const mockOrg: Organization = {
  org_id: 'org-123',
  name: 'Acme Corp',
  address: '123 Main St',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  org_admin_count: 0,
};

const mockOrg2: Organization = {
  org_id: 'org-456',
  name: 'Beta LLC',
  address: '456 Oak Ave',
  created_at: '2025-02-01T00:00:00.000Z',
  updated_at: '2025-02-01T00:00:00.000Z',
  org_admin_count: 0,
};

function buildOrgServiceMock(overrides: Partial<Record<keyof OrganizationService, unknown>> = {}) {
  return {
    getAll: vi.fn().mockReturnValue(of([mockOrg, mockOrg2])),
    getById: vi.fn().mockReturnValue(of(mockOrg)),
    create: vi.fn().mockReturnValue(of(mockOrg)),
    update: vi.fn().mockReturnValue(of(mockOrg)),
    delete: vi.fn().mockReturnValue(of(undefined)),
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

describe('OrganizationsComponent', () => {
  let fixture: ComponentFixture<OrganizationsComponent>;
  let orgService: ReturnType<typeof buildOrgServiceMock>;

  async function createComponent(
    serviceOverrides: Partial<Record<keyof OrganizationService, unknown>> = {},
  ) {
    orgService = buildOrgServiceMock(serviceOverrides);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OrganizationsComponent],
      providers: [
        ...APP_TEST_PROVIDERS,
        { provide: OrganizationService, useValue: orgService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Loading state ───────────────────────────────────────────────────────────

  it('shows loading spinner while getAll is pending', async () => {
    const { Subject } = await import('rxjs');
    const pending$ = new Subject();
    await createComponent({ getAll: vi.fn().mockReturnValue(pending$) });

    expect(query(fixture, 'loading-spinner')).toBeTruthy();
    expect(query(fixture, 'org-row')).toBeNull();
    expect(query(fixture, 'empty-state')).toBeNull();
  });

  // ─── Success state ───────────────────────────────────────────────────────────

  it('renders the organizations table when getAll returns results', async () => {
    await createComponent();

    expect(query(fixture, 'loading-spinner')).toBeNull();

    // Both card (mobile) and table (desktop) layouts render simultaneously in
    // jsdom — CSS breakpoints don't apply, so each org appears twice in the DOM.
    const rows = queryAll(fixture, 'org-row');
    expect(rows.length).toBe(2);

    const names = queryAll(fixture, 'org-name');
    expect(names[0].textContent?.trim()).toBe('Acme Corp');
    expect(names[1].textContent?.trim()).toBe('Beta LLC');
  });

  // ─── Empty state ─────────────────────────────────────────────────────────────

  it('shows the empty state when getAll returns an empty array', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(of([])) });

    expect(query(fixture, 'empty-state')).toBeTruthy();
    expect(query(fixture, 'org-row')).toBeNull();
  });

  // ─── Error state ─────────────────────────────────────────────────────────────

  it('shows error alert when getAll fails', async () => {
    await createComponent({ getAll: vi.fn().mockReturnValue(throwError(() => new Error('Network error'))) });

    const alert = query(fixture, 'error-alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Failed to load organizations');
  });

  it('retry button re-fetches organizations', async () => {
    const getAll = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));
    await createComponent({ getAll });

    query<HTMLButtonElement>(fixture, 'error-alert-retry').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAll).toHaveBeenCalledTimes(2);
  });

  // ─── Create modal ────────────────────────────────────────────────────────────

  it('opens the create modal with blank fields when create button is clicked', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const modal = query(fixture, 'org-modal');
    expect(modal).toBeTruthy();
    expect(query(fixture, 'modal-title').textContent?.trim()).toBe('Create Organization');
    expect((query<HTMLInputElement>(fixture, 'org-name-input')).value).toBe('');
    expect((query<HTMLInputElement>(fixture, 'org-address-input')).value).toBe('');
  });

  it('opens the edit modal pre-populated with the org values', async () => {
    await createComponent();

    const editBtns = queryAll<HTMLButtonElement>(fixture, 'edit-org-btn');
    editBtns[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'modal-title').textContent?.trim()).toBe('Edit Organization');
    expect((query<HTMLInputElement>(fixture, 'org-name-input')).value).toBe('Acme Corp');
    expect((query<HTMLInputElement>(fixture, 'org-address-input')).value).toBe('123 Main St');
  });

  it('disables the save button when name input is blank', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const saveBtn = query<HTMLButtonElement>(fixture, 'save-org-btn');
    expect(saveBtn.disabled).toBe(true);
  });

  it('calls create() with the correct body when save is clicked in create mode', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'org-name-input');
    const addressInput = query<HTMLInputElement>(fixture, 'org-address-input');

    nameInput.value = 'New Org';
    nameInput.dispatchEvent(new Event('input'));
    addressInput.value = '789 Elm St';
    addressInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-org-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(orgService.create).toHaveBeenCalledWith({ name: 'New Org', address: '789 Elm St' });
    expect(query(fixture, 'org-modal')).toBeNull();
  });

  it('calls update() with the correct body when save is clicked in edit mode', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'edit-org-btn')[0].click();
    fixture.detectChanges();

    const nameInput = query<HTMLInputElement>(fixture, 'org-name-input');
    nameInput.value = 'Renamed Org';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-org-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(orgService.update).toHaveBeenCalledWith('org-123', {
      name: 'Renamed Org',
      address: '123 Main St',
    });
    expect(query(fixture, 'org-modal')).toBeNull();
  });

  it('closes the modal when cancel is clicked', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    fixture.detectChanges();
    expect(query(fixture, 'org-modal')).toBeTruthy();

    query<HTMLButtonElement>(fixture, 'cancel-modal-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'org-modal')).toBeNull();
  });

  // ─── Delete modal ────────────────────────────────────────────────────────────

  it('opens the delete modal showing the org name when delete button is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-org-btn')[0].click();
    fixture.detectChanges();

    expect(query(fixture, 'confirmation-modal')).toBeTruthy();
    expect(query(fixture, 'delete-org-name').textContent?.trim()).toBe('Acme Corp');
  });

  it('calls delete() with the correct orgId when confirm is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-org-btn')[0].click();
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'confirmation-modal-confirm').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(orgService.delete).toHaveBeenCalledWith('org-123');
    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });

  it('closes the delete modal when cancel is clicked', async () => {
    await createComponent();

    queryAll<HTMLButtonElement>(fixture, 'delete-org-btn')[0].click();
    fixture.detectChanges();
    expect(query(fixture, 'confirmation-modal')).toBeTruthy();

    query<HTMLButtonElement>(fixture, 'confirmation-modal-cancel').click();
    fixture.detectChanges();

    expect(query(fixture, 'confirmation-modal')).toBeNull();
  });
});
