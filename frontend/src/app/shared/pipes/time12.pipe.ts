import { Pipe, PipeTransform } from '@angular/core';
import { formatTime12 } from '../../core/utils/schedule.utils';

/** `{{ shift.start_time | time12 }}` → "9:00 AM". Never show 24-hour ("military") time. */
@Pipe({ name: 'time12' })
export class Time12Pipe implements PipeTransform {
  transform(time: string | null | undefined): string {
    return formatTime12(time);
  }
}
