import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

/**
 * "What will Generate Draft do?" — shown before a run is spent. Each run counts against a
 * per-manager monthly cap, so the user gets the explanation and the remaining budget up front.
 */
@Component({
  selector: 'app-generate-draft-confirm',
  imports: [ConfirmationModalComponent],
  templateUrl: './generate-draft-confirm.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateDraftConfirmComponent {
  open = input.required<boolean>();
  /** e.g. "July 2026". */
  monthLabel = input.required<string>();
  /** Whose schedule is generated, when it isn't the viewer's own (org-admin view). */
  managerName = input<string | null>(null);
  runsUsed = input.required<number>();
  maxRuns = input.required<number>();
  saving = input<boolean>(false);
  /** Open slots a run would try to fill; null when unknown. 0 means there is nothing to generate. */
  openSlots = input<number | null>(null);
  /** Open shifts (no employee) this month — reported, but not filled by a run. */
  openShifts = input<number | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  protected readonly nothingOpen = computed(() => this.openSlots() === 0);

  protected readonly runsLeftAfter = computed(() =>
    Math.max(0, this.maxRuns() - this.runsUsed() - 1),
  );
}
