import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditEmployeeModalComponent } from './edit-employee-modal';
import type { EditEmployeeData, EditEmployeeInitial } from './edit-employee-modal';

const MANAGERS = [
  { manager_id: 'mgr-1', first_name: 'Manager', last_name: 'FN1' },
  { manager_id: 'mgr-2', first_name: 'Manager', last_name: 'FN2' },
];

const EMPLOYEE: EditEmployeeInitial = {
  email: 'e@x.com',
  first_name: 'Employee',
  last_name: 'FN2',
  phone: '5551234567',
  manager_id: 'mgr-1',
};

describe('EditEmployeeModalComponent — manager select', () => {
  let fixture: ComponentFixture<EditEmployeeModalComponent>;
  let saved: EditEmployeeData[];

  async function mount(initial: EditEmployeeInitial, managers = MANAGERS): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EditEmployeeModalComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EditEmployeeModalComponent);
    saved = [];
    fixture.componentInstance.saved.subscribe((d) => saved.push(d));
    fixture.componentRef.setInput('managers', managers);
    fixture.componentRef.setInput('initial', initial);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const select = (): HTMLSelectElement =>
    fixture.nativeElement.querySelector('[data-testid="edit-manager-select"]');
  const saveBtn = (): HTMLElement =>
    fixture.nativeElement.querySelector(
      '[data-testid="save-edit-btn"] button, button[data-testid="save-edit-btn"]',
    );

  it('pre-selects the employee’s current manager, not "No manager"', async () => {
    await mount(EMPLOYEE);
    expect(select().value).toBe('mgr-1');
    expect(select().selectedOptions[0].textContent).toContain('FN1');
  });

  it('keeps the current manager when saved without touching the select', async () => {
    await mount(EMPLOYEE);
    saveBtn().click();
    expect(saved).toHaveLength(1);
    expect(saved[0].manager_id).toBe('mgr-1');
  });

  it('shows "No manager" only for an employee who has none', async () => {
    await mount({ ...EMPLOYEE, manager_id: undefined });
    expect(select().value).toBe('');
  });

  it('keeps an inactive (unlisted) current manager visible and preserved', async () => {
    await mount({ ...EMPLOYEE, manager_id: 'mgr-disabled' });
    expect(select().value).toBe('mgr-disabled');
    expect(select().selectedOptions[0].textContent).toContain('inactive');
    saveBtn().click();
    expect(saved[0].manager_id).toBe('mgr-disabled');
  });

  it('lets the admin deliberately change or clear the manager', async () => {
    await mount(EMPLOYEE);
    select().value = 'mgr-2';
    select().dispatchEvent(new Event('change'));
    saveBtn().click();
    expect(saved[0].manager_id).toBe('mgr-2');

    select().value = '';
    select().dispatchEvent(new Event('change'));
    saveBtn().click();
    expect(saved[1].manager_id).toBe('');
  });

  it('does not send a manager when the page offers no manager list (manager role)', async () => {
    await mount(EMPLOYEE, []);
    expect(select()).toBeNull();
    saveBtn().click();
    expect(saved[0].manager_id).toBeUndefined();
  });
});

describe('EditEmployeeModalComponent — phone', () => {
  let fixture: ComponentFixture<EditEmployeeModalComponent>;
  let saved: EditEmployeeData[];

  async function mount(phone: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EditEmployeeModalComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EditEmployeeModalComponent);
    saved = [];
    fixture.componentInstance.saved.subscribe((d) => saved.push(d));
    fixture.componentRef.setInput('managers', MANAGERS);
    fixture.componentRef.setInput('initial', { ...EMPLOYEE, phone });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const q = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const type = (value: string): void => {
    const el = q('edit-phone-input') as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const save = (): void => {
    (q('save-edit-btn')!.querySelector('button') ?? q('save-edit-btn')!).click();
    fixture.detectChanges();
  };

  it('uses the telephone keypad', async () => {
    await mount('');
    expect(q('edit-phone-input')!.getAttribute('inputmode')).toBe('tel');
  });

  it('accepts "(555) 123-4567" and saves the 10 digits only', async () => {
    await mount('');
    type('(555) 123-4567');
    save();
    expect(saved[0].phone).toBe('5551234567');
    expect(q('phone-error')).toBeNull();
  });

  it('rejects a 7-digit phone with "Phone must be 10 digits" and saves nothing', async () => {
    await mount('');
    type('555-0199');
    save();
    expect(saved).toHaveLength(0);
    expect(q('phone-error')!.textContent).toContain('Phone must be 10 digits');
  });

  it('an empty phone stays valid (optional) and clears the stored one', async () => {
    await mount('5551234567');
    type('');
    save();
    expect(saved[0].phone).toBe('');
  });

  it('a legacy stored "555-0199" opens as-is and must be corrected before saving', async () => {
    await mount('555-0199');
    expect((q('edit-phone-input') as HTMLInputElement).value).toBe('555-0199');
    save();
    expect(saved).toHaveLength(0);
    expect(q('phone-error')).toBeTruthy();

    type('555-123-4567');
    save();
    expect(saved[0].phone).toBe('5551234567');
  });
});
