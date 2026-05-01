import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '@common-daltime';

@Component({
  selector: 'app-confirmation-modal',
  imports: [ButtonComponent],
  templateUrl: './confirmation-modal.html',
  styleUrl: './confirmation-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationModalComponent {
  open = input.required<boolean>();
  title = input.required<string>();
  confirmLabel = input<string>('Confirm');
  confirmStyle = input<string>('btn-danger');
  saving = input<boolean>(false);

  confirm = output<void>();
  cancel = output<void>();

  modalContainer = viewChild<ElementRef<HTMLElement>>('modalContainer');

  private previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocusedElement = document.activeElement as HTMLElement;
        // Defer focus to allow the template to render
        setTimeout(() => this.focusModal());
      } else {
        this.restoreFocus();
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.trapFocus(event);
    } else if (event.key === 'Escape') {
      this.cancel.emit();
    }
  }

  private focusModal(): void {
    const container = this.modalContainer()?.nativeElement;
    if (container) {
      container.focus();
    }
  }

  private restoreFocus(): void {
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const container = this.modalContainer()?.nativeElement;
    if (!container) return;

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement || document.activeElement === container) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
}
