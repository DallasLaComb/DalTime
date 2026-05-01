import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  StatusBadgeComponent,
  ConfirmationModalComponent,
  ButtonComponent,
} from '@common-daltime';
import type { ColumnDef } from '@common-daltime';
import { OrgAdminsService } from '../../../services/org-admins.service';
import { OrganizationService } from '../../../services/organization.service';
import type { OrgAdminUserResponse } from '../../../core/models/org-admin-user.model';

@Component({
  selector: 'app-org-admins',
  imports: [
    DatePipe,
    RouterLink,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
    ButtonComponent,
  ],
  templateUrl: './org-admins.html',
  styleUrl: './org-admins.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orgAdminsService = inject(OrgAdminsService);
  private readonly orgService = inject(OrganizationService);

  readonly orgId = this.route.snapshot.params['orgId'] as string;

  readonly orgName = signal<string>('');
  readonly admins = signal<OrgAdminUserResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showModal = signal(false);
  readonly showDeleteModal = signal(false);
  readonly deletingAdmin = signal<OrgAdminUserResponse | null>(null);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly formName = signal('');
  readonly formEmail = signal('');
  readonly formPassword = signal('');
  readonly showPassword = signal(false);
  readonly formSubmitted = signal(false);

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-end' },
  ];

  readonly trackById = (_index: number, admin: OrgAdminUserResponse): string => admin.user_id;

  readonly statusColorMap: Record<string, string> = {
    CONFIRMED: 'bg-success',
    FORCE_CHANGE_PASSWORD: 'bg-warning text-dark',
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin([
      this.orgService.getById(this.orgId),
      this.orgAdminsService.getAll(this.orgId),
    ]).subscribe({
      next: ([org, admins]) => {
        this.orgName.set(org.name);
        this.admins.set(admins);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load org admins');
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'CONFIRMED') return 'Active';
    return 'Pending';
  }

  openRegisterModal(): void {
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.showPassword.set(false);
    this.formSubmitted.set(false);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  register(): void {
    this.formSubmitted.set(true);
    if (!this.formName().trim() || !this.formEmail().trim() || !this.formPassword().trim()) return;

    this.saving.set(true);
    this.modalError.set(null);

    this.orgAdminsService
      .create(this.orgId, {
        name: this.formName(),
        email: this.formEmail(),
        temp_password: this.formPassword(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          if (err?.status === 409) {
            this.modalError.set('A user with this email already exists.');
          } else {
            this.modalError.set(err?.error?.error ?? 'Failed to register org admin');
          }
        },
      });
  }

  openDeleteModal(admin: OrgAdminUserResponse): void {
    this.deletingAdmin.set(admin);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingAdmin.set(null);
  }

  confirmDelete(): void {
    const admin = this.deletingAdmin();
    if (!admin) return;

    this.saving.set(true);
    this.orgAdminsService.delete(this.orgId, admin.user_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
