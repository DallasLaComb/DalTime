import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiClient, type ApiSchema } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth';
import type { UserRole } from '../../core/auth/user-role.model';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { LoggerService } from '../../core/logging/logger.service';

export type ActiveBroadcast = ApiSchema<'ActiveBroadcastResponse'>;

/** Literal contract paths per role — see `NOTIFICATIONS_PATH` in notifications.service.ts for why. */
const ACTIVE_PATH = {
  WebAdmin: '/web-admin/broadcasts/active',
  OrgAdmin: '/org-admin/broadcasts/active',
  Manager: '/manager/broadcasts/active',
  Employee: '/employee/broadcasts/active',
} as const satisfies Record<UserRole, string>;

const DISMISSAL_PATH = {
  WebAdmin: '/web-admin/broadcasts/{broadcastId}/dismissal',
  OrgAdmin: '/org-admin/broadcasts/{broadcastId}/dismissal',
  Manager: '/manager/broadcasts/{broadcastId}/dismissal',
  Employee: '/employee/broadcasts/{broadcastId}/dismissal',
} as const satisfies Record<UserRole, string>;

/** Refetch on navigation at most this often. */
export const NAVIGATION_REFRESH_MS = 60_000;
/** Background poll while the tab is visible. */
export const POLL_INTERVAL_MS = 5 * 60_000;

/**
 * State for the app-shell broadcast banner (WebAdmin announcements).
 *
 * Loads the caller's active broadcasts when they sign in or their effective role
 * changes (including starting/stopping impersonation), on navigation (throttled),
 * and on a slow poll — so a new announcement appears without visiting a
 * particular page. The backend returns them highest-priority first; the banner
 * shows `current()`.
 */
@Injectable({ providedIn: 'root' })
export class BroadcastsService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly logger = inject(LoggerService);

  private readonly _active = signal<ActiveBroadcast[]>([]);
  private lastFetchAt = 0;

  /** The role whose broadcasts are shown — the impersonated role while impersonating. */
  readonly effectiveRole = computed<UserRole | null>(() =>
    this.auth.isAuthenticatedSignal()
      ? (this.impersonation.viewingAs()?.role ?? this.auth.roleSignal())
      : null,
  );

  /** The banner to show, or null. */
  readonly current = computed<ActiveBroadcast | null>(() => this._active()[0] ?? null);

  /** Impersonation is read-only on the backend, so a WebAdmin viewing as someone can't dismiss. */
  readonly canDismiss = computed(() => this.impersonation.viewingAs() === null);

  constructor() {
    effect(() => {
      const role = this.effectiveRole();
      if (role) this.refresh(role);
      else this._active.set([]);
    });

    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        if (Date.now() - this.lastFetchAt >= NAVIGATION_REFRESH_MS) this.refreshCurrent();
      });

    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.refreshCurrent();
      }
    }, POLL_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** Refetch for the current effective role, if signed in. */
  refreshCurrent(): void {
    const role = this.effectiveRole();
    if (role) this.refresh(role);
  }

  private refresh(role: UserRole): void {
    this.lastFetchAt = Date.now();
    this.api.get(ACTIVE_PATH[role]).subscribe({
      next: (list) => {
        // Ignore a late response for a role the user has since left.
        if (this.effectiveRole() === role) this._active.set(list);
      },
      error: (err: unknown) => this.logger.warn('broadcasts: failed to load', err),
    });
  }

  /** Hide the current banner now; persist the dismissal, restoring the banner if that fails. */
  dismiss(broadcastId: string): void {
    const role = this.effectiveRole();
    if (!role || !this.canDismiss()) return;

    const previous = this._active();
    this._active.set(previous.filter((b) => b.broadcast_id !== broadcastId));

    this.api.put(DISMISSAL_PATH[role], undefined, { params: { broadcastId } }).subscribe({
      error: (err: unknown) => {
        this.logger.warn('broadcasts: failed to dismiss', err);
        this._active.set(previous);
      },
    });
  }
}
