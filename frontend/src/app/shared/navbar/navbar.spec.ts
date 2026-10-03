import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError, type Observable } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { Navbar } from './navbar';
import { AuthService } from '../../core/auth/auth';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { OrgAdminOrganizationService } from '../../features/org-admin/organization/organization.service';
import type { UserRole } from '../../core/auth/user-role.model';
import type { ImpersonateContext } from '../../core/services/impersonation.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a mock AuthService with a given role (null = unauthenticated). */
function buildAuthService(role: UserRole | null) {
  return {
    isAuthenticatedSignal: () => role !== null,
    roleSignal: () => role,
    authReady: () => true,
    accessToken: null,
    idToken: null,
    orgId: signal(null),
    userSub: signal<string | null>(null),
    // firstName/lastName signals are used by the navbar displayName computed —
    // return empty strings so the @if (displayName()) guard hides the name element in tests.
    firstName: signal(''),
    lastName: signal(''),
    hasPendingChallenge: false,
    initialize: () => {},
    login: async () => ({ success: false }),
    completeNewPassword: async () => ({ success: false }),
    logout: () => {},
    getAccessToken: () => null,
    getUserAttributes: async () => {},
    updateUserAttribute: async () => false,
    routeToDashboardForRole: () => '/',
  };
}

/** Build a mock ImpersonationService. viewingAs = null means no impersonation. */
function buildImpersonationService(ctx: ImpersonateContext | null) {
  return {
    viewingAs: signal(ctx),
    startImpersonation: () => {},
    endImpersonation: () => {},
  };
}

/** The org lookup the navbar makes for OrgAdmins; defaults to a named org. */
const orgGet = vi.fn<() => Observable<{ name: string }>>();

/** Mount the Navbar with the given auth role and optional impersonation context. */
async function mountNavbar(
  role: UserRole | null,
  impersonating: ImpersonateContext | null = null,
): Promise<{ fixture: ComponentFixture<Navbar>; el: HTMLElement }> {
  await TestBed.configureTestingModule({
    imports: [Navbar],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: buildAuthService(role) },
      { provide: ImpersonationService, useValue: buildImpersonationService(impersonating) },
      { provide: OrgAdminOrganizationService, useValue: { get: orgGet } },
    ],
  }).compileComponents();

  // provideRouter([]) has no routes: real navigations (view switch, links) would reject with NG04002.
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture = TestBed.createComponent(Navbar);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

beforeEach(() => orgGet.mockReset().mockReturnValue(of({ name: 'Acme Hospitality' })));

// ── Org name (OrgAdmin) ────────────────────────────────────────────────────────

describe('Navbar — organization name', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  const orgName = (el: HTMLElement) =>
    el.querySelector('[data-testid="navbar-org-name"]')?.textContent?.trim();

  it('shows the organization name to an OrgAdmin', async () => {
    const { el } = await mountNavbar('OrgAdmin');
    expect(orgGet).toHaveBeenCalledTimes(1);
    expect(orgName(el)).toBe('Acme Hospitality');
  });

  it('shows the impersonated org when a WebAdmin views as an OrgAdmin', async () => {
    const { el } = await mountNavbar('WebAdmin', {
      userId: 'u1',
      role: 'OrgAdmin',
    } as unknown as ImpersonateContext);
    expect(orgName(el)).toBe('Acme Hospitality');
  });

  it.each(['Manager', 'Employee', 'WebAdmin'] as const)(
    'does not look up or show an org name for %s',
    async (role) => {
      const { el } = await mountNavbar(role);
      expect(orgGet).not.toHaveBeenCalled();
      expect(orgName(el)).toBeUndefined();
    },
  );

  it('renders no org name when unauthenticated', async () => {
    const { el } = await mountNavbar(null);
    expect(orgGet).not.toHaveBeenCalled();
    expect(orgName(el)).toBeUndefined();
  });

  it('omits the org name (and still renders the navbar) when the lookup fails', async () => {
    orgGet.mockReturnValue(throwError(() => new Error('boom')));
    const { el } = await mountNavbar('OrgAdmin');
    expect(orgName(el)).toBeUndefined();
    expect(el.querySelector('nav')).toBeTruthy();
  });
});

