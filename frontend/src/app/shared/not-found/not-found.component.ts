import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-not-found',
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen bg-dt-neutral-50 text-center px-3">
      <img src="daltime-logo.png" alt="DalTime" class="h-16 w-auto mx-auto mb-6" />
      <h1 class="text-8xl font-bold text-gray-900 mb-0">404</h1>
      <h2 class="text-xl font-semibold text-gray-500 mb-4">Page Not Found</h2>
      <p class="text-gray-500 mb-6" style="max-width: 420px;">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      @if (role()) {
        <button class="btn-dt-primary btn-dt-lg px-10" (click)="goToDashboard()">
          Back to Dashboard
        </button>
      } @else {
        <button class="btn-dt-primary btn-dt-lg px-10" (click)="login()">Sign In</button>
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
