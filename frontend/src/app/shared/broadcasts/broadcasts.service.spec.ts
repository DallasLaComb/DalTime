import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import type { UserRole } from '../../core/auth/user-role.model';
import {
  ImpersonationService,
  type ImpersonateContext,
} from '../../core/services/impersonation.service';
import { LoggerService } from '../../core/logging/logger.service';
import { environment } from '../../../environments/environment';
import { BroadcastsService, type ActiveBroadcast } from './broadcasts.service';

const BASE = environment.api.baseUrl;

function makeBroadcast(overrides: Partial<ActiveBroadcast> = {}): ActiveBroadcast {
  return {
    broadcast_id: '3f1c2b9e-8d7a-4c6b-9e5f-1a2b3c4d5e6f',
    message: 'Maintenance tonight 9pm-10pm',
    severity: 'WARNING',
    created_at: '2026-09-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('BroadcastsService', () => {
  let http: HttpTestingController;
  let authenticated: WritableSignal<boolean>;
  let role: WritableSignal<UserRole | null>;
  let viewingAs: WritableSignal<ImpersonateContext | null>;
  const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

  function setup(): BroadcastsService {
    const service = TestBed.inject(BroadcastsService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => {
    authenticated = signal(true);
    role = signal<UserRole | null>('Employee');
    viewingAs = signal<ImpersonateContext | null>(null);
    logger.warn.mockReset();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticatedSignal: authenticated, roleSignal: role },
        },
        { provide: ImpersonationService, useValue: { viewingAs } },
        { provide: LoggerService, useValue: logger },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([
    ['Employee', '/employee/broadcasts/active'],
    ['Manager', '/manager/broadcasts/active'],
    ['OrgAdmin', '/org-admin/broadcasts/active'],
    ['WebAdmin', '/web-admin/broadcasts/active'],
  ] as const)('loads %s broadcasts from %s', (r, path) => {
    role.set(r);
    const service = setup();
    http.expectOne(`${BASE}${path}`).flush([makeBroadcast()]);
    expect(service.current()?.message).toBe('Maintenance tonight 9pm-10pm');
  });

  it('makes no request when signed out', () => {
    authenticated.set(false);
    const service = setup();
    http.expectNone(() => true);
    expect(service.current()).toBeNull();
  });

  it('loads the impersonated role and disables dismiss while impersonating', () => {
    role.set('WebAdmin');
    viewingAs.set({ userId: 'u1', role: 'Manager', displayName: 'Pat' } as ImpersonateContext);
    const service = setup();
    http.expectOne(`${BASE}/manager/broadcasts/active`).flush([]);
    expect(service.canDismiss()).toBe(false);
  });

  it('dismiss hides the banner immediately and shows the next one', () => {
    const service = setup();
    http
      .expectOne(`${BASE}/employee/broadcasts/active`)
      .flush([
        makeBroadcast({ broadcast_id: 'a' }),
        makeBroadcast({ broadcast_id: 'b', message: 'Next' }),
      ]);

    service.dismiss('a');

    expect(service.current()?.broadcast_id).toBe('b');
    const req = http.expectOne(`${BASE}/employee/broadcasts/a/dismissal`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true });
    expect(service.current()?.message).toBe('Next');
  });

  it('restores the banner when the dismissal fails', () => {
    const service = setup();
    http
      .expectOne(`${BASE}/employee/broadcasts/active`)
      .flush([makeBroadcast({ broadcast_id: 'a' })]);

    service.dismiss('a');
    expect(service.current()).toBeNull();
    http
      .expectOne(`${BASE}/employee/broadcasts/a/dismissal`)
      .flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });

    expect(service.current()?.broadcast_id).toBe('a');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not dismiss while impersonating', () => {
    viewingAs.set({ userId: 'u1', role: 'Employee', displayName: 'Pat' } as ImpersonateContext);
    const service = setup();
    http
      .expectOne(`${BASE}/employee/broadcasts/active`)
      .flush([makeBroadcast({ broadcast_id: 'a' })]);

    service.dismiss('a');

    http.expectNone(`${BASE}/employee/broadcasts/a/dismissal`);
    expect(service.current()?.broadcast_id).toBe('a');
  });

  it('keeps the banner empty and logs when loading fails', () => {
    const service = setup();
    http
      .expectOne(`${BASE}/employee/broadcasts/active`)
      .flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });
    expect(service.current()).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});
