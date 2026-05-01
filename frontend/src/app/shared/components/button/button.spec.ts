import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();
  }

  it('renders with default primary variant', async () => {
    await createComponent();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('btn-primary')).toBe(true);
  });

  it('applies the correct variant class', async () => {
    await createComponent();
    fixture.componentRef.setInput('variant', 'danger');
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.classList.contains('btn-danger')).toBe(true);
  });

  it('applies size class for sm', async () => {
    await createComponent();
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.classList.contains('btn-sm')).toBe(true);
  });

  it('applies w-100 when fullWidth is true', async () => {
    await createComponent();
    fixture.componentRef.setInput('fullWidth', true);
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.classList.contains('w-100')).toBe(true);
  });

  it('is disabled when disabled input is true', async () => {
    await createComponent();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.disabled).toBe(true);
  });

  it('is disabled when loading is true', async () => {
    await createComponent();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.disabled).toBe(true);
  });

  it('shows spinner when loading', async () => {
    await createComponent();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const spinner = query<HTMLElement>(fixture, '.spinner-border');
    expect(spinner).toBeTruthy();
  });

  it('hides spinner when not loading', async () => {
    await createComponent();

    const spinner = query<HTMLElement>(fixture, '.spinner-border');
    expect(spinner).toBeNull();
  });

  it('sets data-testid attribute', async () => {
    await createComponent();
    fixture.componentRef.setInput('testId', 'save-btn');
    fixture.detectChanges();

    const btn = query<HTMLButtonElement>(fixture, '[data-testid="save-btn"]');
    expect(btn).toBeTruthy();
  });

  it('emits clicked on click', async () => {
    await createComponent();

    let emitted = false;
    fixture.componentInstance.clicked.subscribe(() => (emitted = true));

    query<HTMLButtonElement>(fixture, 'button').click();
    expect(emitted).toBe(true);
  });

  it('has dt-debug class', async () => {
    await createComponent();

    const btn = query<HTMLButtonElement>(fixture, 'button');
    expect(btn.classList.contains('dt-debug')).toBe(true);
  });
});
