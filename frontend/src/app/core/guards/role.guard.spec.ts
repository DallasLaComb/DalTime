import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, UrlTree, provideRouter, type Route } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../auth/auth';
import { ImpersonationService } from '../services/impersonation.service';
import { ViewModeService } from '../services/view-mode.service';
import type { UserRole } from '../auth/user-role.model';

describe('roleGuard', () => {
  const role = signal<UserRole | null>('OrgAdmin');
  const viewingAs = signal<{ role: UserRole } | null>(null);
  const canSwitch = signal(true);
  const managerMode = signal(false);

  const route = (...roles: UserRole[]): Route => ({ data: { roles } });
  const run = (r: Route) =>
    TestBed.runInInjectionContext(() => roleGuard(r, [])) as boolean | UrlTree;
  const target = (result: boolean | UrlTree): string | true =>
    result === true ? true : TestBed.inject(Router).serializeUrl(result as UrlTree);

  beforeEach(() => {
    role.set('OrgAdmin');
    viewingAs.set(null);
    canSwitch.set(true);
    managerMode.set(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roleSignal: role } },
        { provide: ImpersonationService, useValue: { viewingAs } },
        { provide: ViewModeService, useValue: { canSwitch, managerMode } },
      ],
    });
  });

  describe('an OrgAdmin', () => {
    it('gets org-admin pages in Org Admin view', () => {
      expect(target(run(route('OrgAdmin')))).toBe(true);
    });

    it('is sent home from a manager page while in Org Admin view', () => {
      expect(target(run(route('Manager')))).toBe('/org-admin');
    });

    it('gets manager pages in Manager view', () => {
      managerMode.set(true);
      expect(target(run(route('Manager')))).toBe(true);
    });

    it('is sent to the manager home from an org-admin page while in Manager view', () => {
      managerMode.set(true);
      expect(target(run(route('OrgAdmin')))).toBe('/manager');
    });

    it('never gets employee or web-admin pages', () => {
      expect(target(run(route('Employee')))).toBe('/unauthorized');
      managerMode.set(true);
      expect(target(run(route('WebAdmin')))).toBe('/unauthorized');
    });
  });

  it('keeps a real Manager out of org-admin pages and lets them into manager pages', () => {
    role.set('Manager');
    canSwitch.set(false);
    expect(target(run(route('Manager')))).toBe(true);
    expect(target(run(route('OrgAdmin')))).toBe('/unauthorized');
  });

  it('keeps an Employee out of manager pages', () => {
    role.set('Employee');
    canSwitch.set(false);
    expect(target(run(route('Manager')))).toBe('/unauthorized');
  });

  it('still lets a WebAdmin into the role they are impersonating', () => {
    role.set('WebAdmin');
    canSwitch.set(false);
    viewingAs.set({ role: 'Manager' });
    expect(target(run(route('Manager')))).toBe(true);
    expect(target(run(route('OrgAdmin')))).toBe('/unauthorized');
  });

  it('turns away a signed-out visitor', () => {
    role.set(null);
    canSwitch.set(false);
    expect(target(run(route('Manager')))).toBe('/unauthorized');
  });
});
