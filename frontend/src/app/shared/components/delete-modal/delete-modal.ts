import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '../button/button';

@Component({
  selector: 'app-delete-modal',
  imports: [ButtonComponent],
  templateUrl: './delete-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteModalComponent {
  open = input.required<boolean>();
  /** Singular display name of the entity type — e.g. "location", "employee" */
  entityType = input.required<string>();
  /** The specific item name shown in bold — e.g. "Main Office" */
  entityName = input.required<string>();
  saving = input<boolean>(false);
  /** Optional extra context shown under the question (e.g. what blocks a delete). */
  note = input<string | null>(null);
  /** Optional error from a failed delete, shown in red. */
  error = input<string | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();

  modalContainer = viewChild<ElementRef<HTMLElement>>('modalContainer');

  private previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocusedElement = document.activeElement as HTMLElement;
        setTimeout(() => this.modalContainer()?.nativeElement.focus());
      } else {
        this.previouslyFocusedElement?.focus();
        this.previouslyFocusedElement = null;
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelled.emit();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const container = this.modalContainer()?.nativeElement;
    if (!container) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable.at(-1)!;

    if (event.shiftKey) {
      if (document.activeElement === first || document.activeElement === container) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
