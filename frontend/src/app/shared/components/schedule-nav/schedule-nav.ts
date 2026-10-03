import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-schedule-nav',
  templateUrl: './schedule-nav.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-debug' },
})
export class ScheduleNavComponent {
  viewLabel = input<string>('');
  prevRequested = output<void>();
  nextRequested = output<void>();
  todayRequested = output<void>();
}
