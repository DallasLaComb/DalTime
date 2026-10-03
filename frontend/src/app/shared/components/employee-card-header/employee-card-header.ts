import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { USER_STATUS_COLOR_MAP, getUserStatusLabel } from '../../../core/utils/user-status';
import { PhoneDisplayComponent } from '../phone-display/phone-display';
import { StatusBadgeComponent } from '../status-badge/status-badge';

export interface EmployeeCardHeaderData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-employee-card-header',
  imports: [DatePipe, StatusBadgeComponent, PhoneDisplayComponent],
  templateUrl: './employee-card-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class EmployeeCardHeaderComponent {
  employee = input.required<EmployeeCardHeaderData>();
  nameTestId = input<string>('employee-name');
  emailTestId = input<string>('employee-email');
  phoneTestId = input<string>('employee-phone');

  protected readonly statusColorMap = USER_STATUS_COLOR_MAP;
  protected readonly statusLabel = getUserStatusLabel;
}
