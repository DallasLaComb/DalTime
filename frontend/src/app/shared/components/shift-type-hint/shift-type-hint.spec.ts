import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShiftTypeHintComponent } from './shift-type-hint';

describe('ShiftTypeHintComponent', () => {
  let fixture: ComponentFixture<ShiftTypeHintComponent>;

  async function mount(startTime: string): Promise<void> {
    await TestBed.configureTestingModule({ imports: [ShiftTypeHintComponent] }).compileComponents();
    fixture = TestBed.createComponent(ShiftTypeHintComponent);
    fixture.componentRef.setInput('startTime', startTime);
    fixture.detectChanges();
  }
  const text = (id: string): string =>
    fixture.nativeElement
      .querySelector(`[data-testid="${id}"]`)
      .textContent.replace(/\s+/g, ' ')
      .trim();

  beforeEach(() => TestBed.resetTestingModule());

  it.each([
    ['09:00', 'morning'],
    ['12:00', 'afternoon'],
    ['17:00', 'night'],
    ['00:30', 'night'],
  ])('shows %s as %s', async (start, expected) => {
    await mount(start);
    expect(text('shift-type-derived')).toBe(expected);
  });

  it('spells out all three bands', async () => {
    await mount('09:00');
    const rules = text('shift-type-rules');
    expect(rules).toContain('Morning: starts 1:00 AM – 11:59 AM');
    expect(rules).toContain('Afternoon: starts 12:00 PM – 4:59 PM');
    expect(rules).toContain('Night: starts 5:00 PM – 12:59 AM');
  });

  it('emphasises the band that applies', async () => {
    await mount('13:00');
    const items = Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];
    expect(items.map((li) => li.classList.contains('font-semibold'))).toEqual([false, true, false]);
  });

  it('asks for a start time until one is entered', async () => {
    await mount('');
    expect(text('shift-type-derived')).toBe('set a start time');
  });
});
