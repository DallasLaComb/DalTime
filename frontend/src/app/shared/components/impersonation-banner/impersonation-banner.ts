import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ButtonComponent } from '../button/button';
import { ImpersonationService } from '../../../core/services/impersonation.service';

@Component({
  selector: 'app-impersonation-banner',
  imports: [ButtonComponent],
  templateUrl: './impersonation-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonationBannerComponent {
  private readonly impersonationService = inject(ImpersonationService);

  protected readonly viewingAs = this.impersonationService.viewingAs;

  readonly exitClicked = output<void>();

  protected exit(): void {
    this.exitClicked.emit();
  }
}
