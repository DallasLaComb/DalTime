import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-password-input',
  templateUrl: './password-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class PasswordInputComponent {
  inputId = input<string>('password');
  label = input<string>('Password');
  testId = input<string>('password-input');
  placeholder = input<string>('Password');
  autocomplete = input<string>('new-password');
  value = input<string>('');
  hasError = input<boolean>(false);
  errorMessage = input<string>('');
  errorTestId = input<string>('password-error');

  valueChange = output<string>();
  enterPressed = output<void>();

  protected readonly showPassword = signal(false);

  protected togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
