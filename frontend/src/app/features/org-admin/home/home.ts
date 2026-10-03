import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { RouterLink } from '@angular/router';
import { LoadingSpinnerComponent, ErrorAlertComponent } from '@common-daltime';
import { OrgAdminOverviewService, type OrgAdminOverview } from './overview.service';

/** Org-admin landing page: at-a-glance analytics for the organization. */
@Component({
  selector: 'app-org-admin-home',
  imports: [PluralPipe, RouterLink, LoadingSpinnerComponent, ErrorAlertComponent],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAdminHome implements OnInit {
  private readonly overviewService = inject(OrgAdminOverviewService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<OrgAdminOverview | null>(null);

  /** "Jul 5 – Jul 11" */
  protected readonly weekLabel = computed(() => {
    const o = this.overview();
    if (!o) return '';
    const fmt = (d: string) =>
      new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    return `${fmt(o.week_start)} – ${fmt(o.week_end)}`;
  });

  /** Widest manager row drives the bar scale, so bars are comparable within each column. */
  protected readonly maxUnfilled = computed(() =>
    Math.max(1, ...(this.overview()?.managers.map((m) => m.unfilled_slots) ?? [0])),
  );
  protected readonly maxEmployees = computed(() =>
    Math.max(1, ...(this.overview()?.managers.map((m) => m.employees) ?? [0])),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.overviewService.get().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load the overview. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected barWidth(value: number, max: number): string {
    return `${Math.round((value / max) * 100)}%`;
  }
}
