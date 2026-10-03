import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  SHIFT_BADGE_STYLES,
  SHIFT_TYPE_RULES,
  deriveShiftType,
} from '../../../core/utils/schedule.utils';

/**
 * Read-only replacement for a shift-type picker: shows the type derived from the start time and
 * spells out the rule, so nobody has to wonder why a shift is (or isn't) "Night".
 */
@Component({
  selector: 'app-shift-type-hint',
  templateUrl: './shift-type-hint.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftTypeHintComponent {
  /** `HH:MM` start time; empty until the user has entered one. */
  startTime = input<string>('');

  protected readonly rules = SHIFT_TYPE_RULES;
  protected readonly badge = SHIFT_BADGE_STYLES;

  protected readonly derived = computed(() => {
    const t = this.startTime();
    return /^\d{2}:\d{2}$/.test(t) ? deriveShiftType(t) : null;
  });
}
