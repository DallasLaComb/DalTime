import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { OrganizationService } from '../../../services/organization.service';
import { BroadcastsService } from '../../../shared/broadcasts/broadcasts.service';
import { WebAdminBroadcastsComponent } from './broadcasts';
import { WebAdminBroadcastsService, type Broadcast } from './broadcasts.service';

const ORGS = [
  { org_id: 'o2', name: 'Zeta YMCA' },
  { org_id: 'o1', name: 'Alpha YMCA' },
];

function makeBroadcast(overrides: Partial<Broadcast> = {}): Broadcast {
  return {
    broadcast_id: '3f1c2b9e-8d7a-4c6b-9e5f-1a2b3c4d5e6f',
    message: 'Maintenance tonight',
    severity: 'WARNING',
    target_scope: 'ALL',
    created_at: '2026-09-29T00:00:00.000Z',
    created_by_web_admin_id: 'WADMIN#1',
    ...overrides,
  };
}

describe('WebAdminBroadcastsComponent', () => {
  let fixture: ComponentFixture<WebAdminBroadcastsComponent>;
  let component: WebAdminBroadcastsComponent;
  let el: HTMLElement;
  const api = { create: vi.fn(), listActive: vi.fn(), remove: vi.fn() };
  const banner = { refreshCurrent: vi.fn() };

  function q<T extends HTMLElement>(testId: string): T | null {
    return el.querySelector<T>(`[data-testid="${testId}"]`);
  }

  function sendButton(): HTMLButtonElement {
    return q<HTMLButtonElement>('broadcast-send') as HTMLButtonElement;
  }

  function type(testId: string, value: string, event = 'input'): void {
    const input = q<HTMLInputElement>(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event(event));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.listActive.mockReturnValue(of([]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WebAdminBroadcastsComponent],
      providers: [
        { provide: WebAdminBroadcastsService, useValue: api },
        { provide: OrganizationService, useValue: { getAll: () => of(ORGS) } },
        { provide: BroadcastsService, useValue: banner },
      ],
    });
    fixture = TestBed.createComponent(WebAdminBroadcastsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('disables send until a message is entered, and counts characters', () => {
    expect(sendButton().disabled).toBe(true);
    type('broadcast-message', 'DalTime is aware of an issue with setting availability.');
    expect(sendButton().disabled).toBe(false);
    expect(q('broadcast-message-count')?.textContent).toContain('55 / 500');
  });

  it('shows the org picker (sorted) for org targets and the role picker only for org+role', () => {
    expect(q('broadcast-org')).toBeNull();
    (q<HTMLInputElement>('broadcast-target-ORG') as HTMLInputElement).click();
    fixture.detectChanges();
    const options = [...(q<HTMLSelectElement>('broadcast-org') as HTMLSelectElement).options].map(
      (o) => o.text,
    );
    expect(options.slice(1)).toEqual(['Alpha YMCA', 'Zeta YMCA']);
    expect(q('broadcast-role')).toBeNull();

    (q<HTMLInputElement>('broadcast-target-ORG_ROLE') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(q('broadcast-role')).not.toBeNull();
  });

  it('requires an org before sending to one', () => {
    type('broadcast-message', 'hello');
    (q<HTMLInputElement>('broadcast-target-ORG') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(sendButton().disabled).toBe(true);
    type('broadcast-org', 'o1', 'change');
    expect(sendButton().disabled).toBe(false);
  });

  it('rejects an expiry in the past', () => {
    type('broadcast-message', 'hello');
    type('broadcast-expiry', '2000-01-01T09:00');
    expect(q('broadcast-expiry-error')?.textContent).toContain('future');
    expect(sendButton().disabled).toBe(true);
  });

  it('builds the body for each target', () => {
    component.message.set('  Maintenance  ');
    expect(component.buildBody()).toEqual({
      message: 'Maintenance',
      severity: 'INFO',
      target_scope: 'ALL',
    });

    component.target.set('ORG_ROLE');
    component.orgId.set('o1');
    component.role.set('Manager');
    component.severity.set('CRITICAL');
    component.expiresAtLocal.set('2099-10-05T22:00');
    expect(component.buildBody()).toEqual({
      message: 'Maintenance',
      severity: 'CRITICAL',
      target_scope: 'ORG_ROLE',
      org_id: 'o1',
      role: 'Manager',
      expires_at: new Date('2099-10-05T22:00').toISOString(),
    });
  });

  it('sends, adds to the active list, resets the form and refreshes the banner', () => {
    const created = makeBroadcast();
    api.create.mockReturnValue(of(created));
    type('broadcast-message', 'Maintenance tonight');
    sendButton().click();
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith({
      message: 'Maintenance tonight',
      severity: 'INFO',
      target_scope: 'ALL',
    });
    expect(q('broadcast-sent')?.textContent).toContain('all users');
    expect(q(`broadcast-active-${created.broadcast_id}`)).not.toBeNull();
    expect(component.message()).toBe('');
    expect(banner.refreshCurrent).toHaveBeenCalled();
  });

  it('shows the backend error message on failure', () => {
    api.create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 404, error: { error: "Organization 'x' not found" } }),
      ),
    );
    type('broadcast-message', 'hello');
    sendButton().click();
    fixture.detectChanges();
    expect(q('broadcast-send-error')?.textContent).toContain("Organization 'x' not found");
  });

  it('describes the audience of active broadcasts', () => {
    fixture.detectChanges();
    expect(component.audience(makeBroadcast())).toBe('All users');
    expect(component.audience(makeBroadcast({ target_scope: 'ORG', target_org_id: 'o1' }))).toBe(
      'Alpha YMCA',
    );
    expect(
      component.audience(
        makeBroadcast({ target_scope: 'ORG_ROLE', target_org_id: 'o2', target_role: 'Employee' }),
      ),
    ).toBe('Employees in Zeta YMCA');
  });

  it('takes a broadcast down after confirmation', () => {
    const b = makeBroadcast();
    api.listActive.mockReturnValue(of([b]));
    api.remove.mockReturnValue(of(undefined));
    component.loadActive();
    fixture.detectChanges();

    (q<HTMLButtonElement>(`broadcast-remove-${b.broadcast_id}`) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.pendingRemoval()).toBe(b);

    component.confirmRemove();
    fixture.detectChanges();

    expect(api.remove).toHaveBeenCalledWith(b.broadcast_id);
    expect(q(`broadcast-active-${b.broadcast_id}`)).toBeNull();
    expect(banner.refreshCurrent).toHaveBeenCalled();
  });
});
