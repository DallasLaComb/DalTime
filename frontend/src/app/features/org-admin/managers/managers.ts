import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ManagersService } from './managers.service';
import type { ManagerResponse } from '../../../core/models/manager.model';

@Component({
  selector: 'app-managers',
  imports: [DatePipe, NgClass],
  templateUrl: './managers.html',
  styleUrl: './managers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagersComponent {
  private readonly managersService = inject(ManagersService);

  readonly managers = signal<ManagerResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Register modal
  readonly showRegisterModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly formFirstName = signal('');
  readonly formLastName = signal('');
  readonly formEmail = signal('');
  readonly formPhone = signal('');
  readonly formPassword = signal('');
  readonly showPassword = signal(false);
  readonly formSubmitted = signal(false);

  // Edit modal
  readonly showEditModal = signal(false);
  readonly editingManager = signal<ManagerResponse | null>(null);
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editPhone = signal('');
  readonly editSubmitted = signal(false);
  readonly editError = signal<string | null>(null);

  // Disable modal
  readonly showDisableModal = signal(false);
  readonly disablingManager = signal<ManagerResponse | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.managersService.getAll().subscribe({
      next: (managers) => {
        this.managers.set(managers);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load managers');
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'CONFIRMED') return 'Active';
    if (status === 'DISABLED') return 'Disabled';
    return 'Pending';
  }

  statusClass(status: string): string {
    if (status === 'CONFIRMED') return 'bg-success';
    if (status === 'DISABLED') return 'bg-secondary';
    return 'bg-warning text-dark';
  }

  // ─── Register ────────────────────────────────────────────────────────

  openRegisterModal(): void {
    this.formFirstName.set('');
    this.formLastName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPassword.set('');
    this.showPassword.set(false);
    this.formSubmitted.set(false);
    this.modalError.set(null);
    this.showRegisterModal.set(true);
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  register(): void {
    this.formSubmitted.set(true);
    if (
      !this.formFirstName().trim() ||
      !this.formLastName().trim() ||
      !this.formEmail().trim() ||
      !this.formPassword().trim()
    )
      return;

    this.saving.set(true);
    this.modalError.set(null);

    this.managersService
      .create({
        first_name: this.formFirstName(),
        last_name: this.formLastName(),
        email: this.formEmail(),
        phone: this.formPhone() || undefined,
        temp_password: this.formPassword(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeRegisterModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          if (err?.status === 409) {
            this.modalError.set('A user with this email already exists.');
          } else {
            this.modalError.set(err?.error?.error ?? 'Failed to register manager');
          }
        },
      });
  }

  // ─── Edit ────────────────────────────────────────────────────────────

  openEditModal(manager: ManagerResponse): void {
    this.editingManager.set(manager);
    this.editFirstName.set(manager.first_name);
    this.editLastName.set(manager.last_name);
    this.editPhone.set(manager.phone);
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingManager.set(null);
  }

  saveEdit(): void {
    this.editSubmitted.set(true);
    if (!this.editFirstName().trim() || !this.editLastName().trim()) return;

    this.saving.set(true);
    this.editError.set(null);

    const manager = this.editingManager()!;
    this.managersService
      .update(manager.manager_id, {
        first_name: this.editFirstName(),
        last_name: this.editLastName(),
        phone: this.editPhone(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(err?.error?.error ?? 'Failed to update manager');
        },
      });
  }

  // ─── Disable ─────────────────────────────────────────────────────────

  openDisableModal(manager: ManagerResponse): void {
    this.disablingManager.set(manager);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingManager.set(null);
  }

  confirmDisable(): void {
    const manager = this.disablingManager();
    if (!manager) return;

    this.saving.set(true);
    this.managersService.disable(manager.manager_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDisableModal();
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
