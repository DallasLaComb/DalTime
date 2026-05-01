import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button';

@Component({
  selector: 'app-error-alert',
  templateUrl: './error-alert.html',
  styleUrl: './error-alert.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
})
export class ErrorAlertComponent {
  message = input.required<string>();
  retryable = input<boolean>(false);
  retry = output<void>();
}
