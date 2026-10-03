import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  status = input.required<string>();
  label = input.required<string>();
  colorMap = input.required<Record<string, string>>();

  badgeClass = computed(
    () => `dt-debug dt-badge ${this.colorMap()[this.status()] ?? 'badge-dt-secondary'}`
  );
}
