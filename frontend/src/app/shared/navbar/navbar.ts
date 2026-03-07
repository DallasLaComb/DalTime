import { Component, computed, inject } from '@angular/core';
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

  protected readonly dashboardRoute = computed(() => {
    const r = this.role();
    return r ? ROLE_DASHBOARD_MAP[r] : '/';
  });

  protected readonly profileRoute = computed(() => {
    const r = this.role();
    return r ? `${ROLE_DASHBOARD_MAP[r]}/profile` : '/';
  });
}
