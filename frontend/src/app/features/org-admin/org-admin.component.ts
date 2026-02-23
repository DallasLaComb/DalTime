import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-org-admin',
  template: `
    <h2>Org Admin Dashboard</h2>
    <p>This is {{ role() }} dashboard</p>
  `,
})
export class OrgAdminComponent {
  private readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
