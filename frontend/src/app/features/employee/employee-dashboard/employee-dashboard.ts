import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-employee-dashboard',
  imports: [],
  templateUrl: './employee-dashboard.html',
  styleUrl: './employee-dashboard.css',
})
export class EmployeeDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly user = this.authService.userSignal;
  protected readonly role = this.authService.roleSignal;
}
