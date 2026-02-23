import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-manager',
  template: `
    <h2>Manager Dashboard</h2>
    <p>This is {{ role() }} dashboard</p>
  `,
})
export class ManagerComponent {
  private readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
