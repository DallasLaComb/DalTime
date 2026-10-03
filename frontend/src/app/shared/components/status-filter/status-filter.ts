import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  parseStatusFilter,
  type StatusCounts,
  type StatusFilter,
} from '../../../core/utils/status-filter';

/**
 * "Show: All (5) / Active (2) / Disabled (2) / Pending (1)". A labelled native <select> — keyboard
 * accessible by default, a real picker on phones, and the counts are in the option text.
 */
@Component({
  selector: 'app-status-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-2" data-testid="status-filter">
      <label for="status-filter-select" class="text-sm font-medium text-gray-700">Show</label>
      <!-- appearance-none + our own chevron: the native arrow overlapped the count, e.g. "Disabled (0)". -->
      <div class="relative">
        <select
          id="status-filter-select"
          class="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-dt-secondary focus:outline-none focus:ring-2 focus:ring-dt-secondary"
          [attr.aria-label]="'Filter ' + noun() + ' by status'"
          data-testid="status-filter-select"
          (change)="changed.emit(parse($any($event.target).value))"
        >
          @for (o of options(); track o.value) {
            <option [value]="o.value" [selected]="o.value === value()">{{ o.text }}</option>
          }
        </select>
        <svg
          class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          data-testid="status-filter-chevron"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  `,
})
export class StatusFilterComponent {
  readonly value = input.required<StatusFilter>();
  readonly counts = input.required<StatusCounts>();
  /** Plural noun for the accessible name, e.g. "employees". */
  readonly noun = input('people');
  readonly changed = output<StatusFilter>();

  protected readonly options = computed(() =>
    STATUS_FILTERS.map((value) => ({
      value,
      text: `${STATUS_FILTER_LABELS[value]} (${this.counts()[value]})`,
    })),
  );

  protected parse(raw: string): StatusFilter {
    return parseStatusFilter(raw);
  }
}
