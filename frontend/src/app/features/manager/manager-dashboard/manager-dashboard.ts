import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-manager-dashboard',
  imports: [],
  templateUrl: './manager-dashboard.html',
  styleUrl: './manager-dashboard.css',
})
export class ManagerDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly user = this.authService.userSignal;
  protected readonly role = this.authService.roleSignal;
}
