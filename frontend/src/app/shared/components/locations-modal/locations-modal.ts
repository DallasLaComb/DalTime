import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../button/button';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

export interface AssignedLocation {
  location_id: string;
  location_name: string;
}

export interface AvailableLocation {
  location_id: string;
  name: string;
}

@Component({
  selector: 'app-locations-modal',
  imports: [ButtonComponent, ConfirmationModalComponent],
  templateUrl: './locations-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsModalComponent {
  open = input<boolean>(false);
  entityName = input<string>('');
  assignedLocations = input<AssignedLocation[]>([]);
  availableLocations = input<AvailableLocation[]>([]);
  loading = input<boolean>(false);
  error = input<string | null>(null);
  assigning = input<boolean>(false);
  assignError = input<string | null>(null);
  removing = input<boolean>(false);

  closed = output<void>();
  assignRequested = output<string>();
  removeConfirmed = output<AssignedLocation>();

  protected readonly selectedLocationId = signal('');
  protected readonly pendingRemoval = signal<AssignedLocation | null>(null);
  protected readonly showRemoveConfirm = signal(false);

  constructor() {
    effect(() => {
      const loc = this.pendingRemoval();
      if (!loc) return;
      const stillAssigned = this.assignedLocations().some((a) => a.location_id === loc.location_id);
      if (!stillAssigned && this.showRemoveConfirm()) {
        this.showRemoveConfirm.set(false);
        this.pendingRemoval.set(null);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected requestAssign(): void {
    const id = this.selectedLocationId();
    if (!id) return;
    this.selectedLocationId.set('');
    this.assignRequested.emit(id);
  }

  protected openRemoveConfirm(loc: AssignedLocation): void {
    this.pendingRemoval.set(loc);
    this.showRemoveConfirm.set(true);
  }

  protected cancelRemove(): void {
    this.showRemoveConfirm.set(false);
    this.pendingRemoval.set(null);
  }

  protected confirmRemove(): void {
    const loc = this.pendingRemoval();
    if (!loc) return;
    this.removeConfirmed.emit(loc);
  }
}
