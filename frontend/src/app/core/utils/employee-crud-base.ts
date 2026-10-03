import { Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import {
  countByStatus,
  filterByStatus,
  isStatusFilter,
  parseStatusFilter,
  STATUS_FILTER_LABELS,
  type StatusFilter,
} from './status-filter';

export interface EntityWithStatus {
  status: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Abstract base for components that manage an employee/manager CRUD page with
 * register, edit, disable, and enable modal flows.
 *
 * Subclasses provide:
 * - `extractId(entity)` — returns the entity's primary key string
 * - `disableEntity(id)` / `enableEntity(id)` — service calls
 * - `load()` — initial data fetch
 *
 * The register and edit flows differ too much between role types (different
 * service signatures and request bodies) so they remain in subclasses.
 */
export abstract class EmployeeCrudBaseComponent<T extends EntityWithStatus> {
  // ── Status filter (All / Active / Disabled / Pending) ─────────────────────────
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Everyone on the page, before filtering. Subclasses point this at their list signal. */
  protected abstract readonly entities: Signal<T[]>;

  /** The selection. The URL (`?status=`) is the source of truth, so reload and links keep it. */
  readonly statusFilter = signal<StatusFilter>('all');
  readonly statusCounts = computed(() => countByStatus(this.entities()));
  readonly filteredEntities = computed(() => filterByStatus(this.entities(), this.statusFilter()));

  /** Friendly empty text when the filter hides everyone, e.g. "No disabled employees." */
  protected readonly nothingMatchingText = computed(() => {
    const label = STATUS_FILTER_LABELS[this.statusFilter()].toLowerCase();
    return `No ${label} ${this.noun}.`;
  });

  /** Plural noun for messages ("employees" / "managers"). */
  protected readonly noun: string = 'people';

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const raw = params.get('status');
      this.statusFilter.set(parseStatusFilter(raw));
      // A value we don't recognise (a stale or mistyped link) falls back to All — and is dropped
      // from the URL rather than left sitting there.
      if (raw !== null && !isStatusFilter(raw)) this.clearStatusParam();
    });
  }

  private clearStatusParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setStatusFilter(filter: StatusFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: filter === 'all' ? null : filter },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Core state ────────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  // ── Register modal ────────────────────────────────────────────────────────────
  readonly showRegisterModal = signal(false);
  readonly modalError = signal<string | null>(null);

  // ── Edit modal ────────────────────────────────────────────────────────────────
  readonly showEditModal = signal(false);
  readonly editError = signal<string | null>(null);

  // ── Disable modal ─────────────────────────────────────────────────────────────
  readonly showDisableModal = signal(false);
  readonly disablingEntity = signal<T | null>(null);
  /** The server's reason the last disable didn't go through (e.g. "…manages 2 employees"). */
  readonly disableError = signal<string | null>(null);
  /** The server only needs an acknowledgement (upcoming shifts): the next confirm sends it. */
  readonly disableNeedsAcknowledgement = signal(false);
  readonly enableError = signal<string | null>(null);

  // ── Enable modal ──────────────────────────────────────────────────────────────
  readonly showEnableModal = signal(false);
  readonly enablingEntity = signal<T | null>(null);

  // ── Abstract contract ─────────────────────────────────────────────────────────

  protected abstract load(): void;
  protected abstract extractId(entity: T): string;
  protected abstract disableEntity(id: string, acknowledgeShifts?: boolean): Observable<void>;
  protected abstract enableEntity(id: string): Observable<void>;

  // ── Register modal handlers ───────────────────────────────────────────────────

  openRegisterModal(): void {
    this.modalError.set(null);
    this.showRegisterModal.set(true);
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
  }

  // ── Edit modal handlers ───────────────────────────────────────────────────────

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  // ── Disable modal handlers ────────────────────────────────────────────────────

  openDisableModal(entity: T): void {
    this.disablingEntity.set(entity);
    this.disableError.set(null);
    this.disableNeedsAcknowledgement.set(false);
    this.showDisableModal.set(true);
  }

  closeDisableModal(): void {
    this.showDisableModal.set(false);
    this.disablingEntity.set(null);
  }

  confirmDisable(): void {
    const entity = this.disablingEntity();
    if (!entity) return;
    this.saving.set(true);
    this.disableError.set(null);
    this.disableEntity(this.extractId(entity), this.disableNeedsAcknowledgement()).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDisableModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        // A 409 says what still depends on this person; show it instead of failing silently.
        this.disableError.set(err?.error?.error ?? 'Failed to disable. Please try again.');
        this.disableNeedsAcknowledgement.set(err?.error?.requires_acknowledgement === true);
      },
    });
  }

  // ── Enable modal handlers ─────────────────────────────────────────────────────

  openEnableModal(entity: T): void {
    this.enablingEntity.set(entity);
    this.enableError.set(null);
    this.showEnableModal.set(true);
  }

  closeEnableModal(): void {
    this.showEnableModal.set(false);
    this.enablingEntity.set(null);
  }

  confirmEnable(): void {
    const entity = this.enablingEntity();
    if (!entity) return;
    this.saving.set(true);
    this.enableEntity(this.extractId(entity)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEnableModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.enableError.set(err?.error?.error ?? 'Failed to enable. Please try again.');
      },
    });
  }
}
