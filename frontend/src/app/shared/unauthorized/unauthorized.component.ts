import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP, ROLE_LABEL_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div
      class="flex flex-col items-center justify-center min-h-screen bg-dt-neutral-50 text-center px-3"
    >
      <img src="daltime-logo.png" alt="DalTime" class="h-16 w-auto mx-auto mb-6" />
      <h1 class="text-4xl font-bold text-gray-900 mb-2">Access Denied</h1>
      <p class="text-gray-500 mb-6" style="max-width: 420px;" data-testid="unauthorized-message">
        @if (roleLabel(); as label) {
          You're signed in as <strong>{{ label }}</strong
          >, which doesn't have access to this page.
        } @else {
          No role is assigned to your account. Please contact your administrator.
        }
      </p>
      @if (role()) {
        <button class="btn-dt-primary btn-dt-lg px-10" (click)="goToDashboard()">
          Back to Dashboard
        </button>
      }
    </div>
  `,
})
export class UnauthorizedComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly role = this.authService.roleSignal;
  protected readonly roleLabel = computed(() => {
    const r = this.role();
    return r ? ROLE_LABEL_MAP[r] : null;
  });

  protected goToDashboard(): void {
    const currentRole = this.role();
    if (currentRole) {
      this.router.navigate([ROLE_DASHBOARD_MAP[currentRole]]);
    }
  }
}