describe('Navbar — view as manager', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  const click = async (fixture: ComponentFixture<Navbar>, testid: string): Promise<void> => {
    const host = fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement;
    (host.querySelector('button') ?? host).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('offers an OrgAdmin a "View as Manager" switch', async () => {
    const { el } = await mountNavbar('OrgAdmin');
    expect(el.querySelector('[data-testid="navbar-view-as-manager"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="navbar-back-to-org-admin"]')).toBeNull();
  });

  it('keeps the phone header uncramped: short switch label, org name visible, wordmark yields', async () => {
    const { el } = await mountNavbar('OrgAdmin');
    const button = el.querySelector('[data-testid="navbar-view-as-manager"]')!;
    // Short label below sm, full label from sm up.
    expect(button.querySelector('span.sm\\:hidden')!.textContent).toContain('Manager');
    expect(button.querySelector('span.hidden')!.textContent).toContain('View as Manager');
    // The org name is no longer `hidden` on phones (only capped in width) ...
    const org = el.querySelector('[data-testid="navbar-org-name"]');
    if (org) {
      expect(org.classList.contains('hidden')).toBe(false);
      expect(org.className).toContain('max-w-[6.5rem]');
    }
    // ... while the "DalTime" wordmark text gives way to it below sm.
    expect(el.querySelector('a span.hidden.sm\\:inline')!.textContent).toContain('DalTime');
  });

  it.each(['Manager', 'Employee', 'WebAdmin'] as const)(
    'does not offer it to a %s',
    async (role) => {
      const { el } = await mountNavbar(role);
      expect(el.querySelector('[data-testid="navbar-view-as-manager"]')).toBeNull();
    },
  );

  it('does not offer it while a WebAdmin impersonates an OrgAdmin', async () => {
    const { el } = await mountNavbar('WebAdmin', {
      userId: 'u1',
      role: 'OrgAdmin',
    } as unknown as ImpersonateContext);
    expect(el.querySelector('[data-testid="navbar-view-as-manager"]')).toBeNull();
  });

  it('puts the switch in the always-visible top bar, not inside the collapsible menu', async () => {
    const { el } = await mountNavbar('OrgAdmin');
    const button = el.querySelector('[data-testid="navbar-view-as-manager"]')!;
    expect(button).toBeTruthy();
    expect(button.closest('#mainNav')).toBeNull();
  });

  it('keeps it in the bar in Manager view too, labelled as the way back', async () => {
    const { fixture, el } = await mountNavbar('OrgAdmin');
    await click(fixture, 'navbar-view-as-manager');
    const back = el.querySelector('[data-testid="navbar-back-to-org-admin"]')!;
    expect(back.closest('#mainNav')).toBeNull();
    expect(back.textContent).toContain('Org Admin view');
  });

  it('swaps to manager navigation, a badge and a way back — and the org name stays', async () => {
    const { fixture, el } = await mountNavbar('OrgAdmin');
    expect(el.querySelector('[data-testid="navbar-home"]')).toBeTruthy(); // org-admin nav

    await click(fixture, 'navbar-view-as-manager');

    expect(el.querySelector('[data-testid="navbar-manager-view-badge"]')?.textContent).toContain(
      'Manager view',
    );
    expect(el.querySelector('[data-testid="navbar-home"]')).toBeNull(); // org-admin-only link gone
    expect(el.querySelector('a[href="/manager/employees"]')).toBeTruthy(); // manager nav
    expect(el.querySelector('[data-testid="navbar-back-to-org-admin"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="navbar-org-name"]')?.textContent).toContain(
      'Acme Hospitality',
    );
    expect(orgGet).toHaveBeenCalledTimes(1); // switching view does not refetch
  });

  it('goes back to the Org Admin view', async () => {
    const { fixture, el } = await mountNavbar('OrgAdmin');
    await click(fixture, 'navbar-view-as-manager');
    await click(fixture, 'navbar-back-to-org-admin');

    expect(el.querySelector('[data-testid="navbar-manager-view-badge"]')).toBeNull();
    expect(el.querySelector('[data-testid="navbar-home"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="navbar-view-as-manager"]')).toBeTruthy();
  });

  it('keeps the profile link on the OrgAdmin profile in either view', async () => {
    const { fixture, el } = await mountNavbar('OrgAdmin');
    await click(fixture, 'navbar-view-as-manager');
    const spyRouter = TestBed.inject(Router);
    const nav = vi.spyOn(spyRouter, 'navigate').mockResolvedValue(true);

    await click(fixture, 'navbar-profile');

    expect(nav).toHaveBeenCalledWith(['/org-admin/profile']);
    void el;
  });
});

describe('Navbar — OrgAdmin Home link', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear(); // the view-as-manager tests persist their choice per tab
  });

  it('links Home to /org-admin for an OrgAdmin', async () => {
    const { el } = await mountNavbar('OrgAdmin');
    const home = el.querySelector('[data-testid="navbar-home"]');
    expect(home?.getAttribute('href')).toBe('/org-admin');
  });

  it('does not show Home to other roles', async () => {
    const { el } = await mountNavbar('Manager');
    expect(el.querySelector('[data-testid="navbar-home"]')).toBeNull();
  });
});

// ── Employee nav link ──────────────────────────────────────────────────────────

