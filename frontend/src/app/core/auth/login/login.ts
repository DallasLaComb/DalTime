import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@common-daltime';
import { AuthService } from '../auth';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    if (!this.email().trim() || !this.password().trim()) return;

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.login(this.email().trim(), this.password());

    this.submitting.set(false);

    if (result.success) return; // AuthService navigates to dashboard

    if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      this.router.navigate(['/change-password']);
      return;
    }

    this.error.set(result.error ?? 'Login failed.');
  }
}
