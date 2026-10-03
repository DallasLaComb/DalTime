import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

// Test host component for content projection
@Component({
  template: `
    <app-confirmation-modal [open]="true" [title]="'Delete Item'">
      <p>Are you sure you want to delete this item?</p>
    </app-confirmation-modal>
  `,
  imports: [ConfirmationModalComponent],
})
class TestHostComponent {}

describe('ConfirmationModalComponent', () => {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function createComponent(
    open: boolean,
    overrides: {
      title?: string;
      confirmLabel?: string;
      confirmVariant?: string;
      saving?: boolean;
    } = {},
  ): Promise<ComponentFixture<ConfirmationModalComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ConfirmationModalComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmationModalComponent);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('title', overrides.title ?? 'Confirm Action');
    if (overrides.confirmLabel !== undefined) {
      fixture.componentRef.setInput('confirmLabel', overrides.confirmLabel);
    }
    if (overrides.confirmVariant !== undefined) {
      fixture.componentRef.setInput('confirmVariant', overrides.confirmVariant);
    }
    if (overrides.saving !== undefined) {
      fixture.componentRef.setInput('saving', overrides.saving);
    }
    fixture.detectChanges();
    return fixture;
  }

  async function createHostComponent(): Promise<ComponentFixture<TestHostComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  // ─── Rendering when open ────────────────────────────────────────────────────

  it('renders the modal when open is true', async () => {
    const fixture = await createComponent(true);

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    expect(modal).toBeTruthy();
  });

  // ─── Hidden when closed ─────────────────────────────────────────────────────

  it('does not render the modal when open is false', async () => {
    const fixture = await createComponent(false);

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    expect(modal).toBeNull();
  });

  // ─── Confirm output ─────────────────────────────────────────────────────────

  it('emits confirm when the confirm button is clicked', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.confirmed.subscribe(() => (emitted = true));

    query<HTMLButtonElement>(fixture, '[data-testid="confirmation-modal-confirm"]').click();

    expect(emitted).toBe(true);
  });

  // ─── Cancel output via cancel button ────────────────────────────────────────

  it('emits cancel when the cancel button is clicked', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));

    query<HTMLButtonElement>(fixture, '[data-testid="confirmation-modal-cancel"]').click();

    expect(emitted).toBe(true);
  });

  // ─── Cancel output via backdrop ─────────────────────────────────────────────

  it('emits cancel when the backdrop is clicked', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    modal.click();

    expect(emitted).toBe(true);
  });

  // ─── Does not emit cancel when dialog content is clicked ────────────────────

  it('does not emit cancel when the dialog content is clicked', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));

    const dialog = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"] > div');
    dialog.click();

    expect(emitted).toBe(false);
  });

  // ─── Spinner when saving ────────────────────────────────────────────────────

  it('shows a spinner on the confirm button when saving is true', async () => {
    const fixture = await createComponent(true, { saving: true });

    const spinner = query<HTMLElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"] output',
    );
    expect(spinner).toBeTruthy();
    expect(spinner.tagName.toLowerCase()).toBe('output');
  });

  // ─── Confirm button disabled when saving ────────────────────────────────────

  it('disables the confirm button when saving is true', async () => {
    const fixture = await createComponent(true, { saving: true });

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.disabled).toBe(true);
  });

  // ─── Confirm button enabled when not saving ────────────────────────────────

  it('enables the confirm button when saving is false', async () => {
    const fixture = await createComponent(true, { saving: false });

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.disabled).toBe(false);
  });

  // ─── Custom confirmVariant ──────────────────────────────────────────────────

  it('applies custom confirmVariant to the confirm button', async () => {
    const fixture = await createComponent(true, { confirmVariant: 'primary' });

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.classList.contains('btn-dt-primary')).toBe(true);
  });

  // ─── Default confirmVariant ─────────────────────────────────────────────────

  it('applies btn-dt-danger as the default confirmVariant', async () => {
    const fixture = await createComponent(true);

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.classList.contains('btn-dt-danger')).toBe(true);
  });

  // ─── data-testid ───────────────────────────────────────────────────────────

  it('has data-testid="confirmation-modal" on the modal container', async () => {
    const fixture = await createComponent(true);

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    expect(modal).toBeTruthy();
  });

  // ─── Modal layout classes ──────────────────────────────────────────────────

  it('centers the modal vertically and horizontally', async () => {
    const fixture = await createComponent(true);

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    expect(modal.classList.contains('flex')).toBe(true);
    expect(modal.classList.contains('items-end')).toBe(true);
    // Dialog inner panel is constrained in width
    const dialog = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"] > div');
    expect(dialog.classList.contains('w-full')).toBe(true);
  });

  // ─── Content projection ────────────────────────────────────────────────────

  it('projects body content via ng-content', async () => {
    const fixture = await createHostComponent();

    const body = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"] p');
    expect(body).toBeTruthy();
    expect(body.textContent?.trim()).toBe('Are you sure you want to delete this item?');
  });

  // ─── Title rendering ───────────────────────────────────────────────────────

  it('renders the title in the modal header', async () => {
    const fixture = await createComponent(true, { title: 'Delete User' });

    const title = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"] h5');
    expect(title.textContent?.trim()).toBe('Delete User');
  });

  // ─── Confirm label ─────────────────────────────────────────────────────────

  it('renders the default confirm label "Confirm"', async () => {
    const fixture = await createComponent(true);

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.textContent?.trim()).toBe('Confirm');
  });

  it('renders a custom confirm label', async () => {
    const fixture = await createComponent(true, { confirmLabel: 'Delete' });

    const confirmButton = query<HTMLButtonElement>(
      fixture,
      '[data-testid="confirmation-modal-confirm"]',
    );
    expect(confirmButton.textContent?.trim()).toBe('Delete');
  });

  // ─── Close button in header ─────────────────────────────────────────────────

  it('emits cancel when the close button in the header is clicked', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));

    query<HTMLButtonElement>(fixture, '[data-testid="confirmation-modal-close"]').click();

    expect(emitted).toBe(true);
  });

  // ─── Focus trapping ────────────────────────────────────────────────────────

  it('traps focus within the modal when open', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent(true);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus the last focusable element and press Tab
    lastFocusable.focus();
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    modal.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    vi.useRealTimers();
  });

  it('traps focus backward with Shift+Tab from first focusable element', async () => {
    vi.useFakeTimers();
    const fixture = await createComponent(true);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0];

    // Focus the first focusable element and press Shift+Tab
    firstFocusable.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    modal.dispatchEvent(shiftTabEvent);

    expect(shiftTabEvent.defaultPrevented).toBe(true);
    vi.useRealTimers();
  });

  // ─── Focus restoration ─────────────────────────────────────────────────────

  it('returns focus to the previously focused element when the modal closes', async () => {
    vi.useFakeTimers();

    // Create a button to act as the trigger element
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open Modal';
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    const fixture = await createComponent(true);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    // Close the modal
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(triggerButton);

    // Cleanup
    document.body.removeChild(triggerButton);
    vi.useRealTimers();
  });

  // ─── Escape key ─────────────────────────────────────────────────────────────

  it('emits cancel when Escape key is pressed', async () => {
    const fixture = await createComponent(true);

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));

    const modal = query<HTMLElement>(fixture, '[data-testid="confirmation-modal"]');
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    modal.dispatchEvent(escapeEvent);

    expect(emitted).toBe(true);
  });

  // ─── Backdrop rendering ─────────────────────────────────────────────────────

  it('renders a backdrop when open', async () => {
    const fixture = await createComponent(true);

    const backdrop = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.classList.contains('fixed')).toBe(true);
    expect(backdrop.classList.contains('inset-0')).toBe(true);
  });
});
