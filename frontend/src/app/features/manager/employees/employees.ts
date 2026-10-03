import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { StatusFilterComponent } from '../../../shared/components/status-filter/status-filter';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PhoneDisplayComponent } from '../../../shared/components/phone-display/phone-display';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { ManagerEmployeesService } from './employees.service';
import { EmployeeCrudBaseComponent } from '../../../core/utils/employee-crud-base';
import type { EmployeeResponse } from '../../../core/models/employee.model';
import type { Observable } from 'rxjs';
import type { ColumnDef, RegisterEmployeeData, EditEmployeeData } from '@common-daltime';
import {
  CrudPageComponent,
  DataTableComponent,
  CardListComponent,
  StatusBadgeComponent,
  RegisterEmployeeModalComponent,
  EditEmployeeModalComponent,
  EmployeeStatusModalsComponent,
  EmployeeActionsComponent,
  EmployeeCardHeaderComponent,
} from '@common-daltime';

@Component({
  selector: 'app-manager-employees',
  imports: [
    DatePipe,
    StatusFilterComponent,
    EmptyStateComponent,
    PhoneDisplayComponent,
    CrudPageComponent,
    DataTableComponent,
    CardListComponent,
    StatusBadgeComponent,
    RegisterEmployeeModalComponent,
    EditEmployeeModalComponent,
    EmployeeStatusModalsComponent,
    EmployeeActionsComponent,
    EmployeeCardHeaderComponent,
  ],
  templateUrl: './employees.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerEmployeesComponent extends EmployeeCrudBaseComponent<EmployeeResponse> {
  private readonly employeesService = inject(ManagerEmployeesService);

  readonly employees = signal<EmployeeResponse[]>([]);
  protected readonly entities = this.employees;
  protected override readonly noun = 'employees';

  // Edit modal entity
  readonly editingEmployee = signal<EmployeeResponse | null>(null);

  readonly columns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', cssClass: 'text-right' },
  ];

  readonly trackById = (_index: number, employee: EmployeeResponse): string => employee.employee_id;
  readonly statusColorMap = USER_STATUS_COLOR_MAP;
  readonly statusLabel = getUserStatusLabel;

  constructor() {
    super();
    this.load();
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
}
