import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleFiltersComponent } from './schedule-filters';
import type { ShiftStatusFilter } from '../../../core/utils/schedule.utils';

/**
 * Unit tests for the status chip behaviour added in story #333.
 * These tests verify that the component correctly emits the right Set
 * of active chip keys for each user interaction pattern.
 */
describe('ScheduleFiltersComponent — status chips', () => {
  let component: ScheduleFiltersComponent;
  let fixture: ComponentFixture<ScheduleFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show "All" chip as active when activeStatusChips is empty', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>());
    fixture.detectChanges();
    const allBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    expect(allBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('should emit an empty Set when the "All" chip is clicked', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['filled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const allBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    allBtn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].size).toBe(0);
  });

  it('should emit a Set containing "filled" when the Filled chip is clicked', () => {
    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const filledBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-filled"]');
    filledBtn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].has('filled')).toBe(true);
    expect(emitted[0].size).toBe(1);
  });

  it('should emit a Set containing "unfilled" when the Unfilled chip is clicked', () => {
    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const unfilledBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-unfilled"]');
    unfilledBtn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].has('unfilled')).toBe(true);
    expect(emitted[0].size).toBe(1);
  });

  it('replaces the previous selection instead of adding to it (only one status at a time)', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['filled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const unfilledBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-unfilled"]');
    unfilledBtn.click();

    expect(emitted.length).toBe(1);
    expect([...emitted[0]]).toEqual(['unfilled']); // "filled" is deselected
  });

  it('moves the selection from Unfilled to Filled the same way', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['unfilled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    fixture.nativeElement.querySelector('[data-testid="status-chip-filled"]').click();

    expect([...emitted[0]]).toEqual(['filled']);
  });

  it('keeps a chip selected when it is clicked again — "All" is how you clear the filter', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['filled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    fixture.nativeElement.querySelector('[data-testid="status-chip-filled"]').click();

    expect([...emitted[0]]).toEqual(['filled']);
  });

  it('clicking "All" deselects whichever status was selected', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['unfilled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    fixture.nativeElement.querySelector('[data-testid="status-chip-all"]').click();

    expect(emitted[0].size).toBe(0);
  });

  it('should show "All" chip as inactive when any status chip is active', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['filled']));
    fixture.detectChanges();

    const allBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    expect(allBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── ARIA pressed state ─────────────────────────────────────────────────────

  it('active chip has aria-pressed="true", inactive chip has aria-pressed="false"', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['unfilled']));
    fixture.detectChanges();

    const filledBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-filled"]');
    const unfilledBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-unfilled"]');

    expect(filledBtn.getAttribute('aria-pressed')).toBe('false');
    expect(unfilledBtn.getAttribute('aria-pressed')).toBe('true');
    const allBtn = fixture.nativeElement.querySelector('[data-testid="status-chip-all"]');
    expect(allBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('all named chips show aria-pressed="false" on initial render (All is default)', () => {
    const chips: ShiftStatusFilter[] = ['filled', 'unfilled'];
    for (const key of chips) {
      const btn = fixture.nativeElement.querySelector(`[data-testid="status-chip-${key}"]`);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  it('Enter key on Filled chip emits the same Set as a click', () => {
    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const filledBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-filled"]',
    ) as HTMLButtonElement;
    filledBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].has('filled')).toBe(true);
  });

  it('Space key on Unfilled chip emits the correct Set', () => {
    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const unfilledBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-unfilled"]',
    ) as HTMLButtonElement;
    unfilledBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].has('unfilled')).toBe(true);
  });

  it('Enter key on the "All" chip emits an empty Set when chips were active', () => {
    fixture.componentRef.setInput(
      'activeStatusChips',
      new Set<ShiftStatusFilter>(['unfilled', 'filled']),
    );
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const allBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-all"]',
    ) as HTMLButtonElement;
    allBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].size).toBe(0);
  });

  it('Space key on the "All" chip emits an empty Set', () => {
    fixture.componentRef.setInput('activeStatusChips', new Set<ShiftStatusFilter>(['filled']));
    fixture.detectChanges();

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const allBtn = fixture.nativeElement.querySelector(
      '[data-testid="status-chip-all"]',
    ) as HTMLButtonElement;
    allBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].size).toBe(0);
  });

  // ── Keyboard reachability (tab order) ─────────────────────────────────────

  it('all chip buttons are native <button> elements (tab-reachable by default)', () => {
    const allBtns = fixture.nativeElement.querySelectorAll(
      'button[data-testid^="status-chip-"]',
    ) as NodeListOf<HTMLButtonElement>;
    // There should be 3 buttons: All + Filled + Unfilled
    expect(allBtns.length).toBe(3);
    for (const btn of allBtns) {
      expect(btn.tabIndex).not.toBe(-1);
    }
  });

  // ── Randomised chip sequence ───────────────────────────────────────────────

  it('randomly selected chip emits the correct key when clicked', () => {
    const CHIP_KEYS: ShiftStatusFilter[] = ['filled', 'unfilled'];
    const seed = Math.floor(Date.now() / 30000);
    const key = CHIP_KEYS[seed % CHIP_KEYS.length];

    const emitted: Set<ShiftStatusFilter>[] = [];
    component.statusChipsChange.subscribe((v) => emitted.push(v));

    const btn = fixture.nativeElement.querySelector(`[data-testid="status-chip-${key}"]`);
    if (!btn) throw new Error(`chip button not found for key="${key}" seed=${seed}`);
    btn.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].has(key)).toBe(true);
    expect(emitted[0].size).toBe(1);
  });
});
