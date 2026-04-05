import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { OrganizationService } from '../../../services/organization.service';
import type { Organization } from '../../../core/models/organization.model';

@Component({
  selector: 'app-organizations',
  imports: [DatePipe],
  templateUrl: './organizations.html',
  styleUrl: './organizations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsComponent {
  private readonly orgService = inject(OrganizationService);

  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Modal state
  readonly showModal = signal(false);
  readonly showDeleteModal = signal(false);
  readonly editingOrg = signal<Organization | null>(null);
  readonly deletingOrg = signal<Organization | null>(null);
  readonly saving = signal(false);

  // Form state as signals
  readonly formName = signal('');
  readonly formAddress = signal('');

  constructor() {
    this.loadOrganizations();
  }

  loadOrganizations(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orgService.getAll().subscribe({
      next: (orgs) => {
        this.organizations.set(orgs);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load organizations:', err);
        this.error.set('Failed to load organizations');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingOrg.set(null);
    this.formName.set('');
    this.formAddress.set('');
    this.showModal.set(true);
  }

  openEditModal(org: Organization): void {
    this.editingOrg.set(org);
    this.formName.set(org.name);
    this.formAddress.set(org.address);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingOrg.set(null);
  }

  saveOrganization(): void {
    if (!this.formName().trim() || !this.formAddress().trim()) return;

    this.saving.set(true);
    const editing = this.editingOrg();

    if (editing) {
      this.orgService
        .update(editing.org_id, { name: this.formName(), address: this.formAddress() })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.closeModal();
            this.loadOrganizations();
          },
          error: (err) => {
            console.error('Failed to update organization:', err);
            this.saving.set(false);
          },
        });
    } else {
      this.orgService.create({ name: this.formName(), address: this.formAddress() }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.loadOrganizations();
        },
        error: (err) => {
          console.error('Failed to create organization:', err);
          this.saving.set(false);
        },
      });
    }
  }

  openDeleteModal(org: Organization): void {
    this.deletingOrg.set(org);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingOrg.set(null);
  }

  confirmDelete(): void {
    const org = this.deletingOrg();
    if (!org) return;

    this.saving.set(true);
    this.orgService.delete(org.org_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.loadOrganizations();
      },
      error: (err) => {
        console.error('Failed to delete organization:', err);
        this.saving.set(false);
      },
    });
  }
}
