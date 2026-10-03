import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button';

@Component({
  selector: 'app-employee-actions',
  imports: [ButtonComponent],
  templateUrl: './employee-actions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class EmployeeActionsComponent {
  status = input<string>('');
  /** 'card' uses flex-1 buttons; 'table' uses mr-1 spacing */
  layout = input<'card' | 'table'>('card');

  editRequested = output<void>();
  disableRequested = output<void>();
  enableRequested = output<void>();
}
