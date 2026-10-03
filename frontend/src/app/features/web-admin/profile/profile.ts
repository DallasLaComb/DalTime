import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WebAdminProfileService } from './profile.service';
import { ProfileComponentBase } from '../../../core/utils/profile-base';
import { ProfilePageComponent } from '@common-daltime';

/**
 * Profile page for the Web-Admin role.
 * Extends ProfileComponentBase so all loading/saving/error state is handled
 * in the shared base class. Delegates all rendering to app-profile-page.
 * Accessible at /web-admin/profile, guarded by authGuard + roleGuard('WebAdmin').
 */
@Component({
  selector: 'app-web-admin-profile',
  imports: [ProfilePageComponent],
  template: `
    <app-profile-page
      [loading]="loading()"
      [loadError]="error()"
      [profile]="profileData()"
      [saving]="saving()"
      [saveSuccess]="saveSuccess()"
      [saveError]="saveError()"
      (retried)="load()"
      (navigatedBack)="goToDashboard()"
      (startedEditing)="onStartedEditing()"
      (saved)="handleSave($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAdminProfileComponent extends ProfileComponentBase {
  /** Injects the web-admin profile service that satisfies IProfileService. */
  protected override readonly profileService = inject(WebAdminProfileService);

  /** Dashboard route the "Dashboard" button navigates back to. */
  protected override readonly dashboardRoute = '/web-admin';

  constructor() {
    super();
    // Call init() after super() so the base class signals are ready before the
    // HTTP request fires and change detection starts running.
    this.init();
  }
}
