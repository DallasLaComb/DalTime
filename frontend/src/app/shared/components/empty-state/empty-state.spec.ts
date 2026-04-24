import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  async function createComponent(title: string, description: string) {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', title);
    fixture.componentRef.setInput('description', description);
    fixture.detectChanges();
  }

  // ─── Renders title and description ──────────────────────────────────────────

  it('renders the title text', async () => {
    await createComponent('No items found', 'Try adjusting your search criteria.');

    const title = query<HTMLElement>(fixture, '.fs-5');
    expect(title.textContent?.trim()).toBe('No items found');
  });

  it('renders the description text', async () => {
    await createComponent('No items found', 'Try adjusting your search criteria.');

    const paragraphs = fixture.nativeElement.querySelectorAll('p');
    const description = paragraphs[1] as HTMLElement;
    expect(description.textContent?.trim()).toBe('Try adjusting your search criteria.');
  });

  // ─── CSS classes ────────────────────────────────────────────────────────────

  it('has text-center py-5 text-muted classes on the outer container', async () => {
    await createComponent('Empty', 'Nothing here.');

    const container = query<HTMLElement>(fixture, '[data-testid="empty-state"]');
    expect(container.classList.contains('text-center')).toBe(true);
    expect(container.classList.contains('py-5')).toBe(true);
    expect(container.classList.contains('text-muted')).toBe(true);
  });

  it('has fs-5 mb-1 classes on the title element', async () => {
    await createComponent('Empty', 'Nothing here.');

    const title = query<HTMLElement>(fixture, '[data-testid="empty-state"] p:first-child');
    expect(title.classList.contains('fs-5')).toBe(true);
    expect(title.classList.contains('mb-1')).toBe(true);
  });

  // ─── Test ID ────────────────────────────────────────────────────────────────

  it('has data-testid="empty-state" on the outer container', async () => {
    await createComponent('Empty', 'Nothing here.');

    const container = query<HTMLElement>(fixture, '[data-testid="empty-state"]');
    expect(container).toBeTruthy();
  });
});
