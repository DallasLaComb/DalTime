import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-not-found',
  template: `
    <div
      class="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light text-center px-3"
    >
      <img src="daltime-logo.png" alt="DalTime" height="64" class="mb-4" />
      <h1 class="display-1 fw-bold text-dark mb-0">404</h1>
      <h2 class="h4 fw-semibold text-secondary mb-3">Page Not Found</h2>
      <p class="text-muted mb-4" style="max-width: 420px;">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      @if (role()) {
        <button class="btn btn-dark btn-lg px-5" (click)="goToDashboard()">
          Back to Dashboard
        </button>
      } @else {
        <button class="btn btn-dark btn-lg px-5" (click)="login()">Sign In</button>
      }
    </div>
  `,
})
export class NotFoundComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly role = this.authService.roleSignal;

  protected goToDashboard(): void {
    const currentRole = this.role();
    if (currentRole) {
      this.router.navigate([ROLE_DASHBOARD_MAP[currentRole]]);
    }
  }

  protected login(): void {
    this.router.navigate(['/login']);
  }
}
