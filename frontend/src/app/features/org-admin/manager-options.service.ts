import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth';
import { ProfileService } from './profile/profile.service';
import { ImpersonationService } from '../../core/services/impersonation.service';
import type { ManagerOption } from '../../shared/components/register-employee-modal/register-employee-modal';

/**
 * An OrgAdmin is also a manager of their own employees and schedule (every schedule and
 * employee record just carries a `manager_id`, and theirs is their own user id). This service
 * offers "yourself" as a manager choice, labelled "(you)", next to the org's real managers.
 */
@Injectable({ providedIn: 'root' })
export class OrgAdminManagerOptionsService {
  private readonly auth = inject(AuthService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly profileService = inject(ProfileService);

  /**
   * The admin's name from their profile record — the same `name` the Profile page edits and the
   * Overview shows, so every screen labels them identically. Null until loaded.
   */
  private readonly profileName = signal<string | null>(null);

  constructor() {
    // Loaded once, up front (not from inside `self`, a computed that must not write signals).
    // A failure just leaves the Cognito-name fallback in place.
    this.profileService.get().subscribe({
      next: (p) => this.profileName.set(p.name?.trim() || null),
      error: () => undefined,
    });
  }

  /** Call after the profile name is edited so labels update without a reload. */
  setProfileName(name: string): void {
    this.profileName.set(name.trim() || null);
  }

  /** The OrgAdmin as a manager option, or null until their identity is known. */
  readonly self = computed((): ManagerOption | null => {
    const viewing = this.impersonation.viewingAs();
    if (viewing?.role === 'OrgAdmin') {
      // A WebAdmin viewing as an OrgAdmin sees that OrgAdmin's own entry.
      const [first = '', ...rest] = viewing.displayName.split(' ');
      return {
        manager_id: viewing.userId,
        first_name: first,
        last_name: `${rest.join(' ')} (you)`.trim(),
      };
    }
    const sub = this.auth.userSub();
    if (!sub) return null;
    const name = this.profileName();
    if (name) return { manager_id: sub, first_name: name, last_name: '(you)' };
    return {
      manager_id: sub,
      first_name: this.auth.firstName() || 'Me',
      last_name: `${this.auth.lastName()} (you)`.trim(),
    };
  });

  /** `managers` with the OrgAdmin themself listed first. */
  withSelf<T extends ManagerOption>(managers: T[]): ManagerOption[] {
    const self = this.self();
    return self ? [self, ...managers.filter((m) => m.manager_id !== self.manager_id)] : managers;
  }
}
