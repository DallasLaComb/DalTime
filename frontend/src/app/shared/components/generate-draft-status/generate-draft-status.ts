import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button';

export type GenerateDraftStatus = 'idle' | 'processing' | 'success' | 'failure';

/**
 * Progress / outcome of a Generate Draft run. Deliberately not dismissible while the run is
 * processing (no ×, backdrop click or Escape); once it finishes the user must acknowledge it.
 */
@Component({
  selector: 'app-generate-draft-status',
  imports: [ButtonComponent],
  templateUrl: './generate-draft-status.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateDraftStatusComponent {
  status = input.required<GenerateDraftStatus>();
  /** e.g. "July 2026". */
  monthLabel = input.required<string>();
  /** The outcome text shown once the run has finished. */
  message = input<string | null>(null);
  accepted = output<void>();
}
