import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { AuthService } from '../../../core/auth/auth';
import { OrganizationService } from '../../../services/organization.service';
import type { Organization } from '../../../core/models/organization.model';

@Component({
  selector: 'app-org-admin-dashboard',
  imports: [],
  templateUrl: './org-admin-dashboard.html',
  styleUrl: './org-admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminDashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);

  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const orgId = this.authService.orgId;
    if (!orgId) {
      this.error.set('No organization assigned to your account.');
      this.loading.set(false);
      return;
    }

    this.orgService.getById(orgId).subscribe({
      next: (org) => {
        this.org.set(org);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organization details.');
        this.loading.set(false);
      },
    });
  }
}
