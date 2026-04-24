import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';
import { SearchBarComponent } from './search-bar';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('SearchBarComponent', () => {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function createComponent(
    overrides: {
      placeholder?: string;
      ariaLabel?: string;
    } = {}
  ): Promise<ComponentFixture<SearchBarComponent>> {
    await TestBed.configureTestingModule({
      imports: [SearchBarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchBarComponent);
    if (overrides.placeholder !== undefined) {
      fixture.componentRef.setInput('placeholder', overrides.placeholder);
    }
    if (overrides.ariaLabel !== undefined) {
      fixture.componentRef.setInput('ariaLabel', overrides.ariaLabel);
    }
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Default placeholder ────────────────────────────────────────────────────

  it('renders with default placeholder "Search..."', async () => {
    const fixture = await createComponent();

    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    expect(input.placeholder).toBe('Search...');
  });

  // ─── Custom placeholder ─────────────────────────────────────────────────────

  it('renders with a custom placeholder', async () => {
    const fixture = await createComponent({ placeholder: 'Filter managers...' });

    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    expect(input.placeholder).toBe('Filter managers...');
  });

  // ─── Clear button visible when text present ─────────────────────────────────

  it('shows the clear button when text is present', async () => {
    const fixture = await createComponent();

    // Simulate typing into the input
    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const clearButton = query<HTMLButtonElement>(fixture, 'button[aria-label="Clear search"]');
    expect(clearButton).toBeTruthy();
  });

  // ─── Clear button hidden when input is empty ────────────────────────────────

  it('does not show the clear button when input is empty', async () => {
    const fixture = await createComponent();

    const clearButton = query<HTMLButtonElement>(fixture, 'button[aria-label="Clear search"]');
    expect(clearButton).toBeNull();
  });

  // ─── Clear button resets input ──────────────────────────────────────────────

  it('clears the input when the clear button is clicked', async () => {
    const fixture = await createComponent();

    // Type some text
    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    input.value = 'test query';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    // Click clear
    const clearButton = query<HTMLButtonElement>(fixture, 'button[aria-label="Clear search"]');
    clearButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchValue()).toBe('');

    // Clear button should be gone
    const clearButtonAfter = query<HTMLButtonElement>(fixture, 'button[aria-label="Clear search"]');
    expect(clearButtonAfter).toBeNull();
  });

  // ─── Clear emits empty string ───────────────────────────────────────────────

  it('emits an empty string on clear', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent();

    const emitted: string[] = [];
    fixture.componentInstance.searchChange.subscribe((v: string) => emitted.push(v));

    // Type some text first
    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    input.value = 'something';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    // Flush the debounce for the typed text
    vi.advanceTimersByTime(300);

    // Click clear
    const clearButton = query<HTMLButtonElement>(fixture, 'button[aria-label="Clear search"]');
    clearButton.click();
    fixture.detectChanges();

    // Flush the debounce for the clear
    vi.advanceTimersByTime(300);

    expect(emitted).toContain('');
    expect(emitted[emitted.length - 1]).toBe('');
  });

  // ─── aria-label ─────────────────────────────────────────────────────────────

  it('has an aria-label attribute on the input', async () => {
    const fixture = await createComponent();

    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    expect(input.getAttribute('aria-label')).toBe('Search');
  });

  it('applies a custom aria-label', async () => {
    const fixture = await createComponent({ ariaLabel: 'Search organizations' });

    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    expect(input.getAttribute('aria-label')).toBe('Search organizations');
  });

  // ─── data-testid ───────────────────────────────────────────────────────────

  it('has data-testid="search-bar" on the input element', async () => {
    const fixture = await createComponent();

    const input = query<HTMLElement>(fixture, '[data-testid="search-bar"]');
    expect(input).toBeTruthy();
    expect(input.tagName.toLowerCase()).toBe('input');
  });

  // ─── form-control class ─────────────────────────────────────────────────────

  it('has the form-control class on the input', async () => {
    const fixture = await createComponent();

    const input = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
    expect(input.classList.contains('form-control')).toBe(true);
  });

  // ─── Property-based test ──────────────────────────────────────────────────

  /**
   * Feature: reusable-components, Property 2: Search bar debounce emits final value
   * Validates: Requirements 9.2
   */
  it('Property 2: after typing any non-empty string and advancing 300ms, the last emitted value equals the input', async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [SearchBarComponent],
    }).compileComponents();

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (inputStr) => {
          const fixture = TestBed.createComponent(SearchBarComponent);
          fixture.detectChanges();

          const emitted: string[] = [];
          fixture.componentInstance.searchChange.subscribe((v: string) => emitted.push(v));

          // Simulate typing the string into the input
          const inputEl = query<HTMLInputElement>(fixture, '[data-testid="search-bar"]');
          inputEl.value = inputStr;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          fixture.detectChanges();

          // Advance past the 300ms debounce period
          vi.advanceTimersByTime(300);

          // The last emitted value must equal the typed string
          return emitted.length > 0 && emitted[emitted.length - 1] === inputStr;
        },
      ),
      { numRuns: 100 },
    );
  });
});
