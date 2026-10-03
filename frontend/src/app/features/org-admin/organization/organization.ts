import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OrgAdminOrganizationService } from './organization.service';
import type { Organization } from '../../../core/models/organization.model';
import { ButtonComponent } from '@common-daltime';
import { isUsStateCode } from './us-states';
import { displayAddress, formatAddress, parseAddress } from './address.utils';

@Component({
  selector: 'app-org-admin-organization',
  imports: [ButtonComponent],
  templateUrl: './organization.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminOrganizationComponent {
  private readonly orgService = inject(OrgAdminOrganizationService);

  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly editing = signal(false);
  readonly editName = signal('');
  readonly editStreet = signal('');
  readonly editCity = signal('');
  readonly editState = signal('');
  readonly editZip = signal('');
  readonly editSubmitted = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  /** The address as it was when editing started, to tell whether the admin changed it. */
  private readonly initialAddress = signal('');

  private readonly composedAddress = computed(() =>
    formatAddress({
      street: this.editStreet(),
      city: this.editCity(),
      state: this.editState(),
      zip: this.editZip(),
    }),
  );

  /** True once any address input differs from what editing started with. */
  readonly addressDirty = computed(() => this.composedAddress() !== this.initialAddress());

  /**
   * Per-field problems with the address inputs. Street is optional (legacy addresses have none), and
   * nothing is validated until the admin actually edits the address, so a name-only change always saves.
   */
  readonly addressErrors = computed(() => {
    if (!this.addressDirty()) return { street: null, city: null, state: null, zip: null };
    const state = this.editState().trim();
    return {
      street: null,
      city: this.editCity().trim() ? null : 'City is required',
      state: !/^[A-Za-z]{2}$/.test(state)
        ? 'Use a 2-letter state'
        : isUsStateCode(state)
          ? null
          : 'Not a US state or territory code',
      zip: /^\d{5}(-\d{4})?$/.test(this.editZip().trim()) ? null : 'Use a 5-digit ZIP',
    };
  });
  readonly addressValid = computed(() => Object.values(this.addressErrors()).every((e) => !e));
  readonly orgAddress = computed(() => displayAddress(this.org()?.address));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orgService.get().subscribe({
      next: (org) => {
        this.org.set(org);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organization');
        this.loading.set(false);
      },
    });
  }

  startEdit(): void {
    this.editName.set(this.org()?.name ?? '');
    const parts = parseAddress(this.org()?.address);
    this.editStreet.set(parts.street);
    this.editCity.set(parts.city);
    this.editState.set(parts.state);
    this.editZip.set(parts.zip);
    this.initialAddress.set(formatAddress(parts));
    this.editSubmitted.set(false);
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    this.editSubmitted.set(true);
    if (!this.editName().trim() || !this.addressValid()) return;

    this.saving.set(true);
    this.saveError.set(null);

    // Only send the address when it was edited; a name-only change leaves the stored value untouched.
    const body = this.addressDirty()
      ? { name: this.editName(), address: this.composedAddress() }
      : { name: this.editName() };
    this.orgService.update(body).subscribe({
      next: (updated) => {
        this.org.set(updated);
        this.saving.set(false);
        this.editing.set(false);
        this.saveSuccess.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error ?? 'Failed to save organization');
      },
    });
  }
}
