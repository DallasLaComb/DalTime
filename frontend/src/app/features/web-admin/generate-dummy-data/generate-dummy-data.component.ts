import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent, ConfirmationModalComponent } from '@common-daltime';
import { GenerateDummyDataService } from './generate-dummy-data.service';
import type { HttpErrorResponse } from '@angular/common/http';

/** A single selectable month/year option in the picker. */
export interface MonthYearOption {
  /** Full calendar year, e.g. 2026. */
  year: number;
  /** 1-indexed month (1 = January, 12 = December). */
  month: number;
  /** Human-readable label shown in the <select>, e.g. "June 2026". */
  label: string;
}

/** Human-readable month labels indexed 1–12 (index 0 is unused). */
const MONTH_LABELS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

/**
 * Builds the array of 25 selectable month/year options anchored to `now`.
 * The first entry is the month containing `now`; the last entry is exactly
 * 24 calendar months later (inclusive on both ends). This must be called at
 * modal-open time rather than at module load time so the range reflects the
 * actual current date whenever the modal is opened.
 */
function buildMonthYearOptions(now: Date): MonthYearOption[] {
  const options: MonthYearOption[] = [];
  const startYear = now.getFullYear();
  const startMonth = now.getMonth() + 1; // convert 0-indexed to 1-indexed

  for (let i = 0; i <= 24; i++) {
    // Advance i months from startMonth, handling year rollovers.
    const totalMonths = startMonth - 1 + i; // 0-indexed offset from January of startYear
    const year = startYear + Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1; // back to 1-indexed
    options.push({ year, month, label: `${MONTH_LABELS[month]} ${year}` });
  }

  return options;
}

/**
 * Smart component for the Web-Admin "Generate Dummy Data" feature.
 *
 * Shows a trigger button on the web-admin dashboard. When clicked, opens a
 * confirmation modal that contains a single combined month+year picker. The
 * picker's options are computed dynamically each time the modal opens so the
 * range is always anchored to the real current date (current month through
 * current month + 24, inclusive — 25 options total). On confirm, calls
 * POST /web-admin/generate-dummy-data with the selected month and year.
 * Displays success or error feedback inline after the API call completes.
 *
 * This component is standalone and Web-Admin role only — the route that
 * renders the dashboard (and therefore this component) is guarded by roleGuard
 * with roles: ['WebAdmin'] in app.routes.ts.
 */
@Component({
  selector: 'app-generate-dummy-data',
  imports: [ButtonComponent, ConfirmationModalComponent],
  templateUrl: './generate-dummy-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateDummyDataComponent {
  private readonly service = inject(GenerateDummyDataService);

  /** Controls whether the confirmation modal is open. */
  readonly modalOpen = signal(false);

  /** True while the HTTP call is in flight; disables the confirm button. */
  readonly saving = signal(false);

  /** Holds the success message returned by the Lambda on 200. */
  readonly successMessage = signal<string | null>(null);

  /** Holds the error message shown when the Lambda returns non-2xx. */
  readonly errorMessage = signal<string | null>(null);

  /**
   * The 25-option array built each time the modal opens. Stored as a signal
   * so the template can read it reactively and so tests can inspect it directly.
   * Starts empty; populated by openModal().
   */
  readonly monthYearOptions = signal<MonthYearOption[]>([]);

  /**
   * The index into monthYearOptions[] of the currently selected option.
   * Defaults to 0 (current month/year) whenever the modal opens.
   */
  readonly selectedOptionIndex = signal<number>(0);

  /**
   * The currently selected MonthYearOption, derived from the options array and
   * the selected index. Used to extract year/month for the API call and to
   * render the human-readable summary inside the modal.
   */
  readonly selectedOption = computed<MonthYearOption | null>(() => {
    const opts = this.monthYearOptions();
    const idx = this.selectedOptionIndex();
    return opts.length > 0 ? (opts[idx] ?? null) : null;
  });

  /**
   * Human-readable label for the currently selected option, e.g. "June 2026".
   * Used in the modal's explanatory text. Falls back to empty string if no
   * options have been built yet (before the modal first opens).
   */
  readonly selectedMonthYear = computed(() => this.selectedOption()?.label ?? '');

  /**
   * Opens the confirmation modal.
   * Builds the month/year options array fresh from the current date so the
   * range is always [now, now+24 months]. Resets selection to the first option
   * (current month/year) and clears any prior success/error feedback.
   */
  openModal(): void {
    const opts = buildMonthYearOptions(new Date());
    this.monthYearOptions.set(opts);
    this.selectedOptionIndex.set(0);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.modalOpen.set(true);
  }

  /** Closes the confirmation modal without making any API call. */
  closeModal(): void {
    this.modalOpen.set(false);
  }

  /**
   * Handles the combined month/year <select> change event.
   * Parses the string index from the DOM event and updates the selected index signal.
   */
  onOptionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedOptionIndex.set(parseInt(value, 10));
  }

  /**
   * Fires when the user clicks "Generate" in the confirmation modal.
   * Guards against a null selectedOption (should not happen in normal usage,
   * but TypeScript requires the check). Calls the service, sets saving state
   * during the in-flight request, and shows either a success or error message
   * once the response arrives. The modal stays open while saving so the user
   * can see the loading state.
   *
   * Error message preference order:
   *   1. err.error.message — used by the new dynamic-range 400 responses
   *   2. err.error.error   — used by existing validation 400 responses
   *   3. Generic fallback string
   */
  onConfirmed(): void {
    const option = this.selectedOption();
    if (!option) return;

    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.service.generate({ year: option.year, month: option.month }).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.successMessage.set(response.message);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        // The backend returns either { message: string } (new range errors) or
        // { error: string } (existing validation errors). Check both shapes.
        const body = err.error as { message?: string; error?: string } | null;
        const detail = body?.message ?? body?.error ?? 'Failed to generate dummy data.';
        this.errorMessage.set(detail);
      },
    });
  }
}
