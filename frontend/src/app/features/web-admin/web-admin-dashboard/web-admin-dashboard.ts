import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { GenerateDummyDataComponent } from '../generate-dummy-data/generate-dummy-data.component';

/**
 * Web-Admin dashboard: landing page that links to all admin sections and
 * hosts the Developer Tools panel (Generate Dummy Data).
 */
@Component({
  selector: 'app-web-admin-dashboard',
  imports: [RouterLink, GenerateDummyDataComponent],
  templateUrl: './web-admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAdminDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
