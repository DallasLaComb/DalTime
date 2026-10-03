import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { ImpersonationService } from './impersonation.service';
import type { UserRole } from '../auth/user-role.model';

const STORAGE_KEY = 'daltime_view_mode';

export type ViewMode = 'orgadmin' | 'manager';

/**
 * "View as manager": an OrgAdmin can switch between their Org Admin view and a Manager view,
 * with the two feature sets kept apart on that gate. In Manager view the app behaves as the
 * Manager role (manager nav, manager routes) and `/manager/*` requests carry `X-View-As: manager`
 * (see view-mode.interceptor.ts) so the backend treats them as a manager whose id is their own.
 *
 * Per-tab (sessionStorage) — a new tab/session starts in Org Admin view. Only a real OrgAdmin
 * can be in Manager view; a WebAdmin impersonating someone never is.
 */
@Injectable({ providedIn: 'root' })
export class ViewModeService {
  private readonly auth = inject(AuthService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly router = inject(Router);

  private readonly _mode = signal<ViewMode>(this.read());

  /** True for a signed-in OrgAdmin (not one being impersonated) — the only person who can switch. */
  readonly canSwitch = computed(
    () => this.auth.roleSignal() === 'OrgAdmin' && !this.impersonation.viewingAs(),
  );

  /** True while an OrgAdmin is in Manager view. */
  readonly managerMode = computed(() => this.canSwitch() && this._mode() === 'manager');

  /** The role the app should behave as, ignoring impersonation (which the callers layer on top). */
  readonly effectiveRole = computed<UserRole | null>(() =>
    this.managerMode() ? 'Manager' : this.auth.roleSignal(),
  );

  constructor() {
    // A signed-out tab must not leak Manager view to the next person who signs in.
    effect(() => {
      if (!this.auth.roleSignal()) this.set('orgadmin');
    });
  }

  /** Switch view and land on that view's home. */
  switchTo(mode: ViewMode): void {
    if (!this.canSwitch()) return;
    this.set(mode);
    void this.router.navigate([mode === 'manager' ? '/manager' : '/org-admin']);
  }

  private set(mode: ViewMode): void {
    this._mode.set(mode);
    try {
      sessionStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable (private mode) — the in-memory value still works for this page */
    }
  }

  private read(): ViewMode {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'manager' ? 'manager' : 'orgadmin';
    } catch {
      return 'orgadmin';
    }
  }
}
