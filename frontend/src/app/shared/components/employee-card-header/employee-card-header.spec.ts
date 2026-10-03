import { TestBed } from '@angular/core/testing';
import { EmployeeCardHeaderComponent, type EmployeeCardHeaderData } from './employee-card-header';

const EMPLOYEE: EmployeeCardHeaderData = {
  first_name: 'Employee',
  last_name: 'FN2',
  email: 'employee2@gmail.com',
  phone: '5559876543',
  status: 'CONFIRMED',
  created_at: '2026-05-13T00:00:00.000Z',
};

function render(over: Partial<EmployeeCardHeaderData> = {}) {
  const fixture = TestBed.createComponent(EmployeeCardHeaderComponent);
  fixture.componentRef.setInput('employee', { ...EMPLOYEE, ...over });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    phone: el.querySelector('[data-testid="employee-phone"]'),
    text: (el.querySelector('[data-testid="employee-phone"]')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

describe('EmployeeCardHeaderComponent — phone', () => {
  it('formats a stored 10-digit number: (555) 987-6543, not raw digits', () => {
    const { text } = render();
    expect(text).toBe('(555) 987-6543');
    expect(text).not.toContain('5559876543');
  });

  it('formats a number that was stored with punctuation too', () => {
    expect(render({ phone: '555-987-6543' }).text).toBe('(555) 987-6543');
  });

  it('shows a legacy number as-is, flagged "Needs update"', () => {
    const { text } = render({ phone: '555-0199' });
    expect(text).toContain('555-0199');
    expect(text).toContain('Needs update');
  });

  it('shows no phone line when there is no phone', () => {
    expect(render({ phone: '' }).phone).toBeNull();
  });
});
