import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  status = input.required<string>();
  label = input.required<string>();
  colorMap = input.required<Record<string, string>>();

  badgeClass = computed(() => this.colorMap()[this.status()] ?? 'bg-secondary');
}
