import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BroadcastBannerComponent, type BroadcastBannerData } from './broadcast-banner';

describe('BroadcastBannerComponent', () => {
  let fixture: ComponentFixture<BroadcastBannerComponent>;

  function render(broadcast: BroadcastBannerData, canDismiss = true): HTMLElement {
    fixture = TestBed.createComponent(BroadcastBannerComponent);
    fixture.componentRef.setInput('broadcast', broadcast);
    fixture.componentRef.setInput('canDismiss', canDismiss);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [BroadcastBannerComponent] });
  });

  it('renders the message as text on a dt-debug root', () => {
    const el = render({ message: 'Maintenance tonight <b>9pm</b>', severity: 'INFO' });
    const root = el.querySelector('[data-testid="broadcast-banner"]') as HTMLElement;
    expect(root.classList).toContain('dt-debug');
    const message = el.querySelector('[data-testid="broadcast-banner-message"]') as HTMLElement;
    expect(message.textContent?.trim()).toBe('Maintenance tonight <b>9pm</b>');
    expect(message.querySelector('b')).toBeNull();
  });

  it.each([
    ['INFO', 'bg-sky-50', 'status'],
    ['WARNING', 'bg-amber-50', 'status'],
    ['CRITICAL', 'bg-red-50', 'alert'],
  ] as const)('styles %s and uses role=%s', (severity, cls, role) => {
    const el = render({ message: 'm', severity });
    const root = el.querySelector('[data-testid="broadcast-banner"]') as HTMLElement;
    expect(root.className).toContain(cls);
    expect(root.getAttribute('role')).toBe(role);
  });

  it('emits dismissed when the dismiss button is clicked', () => {
    const el = render({ message: 'm', severity: 'INFO' });
    const spy = vi.fn();
    fixture.componentInstance.dismissed.subscribe(spy);
    (el.querySelector('[data-testid="broadcast-banner-dismiss"]') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hides the dismiss button when canDismiss is false', () => {
    const el = render({ message: 'm', severity: 'INFO' }, false);
    expect(el.querySelector('[data-testid="broadcast-banner-dismiss"]')).toBeNull();
  });
});
