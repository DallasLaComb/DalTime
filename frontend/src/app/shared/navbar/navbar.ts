import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ButtonComponent, ConfirmationModalComponent } from '@common-daltime';
import { AuthService } from '../../core/auth/auth';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { ViewModeService } from '../../core/services/view-mode.service';
import { ImpersonationBannerComponent } from '../components/impersonation-banner/impersonation-banner';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';
import { NotificationBellComponent } from '../notifications/notification-bell';
import { OrgAdminOrganizationService } from '../../features/org-admin/organization/organization.service';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonComponent,
    ConfirmationModalComponent,
    ImpersonationBannerComponent,
    NotificationBellComponent,
  ],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  protected readonly impersonationService = inject(ImpersonationService);
  protected readonly viewMode = inject(ViewModeService);
  private readonly orgService = inject(OrgAdminOrganizationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly menuOpen = signal(false);
  protected readonly showSignOutModal = signal(false);
  protected readonly signingOut = signal(false);

  /** The OrgAdmin's organization name, shown beside the brand. Null for every other role. */
  protected readonly orgName = signal<string | null>(null);

  constructor() {
    // Load the org name whenever the effective role becomes OrgAdmin (own session or impersonated);
    // clear it on any other role so a previous org's name never lingers after sign-out / switch.
    effect((onCleanup) => {
      if (!this.authService.isAuthenticatedSignal() || this.accountRole() !== 'OrgAdmin') {
        this.orgName.set(null);
        return;
      }
      const sub = this.orgService.get().subscribe({
        next: (org) => this.orgName.set(org.name),
        error: () => this.orgName.set(null),
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Close the mobile menu on every navigation so it never stays open after a touch-triggered
    // route change where the (click)="closeMenu()" binding on the link fires too late or not at all.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  /**
   * When impersonating, show the impersonated user's role in the nav so
   * the web-admin sees the same nav links as the target user.
   */
  protected readonly effectiveRole = computed(
    () => this.impersonationService.viewingAs()?.role ?? this.viewMode.effectiveRole(),
  );

  /** What the real account is: drives the bell, the profile page and the org name, which don't change with the view. */
  protected readonly accountRole = computed(
    () => this.impersonationService.viewingAs()?.role ?? this.authService.roleSignal(),
  );

  protected readonly dashboardRoute = computed(() => {
    const r = this.effectiveRole();
    return r ? ROLE_DASHBOARD_MAP[r] : '/';
  });

  protected readonly profileRoute = computed(() => {
    // An OrgAdmin's profile is the same page in either view (there is no separate manager profile for them).
    const r = this.accountRole();
    return r ? `${ROLE_DASHBOARD_MAP[r]}/profile` : '/';
  });

  /**
   * Combines the authenticated user's given name and family name into a single
   * display string. Returns an empty string when neither attribute has been set
   * (e.g. before the Cognito GetUser call completes), which hides the element
   * via the @if guard in the template.
   */
  protected readonly displayName = computed(() => {
    const first = this.authService.firstName();
    const last = this.authService.lastName();
    return `${first} ${last}`.trim();
  });

  protected endImpersonation(): void {
    this.impersonationService.endImpersonation();
    void this.router.navigate(['/web-admin']);
  }

  protected switchView(): void {
    this.closeMenu();
    this.viewMode.switchTo(this.viewMode.managerMode() ? 'orgadmin' : 'manager');
  }

  protected navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  protected navigateToProfile(): void {
    this.closeMenu();
    this.router.navigate([this.profileRoute()]);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected openSignOutModal(): void {
    this.closeMenu();
    this.showSignOutModal.set(true);
  }

  protected closeSignOutModal(): void {
    this.showSignOutModal.set(false);
  }

  protected confirmSignOut(): void {
    this.impersonationService.endImpersonation();
    this.showSignOutModal.set(false);
    this.signingOut.set(false);
    this.authService.logout();
  }
}
