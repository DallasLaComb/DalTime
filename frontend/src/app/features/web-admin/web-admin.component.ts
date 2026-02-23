import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-web-admin',
  template: `
    <h2>Web Admin Dashboard</h2>
    <p>This is {{ role() }} dashboard</p>
  `,
})
export class WebAdminComponent {
  private readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
