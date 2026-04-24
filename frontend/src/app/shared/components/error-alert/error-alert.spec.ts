import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorAlertComponent } from './error-alert';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('ErrorAlertComponent', () => {
  let fixture: ComponentFixture<ErrorAlertComponent>;

  async function createComponent(message: string, retryable = false) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ErrorAlertComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorAlertComponent);
    fixture.componentRef.setInput('message', message);
    fixture.componentRef.setInput('retryable', retryable);
    fixture.detectChanges();
  }

  // ─── Message rendering ──────────────────────────────────────────────────────

  it('renders the error message', async () => {
    await createComponent('Something went wrong');

    const messageEl = query<HTMLElement>(fixture, '.flex-grow-1');
    expect(messageEl.textContent?.trim()).toBe('Something went wrong');
  });

  // ─── Retry button visibility ────────────────────────────────────────────────

  it('shows retry button when retryable is true', async () => {
    await createComponent('Network error', true);

    const button = query<HTMLButtonElement>(fixture, 'button');
    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('Retry');
  });

  it('hides retry button when retryable is false', async () => {
    await createComponent('Network error', false);

    const button = query<HTMLButtonElement>(fixture, 'button');
    expect(button).toBeNull();
  });

  // ─── Retry output ──────────────────────────────────────────────────────────

  it('emits retry when the retry button is clicked', async () => {
    await createComponent('Network error', true);

    let emitted = false;
    fixture.componentInstance.retry.subscribe(() => (emitted = true));

    const button = query<HTMLButtonElement>(fixture, 'button');
    button.click();

    expect(emitted).toBe(true);
  });

  // ─── Accessibility & test IDs ───────────────────────────────────────────────

  it('has role="alert" on the container', async () => {
    await createComponent('Error occurred');

    const container = query<HTMLElement>(fixture, '[data-testid="error-alert"]');
    expect(container.getAttribute('role')).toBe('alert');
  });

  it('has data-testid="error-alert" on the container', async () => {
    await createComponent('Error occurred');

    const container = query<HTMLElement>(fixture, '[data-testid="error-alert"]');
    expect(container).toBeTruthy();
  });

  // ─── CSS classes / flex layout ──────────────────────────────────────────────

  it('has correct flex layout classes on the container', async () => {
    await createComponent('Error occurred');

    const container = query<HTMLElement>(fixture, '[data-testid="error-alert"]');
    expect(container.classList.contains('alert')).toBe(true);
    expect(container.classList.contains('alert-danger')).toBe(true);
    expect(container.classList.contains('d-flex')).toBe(true);
    expect(container.classList.contains('flex-column')).toBe(true);
    expect(container.classList.contains('flex-sm-row')).toBe(true);
    expect(container.classList.contains('align-items-sm-center')).toBe(true);
    expect(container.classList.contains('gap-2')).toBe(true);
  });
});
