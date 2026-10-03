import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import {
  BroadcastBannerComponent,
  ButtonComponent,
  ConfirmationModalComponent,
  EmptyStateComponent,
  ErrorAlertComponent,
  LoadingSpinnerComponent,
  type BroadcastBannerSeverity,
} from '@common-daltime';
import {
  OrganizationService,
  type WebAdminOrganization,
} from '../../../services/organization.service';
import { BroadcastsService } from '../../../shared/broadcasts/broadcasts.service';
import {
  WebAdminBroadcastsService,
  type Broadcast,
  type CreateBroadcastBody,
} from './broadcasts.service';

export type BroadcastTarget = CreateBroadcastBody['target_scope'];
export type BroadcastRole = NonNullable<CreateBroadcastBody['role']>;

/** Mirrors `BROADCAST_MESSAGE_MAX` in contracts/src/schemas/web-admin/broadcasts.ts. */
export const MESSAGE_MAX = 500;

export const SEVERITY_OPTIONS: { value: BroadcastBannerSeverity; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const TARGET_OPTIONS: { value: BroadcastTarget; label: string }[] = [
  { value: 'ALL', label: 'All users' },
  { value: 'ORG', label: 'One organization' },
  { value: 'ORG_ROLE', label: 'One role in an organization' },
];

export const ROLE_OPTIONS: { value: BroadcastRole; label: string }[] = [
  { value: 'OrgAdmin', label: 'Org Admins' },
  { value: 'Manager', label: 'Managers' },
  { value: 'Employee', label: 'Employees' },
];

/**
 * WebAdmin broadcast composer: send a banner announcement (maintenance windows,
 * known-issue updates) to all users, one org, or one role in an org, and take
 * active ones down. Route guarded to WebAdmin in app.routes.ts.
 */
@Component({
  selector: 'app-web-admin-broadcasts',
  imports: [
    DatePipe,
    BroadcastBannerComponent,
    ButtonComponent,
    ConfirmationModalComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './broadcasts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAdminBroadcastsComponent implements OnInit {
  private readonly service = inject(WebAdminBroadcastsService);
  private readonly organizationService = inject(OrganizationService);
  private readonly bannerState = inject(BroadcastsService);

  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly targetOptions = TARGET_OPTIONS;
  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly messageMax = MESSAGE_MAX;

  // ── Form ────────────────────────────────────────────────────────────────
  readonly message = signal('');
  readonly severity = signal<BroadcastBannerSeverity>('INFO');
  readonly target = signal<BroadcastTarget>('ALL');
  readonly orgId = signal('');
  readonly role = signal<BroadcastRole>('Employee');
  /** `datetime-local` value (local time, no zone), or '' for no expiry. */
  readonly expiresAtLocal = signal('');

  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly sentMessage = signal<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  readonly organizations = signal<WebAdminOrganization[]>([]);
  readonly active = signal<Broadcast[]>([]);
  readonly loadingActive = signal(true);
  readonly listError = signal<string | null>(null);

  readonly pendingRemoval = signal<Broadcast | null>(null);
  readonly removing = signal(false);

  readonly messageLength = computed(() => this.message().trim().length);
  readonly needsOrg = computed(() => this.target() !== 'ALL');
  readonly needsRole = computed(() => this.target() === 'ORG_ROLE');

  readonly expiryError = computed(() => {
    const value = this.expiresAtLocal();
    if (!value) return null;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return 'Enter a valid date and time.';
    return time <= Date.now() ? 'Expiry must be in the future.' : null;
  });

  readonly isValid = computed(
    () =>
      this.messageLength() > 0 &&
      this.messageLength() <= MESSAGE_MAX &&
      (!this.needsOrg() || this.orgId() !== '') &&
      this.expiryError() === null,
  );

  readonly preview = computed(() => ({
    message: this.message().trim() || 'Your announcement will appear here.',
    severity: this.severity(),
  }));

  private readonly orgNames = computed(
    () => new Map(this.organizations().map((o) => [o.org_id, o.name])),
  );

  ngOnInit(): void {
    this.organizationService.getAll().subscribe({
      next: (orgs) =>
        this.organizations.set([...orgs].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => this.sendError.set('Could not load organizations.'),
    });
    this.loadActive();
  }

  loadActive(): void {
    this.loadingActive.set(true);
    this.listError.set(null);
    this.service.listActive().subscribe({
      next: (list) => {
        this.active.set(list);
        this.loadingActive.set(false);
      },
      error: () => {
        this.listError.set('Could not load active broadcasts.');
        this.loadingActive.set(false);
      },
    });
  }

  /** Human-readable audience for an active broadcast. */
  audience(b: Broadcast): string {
    if (b.target_scope === 'ALL') return 'All users';
    const org = this.orgNames().get(b.target_org_id ?? '') ?? b.target_org_id ?? 'Unknown org';
    if (b.target_scope === 'ORG') return org;
    const role = ROLE_OPTIONS.find((r) => r.value === b.target_role)?.label ?? b.target_role;
    return `${role} in ${org}`;
  }

  // ── Form handlers ───────────────────────────────────────────────────────
  onMessageInput(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  onSeverityChange(event: Event): void {
    this.severity.set((event.target as HTMLSelectElement).value as BroadcastBannerSeverity);
  }

  onTargetChange(value: BroadcastTarget): void {
    this.target.set(value);
  }

  onOrgChange(event: Event): void {
    this.orgId.set((event.target as HTMLSelectElement).value);
  }

  onRoleChange(event: Event): void {
    this.role.set((event.target as HTMLSelectElement).value as BroadcastRole);
  }

  onExpiryInput(event: Event): void {
    this.expiresAtLocal.set((event.target as HTMLInputElement).value);
  }

  clearExpiry(): void {
    this.expiresAtLocal.set('');
  }

  buildBody(): CreateBroadcastBody {
    const target = this.target();
    const expires = this.expiresAtLocal();
    return {
      message: this.message().trim(),
      severity: this.severity(),
      target_scope: target,
      ...(target !== 'ALL' && { org_id: this.orgId() }),
      ...(target === 'ORG_ROLE' && { role: this.role() }),
      ...(expires && { expires_at: new Date(expires).toISOString() }),
    };
  }

  send(): void {
    if (!this.isValid() || this.sending()) return;
    this.sending.set(true);
    this.sendError.set(null);
    this.sentMessage.set(null);

    this.service.create(this.buildBody()).subscribe({
      next: (created) => {
        this.sending.set(false);
        this.active.update((list) => [...list, created]);
        this.sentMessage.set(`Broadcast sent to ${this.audience(created).toLowerCase()}.`);
        this.message.set('');
        this.expiresAtLocal.set('');
        // Show it in this WebAdmin's own banner right away when it reaches them.
        this.bannerState.refreshCurrent();
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        const body = err.error as { error?: string } | null;
        this.sendError.set(body?.error ?? 'Failed to send broadcast.');
      },
    });
  }

  // ── Take down ───────────────────────────────────────────────────────────
  askRemove(b: Broadcast): void {
    this.pendingRemoval.set(b);
  }

  cancelRemove(): void {
    this.pendingRemoval.set(null);
  }

  confirmRemove(): void {
    const target = this.pendingRemoval();
    if (!target) return;
    this.removing.set(true);
    this.service.remove(target.broadcast_id).subscribe({
      next: () => {
        this.removing.set(false);
        this.pendingRemoval.set(null);
        this.active.update((list) => list.filter((b) => b.broadcast_id !== target.broadcast_id));
        this.bannerState.refreshCurrent();
      },
      error: () => {
        this.removing.set(false);
        this.pendingRemoval.set(null);
        this.listError.set('Failed to take the broadcast down.');
      },
    });
  }
}
