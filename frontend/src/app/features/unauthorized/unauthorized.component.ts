import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="unauthorized-container">
      <h2>Access Denied</h2>
      <p>You are not authorized to view this page.</p>
      @if (role()) {
        <p>
          Your role is: <strong>{{ role() }}</strong>
        </p>
        <button (click)="goToDashboard()">Go to My Dashboard</button>
      } @else {
        <p>No role assigned to your account. Please contact your administrator.</p>
      }
    </div>
  `,
})
export class UnauthorizedComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly role = this.authService.roleSignal;

  protected goToDashboard(): void {
    const currentRole = this.role();
    if (currentRole) {
      this.router.navigate([ROLE_DASHBOARD_MAP[currentRole]]);
    }
  }
}
