import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ROLE_DASHBOARD_MAP } from '../../core/auth/user-role.model';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
  protected readonly menuOpen = signal(false);
  protected readonly showSignOutModal = signal(false);
  protected readonly signingOut = signal(false);

  protected readonly dashboardRoute = computed(() => {
    const r = this.role();
    return r ? ROLE_DASHBOARD_MAP[r] : '/';
  });

  protected readonly profileRoute = computed(() => {
    const r = this.role();
    return r ? `${ROLE_DASHBOARD_MAP[r]}/profile` : '/';
  });

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
    this.signingOut.set(true);
    this.closeMenu();
    this.showSignOutModal.set(false);
    this.authService.logout();
  }
}
