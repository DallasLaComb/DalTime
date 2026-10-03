import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { ViewModeService } from './view-mode.service';
import { AuthService } from '../auth/auth';
import { ImpersonationService } from './impersonation.service';
import type { UserRole } from '../auth/user-role.model';

describe('ViewModeService', () => {
  const role = signal<UserRole | null>('OrgAdmin');
  const viewingAs = signal<{ role: UserRole } | null>(null);
  let router: Router;

  function create(): ViewModeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roleSignal: role } },
        { provide: ImpersonationService, useValue: { viewingAs } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.inject(ViewModeService);
  }

  beforeEach(() => {
    sessionStorage.clear();
    role.set('OrgAdmin');
    viewingAs.set(null);
  });

  it('starts in Org Admin view', () => {
    const svc = create();
    expect(svc.canSwitch()).toBe(true);
    expect(svc.managerMode()).toBe(false);
    expect(svc.effectiveRole()).toBe('OrgAdmin');
  });

  it('switches to Manager view, acts as a Manager, and lands on the manager home', () => {
    const svc = create();
    svc.switchTo('manager');
    expect(svc.managerMode()).toBe(true);
    expect(svc.effectiveRole()).toBe('Manager');
    expect(router.navigate).toHaveBeenCalledWith(['/manager']);
  });

  it('switches back to Org Admin view and lands on the org-admin home', () => {
    const svc = create();
    svc.switchTo('manager');
    svc.switchTo('orgadmin');
    expect(svc.managerMode()).toBe(false);
    expect(svc.effectiveRole()).toBe('OrgAdmin');
    expect(router.navigate).toHaveBeenLastCalledWith(['/org-admin']);
  });

  it('remembers the view for the tab', () => {
    create().switchTo('manager');
    expect(create().managerMode()).toBe(true);
  });

  it.each<UserRole>(['Manager', 'Employee', 'WebAdmin'])('is not available to a %s', (r) => {
    role.set(r);
    const svc = create();
    svc.switchTo('manager');
    expect(svc.canSwitch()).toBe(false);
    expect(svc.managerMode()).toBe(false);
    expect(svc.effectiveRole()).toBe(r);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('is not available while a WebAdmin is impersonating an OrgAdmin', () => {
    viewingAs.set({ role: 'OrgAdmin' });
    const svc = create();
    svc.switchTo('manager');
    expect(svc.managerMode()).toBe(false);
  });

  it('never carries Manager view over to whoever signs in next', () => {
    const svc = create();
    svc.switchTo('manager');
    role.set(null); // sign-out
    TestBed.flushEffects();
    role.set('OrgAdmin'); // a new sign-in in the same tab
    expect(svc.managerMode()).toBe(false);
  });
});
