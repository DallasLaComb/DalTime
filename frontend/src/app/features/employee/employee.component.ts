import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-employee',
  template: `
    <h2>Employee Dashboard</h2>
    <p>This is {{ role() }} dashboard</p>
  `,
})
export class EmployeeComponent {
  private readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