describe('Navbar — Employee nav link (story #303)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders a "Schedule" link (not "Dashboard") for the Employee role', async () => {
    const { el } = await mountNavbar('Employee');
    const scheduleLink = el.querySelector<HTMLAnchorElement>(
      '[data-testid="navbar-employee-schedule"]',
    );
    expect(scheduleLink).toBeTruthy();
    expect(scheduleLink?.textContent?.trim()).toBe('Schedule');
  });

  it('Employee schedule link routes to /employee/schedule', async () => {
    const { el } = await mountNavbar('Employee');
    const scheduleLink = el.querySelector<HTMLAnchorElement>(
      '[data-testid="navbar-employee-schedule"]',
    );
    // Angular sets href to the resolved path
    expect(scheduleLink?.getAttribute('href')).toBe('/employee/schedule');
  });

  it('does NOT render any link with text "Dashboard" for the Employee role', async () => {
    const { el } = await mountNavbar('Employee');
    const allLinks = Array.from(el.querySelectorAll('a'));
    const dashboardLink = allLinks.find((a) => a.textContent?.trim() === 'Dashboard');
    expect(dashboardLink).toBeUndefined();
  });

  it('does NOT render a nav menu link (other than the brand logo) pointing to /employee (bare path)', async () => {
    const { el } = await mountNavbar('Employee');
    // The brand logo anchor uses /employee (ROLE_DASHBOARD_MAP['Employee']) as its dashboardRoute.
    // That is intentional — /employee redirects to /employee/schedule via the router.
    // What must NOT exist is a menu link labeled "Dashboard" or "Schedule" that routes to the
    // bare /employee path instead of /employee/schedule.
    const navMenu = el.querySelector('nav ul');
    if (!navMenu) return; // menu not rendered (e.g. mobile hidden) — skip DOM check
    const menuLinks = Array.from(navMenu.querySelectorAll('a'));
    const bareEmployeeNavLink = menuLinks.find((a) => a.getAttribute('href') === '/employee');
    expect(bareEmployeeNavLink).toBeUndefined();
  });

  it('renders the Employee schedule link with data-testid="navbar-employee-schedule"', async () => {
    const { el } = await mountNavbar('Employee');
    const el2 = el.querySelector('[data-testid="navbar-employee-schedule"]');
    expect(el2).toBeTruthy();
  });

  // Brand logo link — should route to /employee for Employee role (which redirects to /employee/schedule via router)
  it('brand logo link routes to /employee for the Employee role', async () => {
    const { el } = await mountNavbar('Employee');
    // The brand anchor uses [routerLink]="dashboardRoute()" which resolves to ROLE_DASHBOARD_MAP['Employee'] = /employee
    const brandLink = el.querySelector<HTMLAnchorElement>('a[href="/employee"]');
    expect(brandLink).toBeTruthy();
    // The brand text should be present on it
    expect(brandLink?.textContent).toContain('DalTime');
  });

  // Profile route — /employee/profile must still be correct
  it('ROLE_DASHBOARD_MAP keeps Employee base at /employee so profileRoute is /employee/profile', async () => {
    // Mount as Employee and inspect the profile nav item's computed href
    const { fixture } = await mountNavbar('Employee');
    const navbar = fixture.componentInstance as unknown as { profileRoute(): string };
    expect(navbar.profileRoute()).toBe('/employee/profile');
  });
});

// ── Web-Admin impersonating Employee ──────────────────────────────────────────

describe('Navbar — Web-Admin impersonating Employee (story #303)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const employeeCtx: ImpersonateContext = {
    userId: 'imp-user-1',
    role: 'Employee',
    displayName: 'Test Employee',
    email: 'employee@test.com',
    orgId: 'org-001',
    sessionId: 'test-session-id',
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };

  it('shows "Schedule" link (not "Dashboard") when WebAdmin impersonates Employee', async () => {
    const { el } = await mountNavbar('WebAdmin', employeeCtx);
    const scheduleLink = el.querySelector<HTMLAnchorElement>(
      '[data-testid="navbar-employee-schedule"]',
    );
    expect(scheduleLink).toBeTruthy();
    expect(scheduleLink?.textContent?.trim()).toBe('Schedule');
  });

  it('Employee schedule link routes to /employee/schedule during impersonation', async () => {
    const { el } = await mountNavbar('WebAdmin', employeeCtx);
    const scheduleLink = el.querySelector<HTMLAnchorElement>(
      '[data-testid="navbar-employee-schedule"]',
    );
    expect(scheduleLink?.getAttribute('href')).toBe('/employee/schedule');
  });

  it('does not show "Dashboard" text during Employee impersonation', async () => {
    const { el } = await mountNavbar('WebAdmin', employeeCtx);
    const allLinks = Array.from(el.querySelectorAll('a'));
    const dashboardLink = allLinks.find((a) => a.textContent?.trim() === 'Dashboard');
    expect(dashboardLink).toBeUndefined();
  });
});

// ── Role isolation — Employee links must not appear for other roles ────────────

describe('Navbar — Employee nav block absent for non-Employee roles (story #303)', () => {
  const otherRoles: UserRole[] = ['Manager', 'OrgAdmin', 'WebAdmin'];

  beforeEach(() => TestBed.resetTestingModule());

  for (const role of otherRoles) {
    it(`does not render [data-testid="navbar-employee-schedule"] for role=${role}`, async () => {
      const { el } = await mountNavbar(role);
      const scheduleLink = el.querySelector('[data-testid="navbar-employee-schedule"]');
      expect(scheduleLink).toBeNull();
    });
  }
});

// ── Unauthenticated state ──────────────────────────────────────────────────────

describe('Navbar — unauthenticated state (story #303)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('does not render the Employee schedule link when not authenticated', async () => {
    const { el } = await mountNavbar(null);
    const scheduleLink = el.querySelector('[data-testid="navbar-employee-schedule"]');
    expect(scheduleLink).toBeNull();
  });
});
