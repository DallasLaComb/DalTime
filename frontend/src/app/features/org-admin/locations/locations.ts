import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { OrgAdminLocationsService } from './locations.service';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import type { ColumnDef } from '@common-daltime';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  DeleteModalComponent,
  ButtonComponent,
} from '@common-daltime';

@Component({
  selector: 'app-org-admin-locations',
  imports: [
    DatePipe,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    DeleteModalComponent,
    ButtonComponent,
  ],
  templateUrl: './locations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminLocationsComponent {
  private readonly locationsService = inject(OrgAdminLocationsService);

  readonly locations = signal<ManagerLocation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  // ─── Create modal ────────────────────────────────────────────────────────────
  readonly showCreateModal = signal(false);
  readonly createName = signal('');
  readonly createAddress = signal('');
  readonly createSubmitted = signal(false);
  readonly createError = signal<string | null>(null);

  // ─── Edit modal ──────────────────────────────────────────────────────────────
  readonly showEditModal = signal(false);
  readonly editingLocation = signal<ManagerLocation | null>(null);
  readonly editName = signal('');
  readonly editAddress = signal('');
  readonly editSubmitted = signal(false);
  readonly editError = signal<string | null>(null);

  // ─── Delete modal ────────────────────────────────────────────────────────────
  readonly showDeleteModal = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deletingLocation = signal<ManagerLocation | null>(null);

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Address' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, loc: ManagerLocation): string => loc.location_id;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.locationsService.getAll().subscribe({
      next: (locations) => {
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load locations');
        this.loading.set(false);
      },
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.createName.set('');
    this.createAddress.set('');
    this.createSubmitted.set(false);
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  create(): void {
    this.createSubmitted.set(true);
    if (!this.createName().trim() || !this.createAddress().trim()) return;

    this.saving.set(true);
    this.createError.set(null);

    this.locationsService
      .create({
        name: this.createName(),
        address: this.createAddress(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeCreateModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.createError.set(err?.error?.error ?? 'Failed to create location');
        },
      });
  }

  // ─── Edit ────────────────────────────────────────────────────────────────────

  openEditModal(location: ManagerLocation): void {
    this.editingLocation.set(location);
    this.editName.set(location.name);
    this.editAddress.set(location.address ?? '');
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingLocation.set(null);
  }

  saveEdit(): void {
    this.editSubmitted.set(true);
    if (!this.editName().trim() || !this.editAddress().trim()) return;

    this.saving.set(true);
    this.editError.set(null);

    const location = this.editingLocation()!;
    this.locationsService
      .update(location.location_id, {
        name: this.editName(),
        address: this.editAddress(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(err?.error?.error ?? 'Failed to update location');
        },
      });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  openDeleteModal(location: ManagerLocation): void {
    this.deletingLocation.set(location);
    this.deleteError.set(null);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingLocation.set(null);
  }

  confirmDelete(): void {
    const location = this.deletingLocation();
    if (!location) return;

    this.saving.set(true);
    this.locationsService.remove(location.location_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        // A 409 carries the reason ("… has 3 shifts and 2 assigned people. Reassign or remove them first.").
        this.deleteError.set(err?.error?.error ?? 'Failed to delete location. Please try again.');
      },
    });
  }
}
