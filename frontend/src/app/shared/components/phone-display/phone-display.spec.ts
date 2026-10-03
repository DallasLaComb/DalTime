import { TestBed } from '@angular/core/testing';
import { PhoneDisplayComponent } from './phone-display';

function render(phone: string | null | undefined) {
  const fixture = TestBed.createComponent(PhoneDisplayComponent);
  fixture.componentRef.setInput('phone', phone);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    text: el.textContent!.replace(/\s+/g, ' ').trim(),
    flag: el.querySelector('[data-testid="phone-invalid-flag"]'),
  };
}

describe('PhoneDisplayComponent', () => {
  it('formats a stored 10-digit number', () => {
    const { text, flag } = render('5551234567');
    expect(text).toBe('(555) 123-4567');
    expect(flag).toBeNull();
  });

  it('shows a legacy number as-is, flagged, without throwing', () => {
    const { text, flag } = render('555-0199');
    expect(text).toContain('555-0199');
    expect(flag).toBeTruthy();
    expect(flag!.textContent).toContain('Needs update');
  });

  it('shows a dash when there is no phone', () => {
    expect(render('').text).toBe('—');
    expect(render(undefined).text).toBe('—');
  });
});
