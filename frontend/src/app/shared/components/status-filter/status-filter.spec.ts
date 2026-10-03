import { TestBed } from '@angular/core/testing';
import { StatusFilterComponent } from './status-filter';
import type { StatusFilter } from '../../../core/utils/status-filter';

function mount(value: StatusFilter = 'all') {
  const fixture = TestBed.createComponent(StatusFilterComponent);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('counts', { all: 5, active: 2, disabled: 2, pending: 1 });
  fixture.componentRef.setInput('noun', 'employees');
  const emitted: StatusFilter[] = [];
  fixture.componentInstance.changed.subscribe((v) => emitted.push(v));
  fixture.detectChanges();
  const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  return { fixture, select, emitted };
}

describe('StatusFilterComponent', () => {
  it('shows a count on every option, e.g. "Disabled (2)"', () => {
    const { select } = mount();
    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'All (5)',
      'Active (2)',
      'Disabled (2)',
      'Pending (1)',
    ]);
  });

  it('reflects the current selection', () => {
    expect(mount('disabled').select.value).toBe('disabled');
  });

  it('emits the chosen filter', () => {
    const { select, emitted, fixture } = mount();
    select.value = 'pending';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(emitted).toEqual(['pending']);
  });

  it('is labelled and keyboard accessible (a real <select> with a <label for>)', () => {
    const { fixture, select } = mount();
    const label = fixture.nativeElement.querySelector(`label[for="${select.id}"]`);
    expect(label).toBeTruthy();
    expect(select.getAttribute('aria-label')).toBe('Filter employees by status');
    expect(select.className).toContain('focus:ring');
  });

  it('leaves room for the arrow so it never overlaps the count (e.g. "Disabled (0)")', () => {
    const { fixture, select } = mount('disabled');
    // the native arrow is replaced by a drawn chevron, and the text has right padding for it
    expect(select.className).toContain('appearance-none');
    expect(select.className).toContain('pr-10');
    const chevron = fixture.nativeElement.querySelector('[data-testid="status-filter-chevron"]');
    expect(chevron).toBeTruthy();
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
    expect(chevron.classList.contains('pointer-events-none')).toBe(true); // clicks reach the select
  });
});
