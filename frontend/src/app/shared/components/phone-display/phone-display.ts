import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatPhone, isLegacyPhone } from '../../../core/utils/phone';

/**
 * A phone number for display: "(555) 123-4567". A number saved before the 10-digit rule (say
 * "555-0199") is shown as-is with a flag, never hidden or crashed on, and gets fixed on next edit.
 */
@Component({
  selector: 'app-phone-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text()) {
      <span data-testid="phone-text">{{ text() }}</span>
      @if (legacy()) {
        <span
          class="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
          title="This number isn't 10 digits. Edit to correct it."
          data-testid="phone-invalid-flag"
          >Needs update</span
        >
      }
    } @else {
      <span class="text-gray-400">—</span>
    }
  `,
})
export class PhoneDisplayComponent {
  readonly phone = input<string | null | undefined>('');
  protected readonly text = computed(() => formatPhone(this.phone()));
  protected readonly legacy = computed(() => isLegacyPhone(this.phone()));
}
