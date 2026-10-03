import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { WebAdminProfileComponent } from './profile';
import { WebAdminProfileService } from './profile.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';
import type { ProfileData } from '@common-daltime';

/** Minimal ProfileData object matching what the service maps from the backend response. */
const mockProfileData: ProfileData = {
  email: 'wadmin@example.com',
  first_name: 'Alice',
  last_name: 'Smith',
  phone: '',
};

/** Builds a partial mock of WebAdminProfileService with sensible defaults. */
function buildServiceMock(overrides: Partial<Record<keyof WebAdminProfileService, unknown>> = {}) {
  return {
    get: vi.fn().mockReturnValue(of(mockProfileData)),
    update: vi.fn().mockReturnValue(of(mockProfileData)),
    ...overrides,
  };
}

/** Helper to query an element by data-testid. */
function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, testid: string): T {
  return fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as T;
}

describe('WebAdminProfileComponent', () => {
  let fixture: ComponentFixture<WebAdminProfileComponent>;
  let service: ReturnType<typeof buildServiceMock>;

  /** Creates the component with the given service overrides and triggers initial change detection. */
  async function createComponent(
    serviceOverrides: Partial<Record<keyof WebAdminProfileService, unknown>> = {},
  ) {
    service = buildServiceMock(serviceOverrides);

    await TestBed.configureTestingModule({
      imports: [WebAdminProfileComponent],
      providers: [...APP_TEST_PROVIDERS, { provide: WebAdminProfileService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(WebAdminProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  it('shows loading spinner while get() is pending', async () => {
    const pending$ = new Subject();
    await createComponent({ get: vi.fn().mockReturnValue(pending$) });

    // Profile fields must not be rendered while the request is in-flight.
    expect(query(fixture, 'profile-first-name')).toBeNull();
    expect(query(fixture, 'profile-error')).toBeNull();
  });

  // ─── Success state ──────────────────────────────────────────────────────────

  it('renders profile data after successful load', async () => {
    await createComponent();

    expect(query(fixture, 'profile-email').textContent?.trim()).toBe('wadmin@example.com');
    expect(query(fixture, 'profile-first-name').textContent?.trim()).toBe('Alice');
    expect(query(fixture, 'profile-last-name').textContent?.trim()).toBe('Smith');
  });

  it('shows — for phone because web-admin has no phone field', async () => {
    await createComponent();

    // The profile-page component renders "—" when phone is empty.
    expect(query(fixture, 'profile-phone').textContent?.trim()).toBe('—');
  });

  // ─── Error state ────────────────────────────────────────────────────────────

  it('shows error message when get() fails', async () => {
    await createComponent({ get: vi.fn().mockReturnValue(throwError(() => new Error('fail'))) });

    expect(query(fixture, 'profile-error')).toBeTruthy();
    expect(query(fixture, 'profile-error').textContent).toContain('Failed to load profile');
  });

  it('retry button re-fetches the profile', async () => {
    const get = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    await createComponent({ get });

    query<HTMLButtonElement>(fixture, 'retry-btn').click();
    fixture.detectChanges();
    await fixture.whenStable();

    // get() must have been called twice: initial load + retry.
    expect(get).toHaveBeenCalledTimes(2);
  });

  // ─── Edit mode ──────────────────────────────────────────────────────────────

  it('opens edit form with pre-populated first and last name', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'edit-btn').click();
    fixture.detectChanges();

    expect(query<HTMLInputElement>(fixture, 'edit-first-name-input').value).toBe('Alice');
    expect(query<HTMLInputElement>(fixture, 'edit-last-name-input').value).toBe('Smith');
  });

  it('cancel button exits edit mode without calling update()', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'edit-btn').click();
    fixture.detectChanges();
    query<HTMLButtonElement>(fixture, 'cancel-edit-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'profile-first-name')).toBeTruthy();
    expect(service.update).not.toHaveBeenCalled();
  });

  // ─── Save ───────────────────────────────────────────────────────────────────

  it('shows required field error when saving with blank first name', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'edit-btn').click();
    fixture.detectChanges();

    const input = query<HTMLInputElement>(fixture, 'edit-first-name-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-btn').click();
    fixture.detectChanges();

    expect(query(fixture, 'first-name-error')).toBeTruthy();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('calls update() and exits edit mode on success', async () => {
    const updated: ProfileData = { ...mockProfileData, first_name: 'Alicia' };
    await createComponent({ update: vi.fn().mockReturnValue(of(updated)) });

    query<HTMLButtonElement>(fixture, 'edit-btn').click();
    fixture.detectChanges();

    const input = query<HTMLInputElement>(fixture, 'edit-first-name-input');
    input.value = 'Alicia';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'save-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Alicia' }));
    expect(query(fixture, 'save-success')).toBeTruthy();
    expect(query(fixture, 'profile-first-name').textContent?.trim()).toBe('Alicia');
  });

  it('shows inline save error when update() fails', async () => {
    await createComponent({
      update: vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Server error' } }))),
    });

    query<HTMLButtonElement>(fixture, 'edit-btn').click();
    fixture.detectChanges();
    query<HTMLButtonElement>(fixture, 'save-btn').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query(fixture, 'save-error')).toBeTruthy();
    expect(query(fixture, 'save-error').textContent).toContain('Server error');
    // Edit form must remain open after a failed save so the user can correct and retry.
    expect(query<HTMLInputElement>(fixture, 'edit-first-name-input')).toBeTruthy();
  });
});
