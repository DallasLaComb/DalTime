import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EmployeeProfileService } from './profile.service';
import { ProfileComponentBase } from '../../../core/utils/profile-base';
import { ProfilePageComponent } from '@common-daltime';

@Component({
  selector: 'app-employee-profile',
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
export class EmployeeProfileComponent extends ProfileComponentBase {
  protected override readonly profileService = inject(EmployeeProfileService);
  protected override readonly dashboardRoute = '/employee';

  constructor() {
    super();
    this.init();
  }
}
