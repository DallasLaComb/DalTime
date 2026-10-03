import { phoneDigits, phoneError } from '../../../core/utils/phone';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent } from '../button/button';
import type { ManagerOption } from '../register-employee-modal/register-employee-modal';

export interface EditEmployeeData {
  first_name: string;
  last_name: string;
  phone: string;
  manager_id?: string;
  employee_number?: string;
}

export interface EditEmployeeInitial {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  manager_id?: string;
  employee_number?: string;
}

@Component({
  selector: 'app-edit-employee-modal',
  imports: [ButtonComponent],
  templateUrl: './edit-employee-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEmployeeModalComponent {
  open = input<boolean>(false);
  saving = input<boolean>(false);
  error = input<string | null>(null);
  entityLabel = input<string>('Employee');
  initial = input<EditEmployeeInitial | null>(null);
  /** Non-empty array enables manager selection. */
  managers = input<ManagerOption[]>([]);

  cancelled = output<void>();
  saved = output<EditEmployeeData>();

  protected readonly editFirstName = signal('');
  protected readonly editLastName = signal('');
  protected readonly editPhone = signal('');
  /** A saved number that isn't 10 digits must be corrected before anything else can be saved. */
  protected readonly phoneMessage = computed(() => phoneError(this.editPhone()));
  protected readonly editManagerId = signal('');
  protected readonly editEmployeeNumber = signal('');
  protected readonly editSubmitted = signal(false);

  /**
   * The employee's current manager when they are not in `managers` (e.g. a disabled manager the
   * page filters out). Without an option for it the select would read "No manager" even though
   * the assignment is intact, which looks like — and invites saving — a removal.
   */
  protected readonly unlistedManagerId = computed(() => {
    const id = this.editManagerId();
    return id && !this.managers().some((m) => m.manager_id === id) ? id : null;
  });

  constructor() {
    effect(() => {
      const employee = this.initial();
      if (employee) {
        this.editFirstName.set(employee.first_name);
        this.editLastName.set(employee.last_name);
        this.editPhone.set(employee.phone ?? '');
        this.editManagerId.set(employee.manager_id ?? '');
        this.editSubmitted.set(false);
      }
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected save(): void {
    this.editSubmitted.set(true);
    if (!this.editFirstName().trim() || !this.editLastName().trim() || this.phoneMessage()) return;
    this.saved.emit({
      first_name: this.editFirstName().trim(),
      last_name: this.editLastName().trim(),
      phone: phoneDigits(this.editPhone()),
      manager_id: this.managers().length > 0 ? this.editManagerId() : undefined,
    });
  }
}
