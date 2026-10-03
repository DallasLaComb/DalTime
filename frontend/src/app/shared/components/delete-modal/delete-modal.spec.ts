import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DeleteModalComponent } from './delete-modal';

@Component({
  template: `
    <app-delete-modal
      [open]="open()"
      entityType="location"
      [entityName]="name()"
      [saving]="saving()"
      (confirmed)="onConfirmed()"
      (cancelled)="onCancelled()"
    />
  `,
  imports: [DeleteModalComponent],
})
class TestHostComponent {
  open = signal(false);
  name = signal('Main Office');
  saving = signal(false);
  confirmed = false;
  cancelled = false;
  onConfirmed() {
    this.confirmed = true;
  }
  onCancelled() {
    this.cancelled = true;
  }
}

describe('DeleteModalComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should not render when closed', () => {
    const modal = fixture.nativeElement.querySelector('[data-testid="delete-modal"]');
    expect(modal).toBeNull();
  });

  it('should render entity name and type when open', () => {
    host.open.set(true);
    fixture.detectChanges();

    const nameEl = fixture.nativeElement.querySelector('[data-testid="delete-modal-entity-name"]');
    expect(nameEl?.textContent?.trim()).toBe('Main Office');

    const title = fixture.nativeElement.querySelector('h5');
    expect(title?.textContent?.trim()).toBe('Delete location');
  });

  it('should emit confirmed when confirm button is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('[data-testid="delete-modal-confirm"]');
    confirmBtn.click();
    fixture.detectChanges();

    expect(host.confirmed).toBe(true);
  });

  it('should emit cancelled when cancel button is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="delete-modal-cancel"]');
    cancelBtn.click();
    fixture.detectChanges();

    expect(host.cancelled).toBe(true);
  });
});
