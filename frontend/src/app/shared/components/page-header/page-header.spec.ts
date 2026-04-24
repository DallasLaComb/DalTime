import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

// Test host component for content projection
@Component({
  template: `
    <app-page-header [title]="'Projected Title'">
      <a slot="before-title" href="/back">← Back</a>
    </app-page-header>
  `,
  imports: [PageHeaderComponent],
})
class TestHostComponent {}

describe('PageHeaderComponent', () => {
  // ─── Helper ─────────────────────────────────────────────────────────────────

  async function createComponent(): Promise<ComponentFixture<PageHeaderComponent>> {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.detectChanges();
    return fixture;
  }

  async function createHostComponent(): Promise<ComponentFixture<TestHostComponent>> {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  // ─── Title rendering ───────────────────────────────────────────────────────

  it('renders the title in an h2 element', async () => {
    const fixture = await createComponent();

    const h2 = query<HTMLHeadingElement>(fixture, 'h2');
    expect(h2).toBeTruthy();
    expect(h2.textContent?.trim()).toBe('Test Title');
  });

  // ─── Action button visible ─────────────────────────────────────────────────

  it('shows the action button when actionLabel is provided', async () => {
    const fixture = await createComponent();

    fixture.componentRef.setInput('actionLabel', 'Add Item');
    fixture.detectChanges();

    const button = query<HTMLButtonElement>(fixture, 'button');
    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('Add Item');
  });

  // ─── Action button hidden ─────────────────────────────────────────────────

  it('hides the action button when no actionLabel is provided', async () => {
    const fixture = await createComponent();

    const button = query<HTMLButtonElement>(fixture, 'button');
    expect(button).toBeFalsy();
  });

  // ─── Action output ─────────────────────────────────────────────────────────

  it('emits action when the button is clicked', async () => {
    const fixture = await createComponent();

    fixture.componentRef.setInput('actionLabel', 'Create');
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.action.subscribe(() => {
      emitted = true;
    });

    const button = query<HTMLButtonElement>(fixture, 'button');
    button.click();

    expect(emitted).toBe(true);
  });

  // ─── Content projection ────────────────────────────────────────────────────

  it('projects content into the [slot=before-title] slot', async () => {
    const fixture = await createHostComponent();

    const link = query<HTMLAnchorElement>(fixture, 'a[slot="before-title"]');
    expect(link).toBeTruthy();
    expect(link.textContent?.trim()).toBe('← Back');
  });

  // ─── Flex layout classes ───────────────────────────────────────────────────

  it('has the correct responsive flex layout classes on the outer container', async () => {
    const fixture = await createComponent();

    const container = query<HTMLElement>(fixture, 'div');
    expect(container.classList.contains('d-flex')).toBe(true);
    expect(container.classList.contains('flex-column')).toBe(true);
    expect(container.classList.contains('flex-sm-row')).toBe(true);
    expect(container.classList.contains('justify-content-sm-between')).toBe(true);
    expect(container.classList.contains('align-items-sm-center')).toBe(true);
    expect(container.classList.contains('gap-2')).toBe(true);
    expect(container.classList.contains('mb-4')).toBe(true);
  });

  // ─── Button styling ───────────────────────────────────────────────────────

  it('applies btn btn-dark classes to the action button', async () => {
    const fixture = await createComponent();

    fixture.componentRef.setInput('actionLabel', 'Action');
    fixture.detectChanges();

    const button = query<HTMLButtonElement>(fixture, 'button');
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('btn-dark')).toBe(true);
  });
});
