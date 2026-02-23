import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-org-admin-dashboard',
  imports: [],
  templateUrl: './org-admin-dashboard.html',
  styleUrl: './org-admin-dashboard.css',
})
export class OrgAdminDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly user = this.authService.userSignal;
  protected readonly role = this.authService.roleSignal;
}
