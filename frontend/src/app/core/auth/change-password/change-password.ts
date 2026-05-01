import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@common-daltime';
import { AuthService } from '../auth';

@Component({
  selector: 'app-change-password',
  imports: [ButtonComponent],
  templateUrl: './change-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  ngOnInit(): void {
    if (!this.authService.hasPendingChallenge) {
      this.router.navigate(['/login']);
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  get passwordsMismatch(): boolean {
    return this.submitted() && this.newPassword().trim().length > 0 && this.newPassword() !== this.confirmPassword();
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    if (!this.newPassword().trim() || !this.confirmPassword().trim()) return;
    if (this.newPassword() !== this.confirmPassword()) return;

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.completeNewPassword(this.newPassword());

    this.submitting.set(false);

    if (result.success) return; // AuthService navigates to dashboard

    this.error.set(result.error ?? 'Failed to set password.');
  }
}
