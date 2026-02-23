import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-not-found',
  template: `
    <div class="not-found-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      @if (role()) {
        <button (click)="goToDashboard()">Go to My Dashboard</button>
      } @else {
        <button (click)="login()">Sign In</button>
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
    this.authService.login();
  }
}
