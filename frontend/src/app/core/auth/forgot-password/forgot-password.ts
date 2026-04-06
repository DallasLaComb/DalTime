import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink],
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);

  readonly step = signal<'request' | 'confirm' | 'done'>('request');
  readonly email = signal('');
  readonly code = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  get passwordsMismatch(): boolean {
    return this.submitted() && this.newPassword().trim().length > 0 && this.newPassword() !== this.confirmPassword();
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async requestCode(): Promise<void> {
    this.submitted.set(true);
    if (!this.email().trim()) return;

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.forgotPassword(this.email().trim());

    this.submitting.set(false);

    if (result.success) {
      this.submitted.set(false);
      this.step.set('confirm');
      return;
    }

    this.error.set(result.error ?? 'Failed to send verification code.');
  }

  async confirmReset(): Promise<void> {
    this.submitted.set(true);
    if (!this.code().trim() || !this.newPassword().trim() || !this.confirmPassword().trim()) return;
    if (this.newPassword() !== this.confirmPassword()) return;

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.confirmForgotPassword(
      this.email().trim(),
      this.code().trim(),
      this.newPassword(),
    );

    this.submitting.set(false);

    if (result.success) {
      this.step.set('done');
      return;
    }

    this.error.set(result.error ?? 'Failed to reset password.');
  }
}
