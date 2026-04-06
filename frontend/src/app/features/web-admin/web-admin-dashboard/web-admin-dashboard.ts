import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-web-admin-dashboard',
  imports: [],
  templateUrl: './web-admin-dashboard.html',
  styleUrl: './web-admin-dashboard.css',
})
export class WebAdminDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
