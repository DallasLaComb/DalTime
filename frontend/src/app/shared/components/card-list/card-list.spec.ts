import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardListComponent } from './card-list';

function queryAll<T extends HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string
): T[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
}

@Component({
  template: `
    <ng-template #cardTpl let-item>
      <span class="card-item">{{ item.name }}</span>
    </ng-template>
    <app-card-list [data]="items" [trackBy]="trackFn" [cardTemplate]="cardTpl" />
  `,
  imports: [CardListComponent],
})
class TestHostComponent {
  items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ];
  trackFn = (_index: number, item: { id: number }) => item.id;
}

describe('CardListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  async function createComponent(
    items: { id: number; name: string }[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ]
  ): Promise<ComponentFixture<TestHostComponent>> {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.items = items;
    fixture.detectChanges();
    return fixture;
  }

  // ─── Renders cards from data array ──────────────────────────────────────────

  it('renders one card per data item', async () => {
    await createComponent();

    const cards = queryAll<HTMLElement>(fixture, '.card');
    expect(cards.length).toBe(3);
  });

  it('renders the card template content for each item', async () => {
    await createComponent();

    const items = queryAll<HTMLElement>(fixture, '.card-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent?.trim()).toBe('Item 1');
    expect(items[1].textContent?.trim()).toBe('Item 2');
    expect(items[2].textContent?.trim()).toBe('Item 3');
  });

  it('renders no cards when data is empty', async () => {
    await createComponent([]);

    const cards = queryAll<HTMLElement>(fixture, '.card');
    expect(cards.length).toBe(0);
  });

  // ─── Card styling ──────────────────────────────────────────────────────────

  it('applies card mb-3 shadow-sm classes to each card', async () => {
    await createComponent();

    const cards = queryAll<HTMLElement>(fixture, '.card');
    for (const card of cards) {
      expect(card.classList.contains('card')).toBe(true);
      expect(card.classList.contains('mb-3')).toBe(true);
      expect(card.classList.contains('shadow-sm')).toBe(true);
    }
  });

  it('wraps card content in a card-body div', async () => {
    await createComponent();

    const cardBodies = queryAll<HTMLElement>(fixture, '.card-body');
    expect(cardBodies.length).toBe(3);
  });

  // ─── d-lg-none on outer div ─────────────────────────────────────────────────

  it('has d-lg-none on the outer div', async () => {
    await createComponent();

    const outerDiv = fixture.nativeElement.querySelector('app-card-list')
      .firstElementChild as HTMLElement;
    expect(outerDiv.classList.contains('d-lg-none')).toBe(true);
  });
});
