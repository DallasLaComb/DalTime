import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GenerateDummyDataComponent } from './generate-dummy-data.component';
import { GenerateDummyDataService } from './generate-dummy-data.service';
import { environment } from '../../../../environments/environment';

/** Endpoint under test. */
const ENDPOINT = `${environment.api.baseUrl}/web-admin/generate-dummy-data`;

/** Helper: pin the system clock to a specific date for a test. */
function mockDate(date: Date): void {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

describe('GenerateDummyDataComponent', () => {
  let httpMock: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<GenerateDummyDataComponent>>;
  let component: GenerateDummyDataComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateDummyDataComponent],
      providers: [GenerateDummyDataService, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerateDummyDataComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    // Restore real timers after any test that installs fake timers.
    vi.useRealTimers();
  });

  // --- Initial state (before modal is opened) ---

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('starts with the modal closed', () => {
    expect(component.modalOpen()).toBe(false);
  });

  it('starts with no success or error message', () => {
    expect(component.successMessage()).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });

  it('starts with an empty monthYearOptions array before the modal is opened', () => {
    // Options are built lazily in openModal() so they reflect the live date.
    expect(component.monthYearOptions()).toEqual([]);
  });

  // --- Month/year options array (built at modal-open time) ---

  it('openModal() builds exactly 25 month/year options', () => {
    component.openModal();
    expect(component.monthYearOptions().length).toBe(25);
  });

  it('the first option is the current month and year', () => {
    mockDate(new Date(2026, 5, 15)); // June 15 2026 (month 0-indexed)

    component.openModal();
    const first = component.monthYearOptions()[0];

    expect(first.year).toBe(2026);
    expect(first.month).toBe(6); // 1-indexed
    expect(first.label).toBe('June 2026');
  });

  it('the last option is exactly 24 calendar months after the current month', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    const last = component.monthYearOptions()[24];

    // June 2026 + 24 months = June 2028
    expect(last.year).toBe(2028);
    expect(last.month).toBe(6);
    expect(last.label).toBe('June 2028');
  });

  it('no option in the list has a month/year before the current month', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    const opts = component.monthYearOptions();
    const currentIndex = 2026 * 12 + 6; // year*12 + month (1-indexed)

    for (const opt of opts) {
      const optIndex = opt.year * 12 + opt.month;
      expect(optIndex).toBeGreaterThanOrEqual(currentIndex);
    }
  });

  it('correctly wraps month/year across a year boundary', () => {
    mockDate(new Date(2026, 10, 1)); // November 2026

    component.openModal();
    const opts = component.monthYearOptions();

    // November 2026 → December 2026 → January 2027 → … → November 2028
    expect(opts[0]).toEqual({ year: 2026, month: 11, label: 'November 2026' });
    expect(opts[1]).toEqual({ year: 2026, month: 12, label: 'December 2026' });
    expect(opts[2]).toEqual({ year: 2027, month: 1, label: 'January 2027' });
    expect(opts[24]).toEqual({ year: 2028, month: 11, label: 'November 2028' });
  });

  it('sets selectedOptionIndex to 0 (current month) when the modal opens', () => {
    component.openModal();
    expect(component.selectedOptionIndex()).toBe(0);
  });

  it('selectedMonthYear() returns the label of the first option after modal opens', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    expect(component.selectedMonthYear()).toBe('June 2026');
  });

  it('resets selection to current month when modal is re-opened after a prior selection', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['selectedOptionIndex'].set(5); // simulate user picking a later month
    expect(component.selectedOptionIndex()).toBe(5);

    component.closeModal();
    component.openModal(); // re-open
    expect(component.selectedOptionIndex()).toBe(0); // reset to current month
  });

  // --- Modal open / close ---

  it('openModal() sets modalOpen to true and clears prior feedback', () => {
    component['successMessage'].set('old success');
    component['errorMessage'].set('old error');

    component.openModal();

    expect(component.modalOpen()).toBe(true);
    expect(component.successMessage()).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });

  it('closeModal() sets modalOpen to false', () => {
    component['modalOpen'].set(true);
    component.closeModal();
    expect(component.modalOpen()).toBe(false);
  });

  // --- Picker signals ---

  it('onOptionChange() updates selectedOptionIndex from a DOM select event', () => {
    component.openModal(); // build options first
    const event = { target: { value: '3' } } as unknown as Event;
    component.onOptionChange(event);
    expect(component.selectedOptionIndex()).toBe(3);
  });

  it('selectedOption() returns the option at the selected index', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['selectedOptionIndex'].set(2);

    const opt = component.selectedOption();
    // June 2026 + 2 months = August 2026
    expect(opt?.year).toBe(2026);
    expect(opt?.month).toBe(8);
    expect(opt?.label).toBe('August 2026');
  });

  it('selectedMonthYear() reflects the currently selected option label', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['selectedOptionIndex'].set(1);

    expect(component.selectedMonthYear()).toBe('July 2026');
  });

  // --- API call on confirmed ---

  it('onConfirmed() calls POST with the selected option year and month and shows success message', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['selectedOptionIndex'].set(0); // June 2026
    component['modalOpen'].set(true);

    component.onConfirmed();

    // saving flag should be true while in flight
    expect(component.saving()).toBe(true);

    const req = httpMock.expectOne(ENDPOINT);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ year: 2026, month: 6 });

    req.flush({ message: 'Generated dummy data for 6/2026' });

    expect(component.saving()).toBe(false);
    expect(component.modalOpen()).toBe(false);
    expect(component.successMessage()).toBe('Generated dummy data for 6/2026');
    expect(component.errorMessage()).toBeNull();
  });

  it('onConfirmed() shows error.message when the API returns a new-style range 400', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['modalOpen'].set(true);

    component.onConfirmed();

    const req = httpMock.expectOne(ENDPOINT);
    req.flush(
      { message: 'month/year must not be in the past' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.saving()).toBe(false);
    expect(component.modalOpen()).toBe(false);
    expect(component.errorMessage()).toBe('month/year must not be in the past');
    expect(component.successMessage()).toBeNull();
  });

  it('onConfirmed() shows error.error when the API returns an existing-style validation 400', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['modalOpen'].set(true);

    component.onConfirmed();

    const req = httpMock.expectOne(ENDPOINT);
    req.flush(
      { error: 'month must be between 1 and 12 (1-indexed)' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.errorMessage()).toBe('month must be between 1 and 12 (1-indexed)');
  });

  it('onConfirmed() falls back to a generic error message when the backend body has no error or message field', () => {
    mockDate(new Date(2026, 5, 15)); // June 2026

    component.openModal();
    component['modalOpen'].set(true);

    component.onConfirmed();

    const req = httpMock.expectOne(ENDPOINT);
    req.flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(component.errorMessage()).toBe('Failed to generate dummy data.');
  });

  // --- Template data-testid presence ---

  it('renders the trigger button with data-testid generate-dummy-data-btn', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-btn"]')).toBeTruthy();
  });

  it('renders the modal container with data-testid generate-dummy-data-modal when open', () => {
    component.openModal();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-modal"]')).toBeTruthy();
  });

  it('renders the combined month+year select inside the open modal', () => {
    component.openModal();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="dummy-data-month-year-select"]')).toBeTruthy();
  });

  it('does not render success banner by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-success"]')).toBeNull();
  });

  it('does not render error banner by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-error"]')).toBeNull();
  });

  it('renders the success banner after a successful API response', () => {
    component['successMessage'].set('All done!');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-success"]')).toBeTruthy();
  });

  it('renders the error banner after a failed API response', () => {
    component['errorMessage'].set('Something went wrong');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="generate-dummy-data-error"]')).toBeTruthy();
  });

  it('the combined select renders 25 options when the modal is open', () => {
    component.openModal();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const select = el.querySelector('[data-testid="dummy-data-month-year-select"]');
    expect(select?.querySelectorAll('option').length).toBe(25);
  });
});
