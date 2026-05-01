import { ComponentFixture, TestBed } from '@angular/core/testing';
import fc from 'fast-check';
import { StatusBadgeComponent } from './status-badge';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;

  const defaultColorMap: Record<string, string> = {
    CONFIRMED: 'bg-success',
    PENDING: 'bg-warning text-dark',
    DISABLED: 'bg-danger',
  };

  async function createComponent(
    status: string,
    label: string,
    colorMap: Record<string, string> = defaultColorMap,
  ) {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('colorMap', colorMap);
    fixture.detectChanges();
  }

  // ─── Label rendering ───────────────────────────────────────────────────────

  it('renders the label text', async () => {
    await createComponent('CONFIRMED', 'Active');

    const badge = query<HTMLElement>(fixture, '[data-testid="status-badge"]');
    expect(badge.textContent?.trim()).toBe('Active');
  });

  // ─── Mapped color class ────────────────────────────────────────────────────

  it('applies the mapped color class for a known status', async () => {
    await createComponent('CONFIRMED', 'Active');

    const badge = query<HTMLElement>(fixture, '[data-testid="status-badge"]');
    expect(badge.classList.contains('bg-success')).toBe(true);
    expect(badge.classList.contains('badge')).toBe(true);
  });

  it('applies a multi-class color mapping', async () => {
    await createComponent('PENDING', 'Pending');

    const badge = query<HTMLElement>(fixture, '[data-testid="status-badge"]');
    expect(badge.classList.contains('bg-warning')).toBe(true);
    expect(badge.classList.contains('text-dark')).toBe(true);
  });

  // ─── Fallback for unknown status ───────────────────────────────────────────

  it('falls back to bg-secondary for an unknown status', async () => {
    await createComponent('UNKNOWN_STATUS', 'Unknown');

    const badge = query<HTMLElement>(fixture, '[data-testid="status-badge"]');
    expect(badge.classList.contains('bg-secondary')).toBe(true);
  });

  // ─── Test ID ───────────────────────────────────────────────────────────────

  it('has data-testid="status-badge"', async () => {
    await createComponent('CONFIRMED', 'Active');

    const badge = query<HTMLElement>(fixture, '[data-testid="status-badge"]');
    expect(badge).toBeTruthy();
  });

  // ─── Property-based test ──────────────────────────────────────────────────

  /**
   * Feature: reusable-components, Property 1: Status badge color resolution
   * Validates: Requirements 8.2, 8.3
   */
  it('Property 1: resolves badgeClass to colorMap[status] or bg-secondary for any status and colorMap', async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    const validBadgeClasses = [
      'bg-success',
      'bg-warning',
      'bg-danger',
      'bg-primary',
      'bg-info',
      'bg-secondary',
    ] as const;

    fc.assert(
      fc.property(
        fc.string(),
        fc.dictionary(fc.string(), fc.constantFrom(...validBadgeClasses)),
        (status, colorMapRaw) => {
          // Use a null-prototype object to avoid Object.prototype pollution
          // (e.g. "valueOf", "toString" resolving to inherited functions)
          const colorMap: Record<string, string> = Object.create(null);
          for (const [k, v] of Object.entries(colorMapRaw)) {
            colorMap[k] = v;
          }

          const componentFixture = TestBed.createComponent(StatusBadgeComponent);
          componentFixture.componentRef.setInput('status', status);
          componentFixture.componentRef.setInput('label', 'test');
          componentFixture.componentRef.setInput('colorMap', colorMap);
          componentFixture.detectChanges();

          const expected = `dt-debug badge rounded-pill ${colorMap[status] ?? 'bg-secondary'}`;
          const actual = componentFixture.componentInstance.badgeClass();

          return actual === expected;
        },
      ),
    );
  });
});
