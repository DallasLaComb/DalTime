import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterEmployeeModalComponent } from './register-employee-modal';
import type { RegisterEmployeeData } from './register-employee-modal';

describe('RegisterEmployeeModalComponent — email and phone validation', () => {
  let fixture: ComponentFixture<RegisterEmployeeModalComponent>;
  let registered: RegisterEmployeeData[];

  async function mount(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RegisterEmployeeModalComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterEmployeeModalComponent);
    registered = [];
    fixture.componentInstance.registered.subscribe((d) => registered.push(d));
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const q = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const type = (id: string, value: string): void => {
    const el = q(id) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const fillValid = (): void => {
    type('first-name-input', 'Jane');
    type('last-name-input', 'Smith');
    type('email-input', 'jane@acme.com');
    type('phone-input', '(555) 123-4567');
    // the temp password is a separate component; set the signal through its input
    const pw = fixture.nativeElement.querySelector('input[type="password"], input[id*="assword"]');
    if (pw) {
      (pw as HTMLInputElement).value = 'Temp@1234';
      pw.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
  };
  const submit = (): void => {
    (q('save-register-btn')!.querySelector('button') ?? q('save-register-btn')!).click();
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('uses the telephone keypad for the phone field', async () => {
    await mount();
    expect(q('phone-input')!.getAttribute('inputmode')).toBe('tel');
  });

  it('rejects a malformed email with "Enter a valid email address"', async () => {
    await mount();
    fillValid();
    type('email-input', 'not-an-email');
    submit();
    expect(q('email-error')!.textContent).toContain('Enter a valid email address');
    expect(registered).toHaveLength(0);
  });

  it('still says "Email is required" for an empty email', async () => {
    await mount();
    submit();
    expect(q('email-error')!.textContent).toContain('Email is required');
  });

  it('rejects a 7-digit phone with "Phone must be 10 digits"', async () => {
    await mount();
    fillValid();
    type('phone-input', '555-0199');
    submit();
    expect(q('phone-error')!.textContent).toContain('Phone must be 10 digits');
    expect(registered).toHaveLength(0);
  });

  it('accepts a formatted phone and sends the 10 digits only', async () => {
    await mount();
    fillValid();
    submit();
    expect(q('phone-error')).toBeNull();
    expect(registered).toHaveLength(1);
    expect(registered[0].phone).toBe('5551234567');
  });

  it('an empty phone is valid (optional)', async () => {
    await mount();
    fillValid();
    type('phone-input', '');
    submit();
    expect(registered).toHaveLength(1);
    expect(registered[0].phone).toBe('');
  });
});

describe('RegisterEmployeeModalComponent — email placeholder', () => {
  async function placeholder(label?: string): Promise<string> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RegisterEmployeeModalComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegisterEmployeeModalComponent);
    fixture.componentRef.setInput('open', true);
    if (label) fixture.componentRef.setInput('entityLabel', label);
    fixture.detectChanges();
    return (fixture.nativeElement.querySelector('[data-testid="email-input"]') as HTMLInputElement)
      .placeholder;
  }

  it('suggests employee@example.com when registering an employee', async () => {
    expect(await placeholder()).toBe('employee@example.com');
  });

  it('suggests manager@example.com when registering a manager', async () => {
    expect(await placeholder('Manager')).toBe('manager@example.com');
  });
});
