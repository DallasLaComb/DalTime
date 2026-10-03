import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button';

export type BroadcastBannerSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/** The fields the banner renders — satisfied by both a live broadcast and a composer preview. */
export interface BroadcastBannerData {
  message: string;
  severity: BroadcastBannerSeverity;
}

const SEVERITY_CLASS: Record<BroadcastBannerSeverity, string> = {
  INFO: 'bg-sky-50 border-sky-200 text-sky-900',
  WARNING: 'bg-amber-50 border-amber-300 text-amber-900',
  CRITICAL: 'bg-red-50 border-red-300 text-red-900',
};

const SEVERITY_ICON_CLASS: Record<BroadcastBannerSeverity, string> = {
  INFO: 'text-sky-600',
  WARNING: 'text-amber-600',
  CRITICAL: 'text-red-600',
};

/**
 * Full-width announcement strip for a WebAdmin broadcast (maintenance notices,
 * known-issue updates). Presentational only: the app shell feeds it the current
 * broadcast from `BroadcastsService`, and the composer uses it as a live preview.
 */
@Component({
  selector: 'app-broadcast-banner',
  imports: [ButtonComponent],
  templateUrl: './broadcast-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BroadcastBannerComponent {
  broadcast = input.required<BroadcastBannerData>();
  /** Hide the dismiss button (preview mode, or while impersonating). */
  canDismiss = input<boolean>(true);

  dismissed = output<void>();

  protected readonly containerClass = computed(
    () =>
      `dt-debug flex items-start gap-3 rounded-lg border px-4 py-3 ${SEVERITY_CLASS[this.broadcast().severity]}`,
  );
  protected readonly iconClass = computed(
    () => `mt-0.5 h-5 w-5 shrink-0 ${SEVERITY_ICON_CLASS[this.broadcast().severity]}`,
  );
  /** CRITICAL interrupts assistive tech; the others are announced politely. */
  protected readonly ariaRole = computed(() =>
    this.broadcast().severity === 'CRITICAL' ? 'alert' : 'status',
  );
}
