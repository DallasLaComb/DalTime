import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ManagerProfileService } from './profile.service';
import { ProfileComponentBase } from '../../../core/utils/profile-base';
import { ProfilePageComponent } from '@common-daltime';

@Component({
  selector: 'app-manager-profile',
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
export class ManagerProfileComponent extends ProfileComponentBase {
  protected override readonly profileService = inject(ManagerProfileService);
  protected override readonly dashboardRoute = '/manager';

  constructor() {
    super();
    this.init();
  }
}
