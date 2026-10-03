import { OrgAdminManagerOptionsService } from '../manager-options.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StatusFilterComponent } from '../../../shared/components/status-filter/status-filter';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PhoneDisplayComponent } from '../../../shared/components/phone-display/phone-display';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { EmployeesService } from './employees.service';
import { ManagersService } from '../managers/managers.service';
import { EmployeeLocationsService } from './employee-locations.service';
import { OrgAdminLocationsService } from '../locations/locations.service';
import { EmployeeCrudBaseComponent } from '../../../core/utils/employee-crud-base';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { ManagerResponse } from '../../../core/models/manager.model';
import type { UserLocationResponse } from '../../../core/models/user-location.model';
import type { ManagerLocation } from '../../../core/models/manager-location.model';
import type { Observable } from 'rxjs';
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
  EmployeeCardHeaderComponent,
} from '@common-daltime';

@Component({
  selector: 'app-employees',
  imports: [
    DatePipe,
    StatusFilterComponent,
    EmptyStateComponent,
    PhoneDisplayComponent,
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
    EmployeeCardHeaderComponent,
  ],
  templateUrl: './employees.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesComponent extends EmployeeCrudBaseComponent<EmployeeResponse> {
  private readonly employeesService = inject(EmployeesService);
  private readonly managerOptions = inject(OrgAdminManagerOptionsService);
  private readonly managersService = inject(ManagersService);
  private readonly employeeLocationsService = inject(EmployeeLocationsService);
  private readonly orgLocationsService = inject(OrgAdminLocationsService);

  readonly employees = signal<EmployeeResponse[]>([]);
  protected readonly entities = this.employees;
  protected override readonly noun = 'employees';
  readonly managers = signal<ManagerResponse[]>([]);

  /** Active managers, plus the OrgAdmin themself — they manage employees too. */
  readonly activeManagers = computed(() =>
    this.managerOptions.withSelf(this.managers().filter((m) => m.status !== 'DISABLED')),
  );

  // Edit modal entity
  readonly editingEmployee = signal<EmployeeResponse | null>(null);

  // Locations modal
  readonly showLocationsModal = signal(false);
  readonly locationsEmployee = signal<EmployeeResponse | null>(null);
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
    { header: 'Manager' },
    { header: 'Status' },
    { header: 'Locations' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, employee: EmployeeResponse): string => employee.employee_id;
  readonly statusColorMap = USER_STATUS_COLOR_MAP;
  readonly statusLabel = getUserStatusLabel;

  constructor() {
    super();
    this.load();
    this.loadManagers();
  }

  protected override extractId(employee: EmployeeResponse): string {
    return employee.employee_id;
  }

  protected override disableEntity(id: string): Observable<void> {
    return this.employeesService.disable(id);
  }

  protected override enableEntity(id: string): Observable<void> {
    return this.employeesService.enable(id);
  }

  protected override load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.employeesService.getAll().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load employees');
        this.loading.set(false);
      },
    });
  }

  loadManagers(): void {
    this.managersService.getAll().subscribe({
      next: (managers) => this.managers.set(managers),
      error: () => {},
    });
  }

  managerName(managerId: string): string {
    if (!managerId) return '—';
    const m =
      this.managers().find((mgr) => mgr.manager_id === managerId) ??
      (this.managerOptions.self()?.manager_id === managerId
        ? this.managerOptions.self()
        : undefined);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  }

  // ─── Register ────────────────────────────────────────────────────────

  handleRegister(data: RegisterEmployeeData): void {
    this.saving.set(true);
    this.modalError.set(null);
    this.employeesService
      .create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || undefined,
        temp_password: data.temp_password,
        manager_id: data.manager_id || undefined,
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
            this.modalError.set(err?.error?.error ?? 'Failed to register employee');
          }
        },
      });
  }

  // ─── Edit ────────────────────────────────────────────────────────────

  openEditModal(employee: EmployeeResponse): void {
    this.editingEmployee.set(employee);
    this.editError.set(null);
    this.showEditModal.set(true);
  }

  override closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingEmployee.set(null);
  }

  handleSaveEdit(data: EditEmployeeData): void {
    this.saving.set(true);
    this.editError.set(null);
    const employee = this.editingEmployee()!;
    this.employeesService
      .update(employee.employee_id, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        manager_id: data.manager_id,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.editError.set(err?.error?.error ?? 'Failed to update employee');
        },
      });
  }

  // ─── Locations ───────────────────────────────────────────────────────────────

  openLocationsModal(employee: EmployeeResponse): void {
    this.locationsEmployee.set(employee);
    this.assignedLocations.set([]);
    this.allOrgLocations.set([]);
    this.locationsError.set(null);
    this.assignError.set(null);
    this.locationsLoading.set(true);
    this.showLocationsModal.set(true);

    this.employeeLocationsService.getAll(employee.employee_id).subscribe({
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
    this.locationsEmployee.set(null);
  }

  handleAssignRequested(locationId: string): void {
    const employee = this.locationsEmployee();
    if (!employee) return;
    this.assigning.set(true);
    this.assignError.set(null);
    this.employeeLocationsService.assign(employee.employee_id, locationId).subscribe({
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
    const employee = this.locationsEmployee();
    if (!employee) return;
    this.removing.set(true);
    this.employeeLocationsService.remove(employee.employee_id, loc.location_id).subscribe({
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
