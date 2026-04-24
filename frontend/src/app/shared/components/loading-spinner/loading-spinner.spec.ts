import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingSpinnerComponent } from './loading-spinner';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('LoadingSpinnerComponent', () => {
  let fixture: ComponentFixture<LoadingSpinnerComponent>;

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [LoadingSpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingSpinnerComponent);
    fixture.detectChanges();
  }

  // ─── Default label ──────────────────────────────────────────────────────────

  it('renders with default label "Loading..."', async () => {
    await createComponent();

    const label = query<HTMLElement>(fixture, '.visually-hidden');
    expect(label.textContent?.trim()).toBe('Loading...');
  });

  // ─── Custom label ──────────────────────────────────────────────────────────

  it('renders with a custom label', async () => {
    await createComponent();

    fixture.componentRef.setInput('label', 'Fetching data...');
    fixture.detectChanges();

    const label = query<HTMLElement>(fixture, '.visually-hidden');
    expect(label.textContent?.trim()).toBe('Fetching data...');
  });

  // ─── CSS classes ────────────────────────────────────────────────────────────

  it('has text-center py-5 classes on the outer container', async () => {
    await createComponent();

    const container = query<HTMLElement>(fixture, '[data-testid="loading-spinner"]');
    expect(container.classList.contains('text-center')).toBe(true);
    expect(container.classList.contains('py-5')).toBe(true);
  });

  it('has spinner-border text-secondary classes on the spinner element', async () => {
    await createComponent();

    const spinner = query<HTMLElement>(fixture, '[role="status"]');
    expect(spinner.classList.contains('spinner-border')).toBe(true);
    expect(spinner.classList.contains('text-secondary')).toBe(true);
  });

  // ─── Accessibility & test IDs ───────────────────────────────────────────────

  it('has role="status" on the spinner element', async () => {
    await createComponent();

    const spinner = query<HTMLElement>(fixture, '.spinner-border');
    expect(spinner.getAttribute('role')).toBe('status');
  });

  it('has data-testid="loading-spinner" on the outer container', async () => {
    await createComponent();

    const container = query<HTMLElement>(fixture, '[data-testid="loading-spinner"]');
    expect(container).toBeTruthy();
  });
});
