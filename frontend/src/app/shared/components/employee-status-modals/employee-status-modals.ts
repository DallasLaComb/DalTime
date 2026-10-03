import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

export interface EmployeeStatusTarget {
  first_name: string;
  last_name: string;
  email: string;
}

@Component({
  selector: 'app-employee-status-modals',
  imports: [ConfirmationModalComponent, RouterLink],
  templateUrl: './employee-status-modals.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class EmployeeStatusModalsComponent {
  entityLabel = input<string>('Employee');
  testIdPrefix = input<string>('employee');
  showDisableModal = input<boolean>(false);
  showEnableModal = input<boolean>(false);
  disablingEmployee = input<EmployeeStatusTarget | null>(null);
  enablingEmployee = input<EmployeeStatusTarget | null>(null);
  saving = input<boolean>(false);
  /** Why the disable can't go ahead yet (e.g. a manager who still has employees). Blocks confirm. */
  disableBlockedReason = input<string | null>(null);
  /** Link offered with a blocked reason, e.g. the Employees page to reassign people. */
  disableBlockedLink = input<{ label: string; route: string } | null>(null);
  /** An error from the server on the last attempt (a 409 explains what still depends on them). */
  disableError = input<string | null>(null);
  /** True when the server only needs an acknowledgement (e.g. upcoming shifts): confirm says "Disable anyway". */
  disableNeedsAcknowledgement = input<boolean>(false);
  enableError = input<string | null>(null);

  disableConfirmed = output<void>();
  disableCancelled = output<void>();
  enableConfirmed = output<void>();
  enableCancelled = output<void>();
}
