import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-manager-dashboard',
  imports: [],
  templateUrl: './manager-dashboard.html',
  styleUrl: './manager-dashboard.css',
})
export class ManagerDashboard {
  protected readonly role = inject(AuthService).roleSignal;
}
