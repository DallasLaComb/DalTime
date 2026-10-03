import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StatusFilterComponent } from '../../../shared/components/status-filter/status-filter';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PhoneDisplayComponent } from '../../../shared/components/phone-display/phone-display';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { ManagersService } from './managers.service';
import { ManagerLocationsService } from './manager-locations.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import { EmployeeCrudBaseComponent } from '../../../core/utils/employee-crud-base';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { UserLocationResponse } from '../../../core/models/user-location.model';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import type {
  ColumnDef,
  AssignedLocation,
  RegisterEmployeeData,
  EditEmployeeData,
} from '@common-daltime';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  StatusBadgeComponent,
  ButtonComponent,
  LocationsModalComponent,
  RegisterEmployeeModalComponent,
  EditEmployeeModalComponent,
  EmployeeStatusModalsComponent,
  EmployeeActionsComponent,
} from '@common-daltime';
import type { Observable } from 'rxjs';

@Component({
  selector: 'app-managers',
  imports: [
    DatePipe,
    StatusFilterComponent,
    EmptyStateComponent,
    PhoneDisplayComponent,
    PluralPipe,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    ButtonComponent,
    LocationsModalComponent,
    RegisterEmployeeModalComponent,
    EditEmployeeModalComponent,
    EmployeeStatusModalsComponent,
    EmployeeActionsComponent,
  ],
  templateUrl: './managers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagersComponent extends EmployeeCrudBaseComponent<ManagerResponse> {
  private readonly managersService = inject(ManagersService);
  private readonly managerLocationsService = inject(ManagerLocationsService);
  private readonly orgLocationsService = inject(OrgAdminLocationsService);

  readonly managers = signal<ManagerResponse[]>([]);
  protected readonly entities = this.managers;
  protected override readonly noun = 'managers';

  /**
   * A manager who still manages employees can't be disabled: say so up front (the server enforces it
   * too) and point at the Employees page, where each employee's manager is reassigned.
   */
  readonly disableBlockedReason = computed(() => {
    const m = this.disablingEntity();
    const n = m?.employee_count ?? 0;
    if (!m || n === 0) return null;
    return `${m.first_name} ${m.last_name} manages ${n} ${n === 1 ? 'employee' : 'employees'}. Reassign them to another manager before disabling.`;
  });
  readonly reassignLink = { label: 'Go to Employees', route: '/org-admin/employees' };

  // Edit modal entity
  readonly editingManager = signal<ManagerResponse | null>(null);

  // Locations modal
  readonly showLocationsModal = signal(false);
  readonly locationsManager = signal<ManagerResponse | null>(null);
  readonly assignedLocations = signal<UserLocationResponse[]>([]);
  readonly allOrgLocations = signal<ManagerLocation[]>([]);
  readonly locationsLoading = signal(false);
  readonly locationsError = signal<string | null>(null);
  readonly assigning = signal(false);
  readonly assignError = signal<string | null>(null);
  readonly removing = signal(false);

  readonly availableLocations = computed(() => {
    const assignedIds = new Set(this.assignedLocations().map((a) => a.location_id));
    return this.allOrgLocations().filter((l) => !assignedIds.has(l.location_id));
  });

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Status' },
    { header: 'Employees' },
    { header: 'Locations' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, manager: ManagerResponse): string => manager.manager_id;
  readonly statusColorMap = USER_STATUS_COLOR_MAP;
  readonly statusLabel = getUserStatusLabel;

  constructor() {
    super();
    this.load();
  }

  protected override extractId(manager: ManagerResponse): string {
    return manager.manager_id;
  }

  protected override disableEntity(id: string, acknowledgeShifts = false): Observable<void> {
    return this.managersService.disable(id, acknowledgeShifts);
  }

  protected override enableEntity(id: string): Observable<void> {
    return this.managersService.enable(id);
  }

  protected override load(): void {
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

  // ─── Register ────────────────────────────────────────────────────────

  handleRegister(data: RegisterEmployeeData): void {
    this.saving.set(true);
    this.modalError.set(null);
    this.managersService
      .create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || undefined,
        temp_password: data.temp_password,
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
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  override closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingManager.set(null);
  }

  handleSaveEdit(data: EditEmployeeData): void {
    this.saving.set(true);
    this.editError.set(null);
    const manager = this.editingManager()!;
    this.managersService
      .update(manager.manager_id, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
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

  // ─── Locations ───────────────────────────────────────────────────────

  openLocationsModal(manager: ManagerResponse): void {
    this.locationsManager.set(manager);
    this.assignedLocations.set([]);
    this.allOrgLocations.set([]);
    this.locationsError.set(null);
    this.assignError.set(null);
    this.locationsLoading.set(true);
    this.showLocationsModal.set(true);

    this.managerLocationsService.getAll(manager.manager_id).subscribe({
      next: (assigned) => this.assignedLocations.set(assigned),
      error: () => this.locationsError.set('Failed to load assigned locations'),
    });

    this.orgLocationsService.getAll().subscribe({
      next: (all) => {
        this.allOrgLocations.set(all);
        this.locationsLoading.set(false);
      },
      error: () => {
        this.locationsError.set('Failed to load locations');
        this.locationsLoading.set(false);
      },
    });
  }

  closeLocationsModal(): void {
    this.showLocationsModal.set(false);
    this.locationsManager.set(null);
  }

  handleAssignRequested(locationId: string): void {
    const manager = this.locationsManager();
    if (!manager) return;
    this.assigning.set(true);
    this.assignError.set(null);
    this.managerLocationsService.assign(manager.manager_id, locationId).subscribe({
      next: (assignment) => {
        this.assignedLocations.update((list) => [...list, assignment]);
        this.assigning.set(false);
      },
      error: (err) => {
        this.assigning.set(false);
        this.assignError.set(err?.error?.error ?? 'Failed to assign location');
      },
    });
  }

  handleRemoveConfirmed(loc: AssignedLocation): void {
    const manager = this.locationsManager();
    if (!manager) return;
    this.removing.set(true);
    this.managerLocationsService.remove(manager.manager_id, loc.location_id).subscribe({
      next: () => {
        this.assignedLocations.update((list) =>
          list.filter((a) => a.location_id !== loc.location_id),
        );
        this.removing.set(false);
      },
      error: () => {
        this.removing.set(false);
      },
    });
  }
}
