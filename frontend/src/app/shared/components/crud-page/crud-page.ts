import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PageHeaderComponent } from '../page-header/page-header';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner';
import { ErrorAlertComponent } from '../error-alert/error-alert';
import { EmptyStateComponent } from '../empty-state/empty-state';

@Component({
  selector: 'app-crud-page',
  templateUrl: './crud-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [PageHeaderComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent],
})
export class CrudPageComponent {
  title = input.required<string>();
  actionLabel = input<string>();
  loading = input.required<boolean>();
  error = input<string | null>(null);
  empty = input(false);
  emptyTitle = input('No items yet');
  emptyDescription = input('');

  action = output<void>();
  retry = output<void>();
}
