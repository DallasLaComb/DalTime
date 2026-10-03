import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Time12Pipe } from '../../../shared/pipes/time12.pipe';
import { forkJoin } from 'rxjs';
import type { Shift, CreateShiftBody } from '../../../core/models/shift.model';
import type { ShiftNeeded } from '../../../core/models/manager-shift-needed.model';
import type {
  DayAvailability,
  DayOfWeek,
  TimeSlot,
} from '../../../core/models/employee-availability.model';
import {
  toDateKey,
  toMonthKey,
  buildViewLabel,
  computeUnfilledSlots,
  generateDraftMessage,
  getVisibleShifts,
  isDateInView,
  noDraftsToPublishMessage,
  publishedMessage,
  shiftCrossesMidnight,
  shiftMinutes,
} from '../../../core/utils/schedule.utils';
import { ScheduleBaseComponent } from '../../../core/utils/schedule-base';
import { ManagerShiftsService } from './shifts.service';
import { ManagerScheduleService } from './schedule.service';
import { ManagerEmployeesService } from '../employees/employees.service';
import { ManagerLocationsService } from '../shifts-needed/locations.service';
import { ManagerShiftsNeededService } from '../shifts-needed/shifts-needed.service';
import { ManagerEmployeeAvailabilityService } from './employee-availability.service';
import type { EmployeeAvailabilityBundle } from './employee-availability.service';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ButtonComponent,
  ShiftTypeHintComponent,
  GenerateDraftConfirmComponent,
  GenerateDraftStatusComponent,
  type GenerateDraftStatus,
  ConfirmationModalComponent,
  LoadingSpinnerComponent,
  ErrorAlertComponent,
  EmptyStateComponent,
  ScheduleFiltersComponent,
  ScheduleViewToggleComponent,
  ScheduleNavComponent,
  MobileMonthGridComponent,
  MobileDayListComponent,
  SwipeNavDirective,
} from '@common-daltime';

export type ViewMode = 'day' | 'week' | 'month' | 'availability' | 'fill-shift';

/** View model for one employee in the phone availability list. */
export interface AvailabilityCard {
  employeeId: string;
  name: string;
  /** False when the employee has never submitted a weekly schedule. */
  hasSchedule: boolean;
  days: {
    key: DayOfWeek;
    /** "Mon" */
    label: string;
    /** "M" */
    letter: string;
    available: boolean;
    slots: TimeSlot[];
  }[];
}

export interface UnfilledSlot {
  shiftNeeded: ShiftNeeded;
  /** How many more employees are needed for this slot */
  remaining: number;
  /** Generate Draft already tried this slot and nobody was available. */
  failed: boolean;
}

const DOW_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function dayOfWeek(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  return DOW_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function toMins(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function effectiveDayAvail(
  date: string,
  schedule: Record<string, DayAvailability> | null | undefined,
  overrides: Record<string, DayAvailability> | null | undefined,
): DayAvailability | null {
  if (overrides?.[date]) return overrides[date];
  if (!schedule) return null;
  return schedule[dayOfWeek(date)] ?? null;
}

/**
 * Whether availability covers a shift. An overnight shift (end earlier than start) needs the start
 * day free from the start to the end of the day and the next day (`nextDayAvail`) from midnight to
 * the end time. Mirrors `isAvailableForShift` in the backend scheduler.
 */
function isAvailableFor(
  avail: DayAvailability | null,
  startTime: string,
  endTime: string,
  nextDayAvail: DayAvailability | null = null,
): boolean {
  if (!avail?.available || !avail.slots?.length) return false;
  const covers = (slots: NonNullable<DayAvailability['slots']>, from: string, to: string) =>
    slots.some((s) => toMins(s.from) <= toMins(from) && toMins(s.to) >= toMins(to));
  if (!shiftCrossesMidnight(startTime, endTime)) return covers(avail.slots, startTime, endTime);
  if (!nextDayAvail?.available || !nextDayAvail.slots?.length) return false;
  return covers(avail.slots, startTime, '23:59') && covers(nextDayAvail.slots, '00:00', endTime);
}

function nextDateKey(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function weekBounds(date: string): { startKey: string; endKey: string } {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = day.getUTCDay(); // 0 = Sunday
  const sunday = new Date(day);
  sunday.setUTCDate(day.getUTCDate() - dow);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    startKey: sunday.toISOString().slice(0, 10),
    endKey: saturday.toISOString().slice(0, 10),
  };
}

function weeklyHoursForEmployee(employeeId: string, targetDate: string, shifts: Shift[]): number {
  const { startKey, endKey } = weekBounds(targetDate);
  return shifts
    .filter((s) => s.employee_id === employeeId && s.date >= startKey && s.date <= endKey)
    .reduce((total, s) => total + shiftMinutes(s.start_time, s.end_time) / 60, 0);
}

/** Fields of the shift modal that can carry a validation error. */
type ShiftField = 'date' | 'location' | 'start' | 'end';

@Component({
  selector: 'app-manager-schedule',
  imports: [
    Time12Pipe,
    DatePipe,
    PluralPipe,
    NgTemplateOutlet,
    ButtonComponent,
    ShiftTypeHintComponent,
    GenerateDraftConfirmComponent,
    GenerateDraftStatusComponent,
    ConfirmationModalComponent,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    ScheduleFiltersComponent,
    ScheduleViewToggleComponent,
    ScheduleNavComponent,
    MobileMonthGridComponent,
    MobileDayListComponent,
    SwipeNavDirective,
  ],
  templateUrl: './schedule.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerSchedule extends ScheduleBaseComponent implements OnInit {
  private readonly shiftsService = inject(ManagerShiftsService);
  private readonly scheduleService = inject(ManagerScheduleService);
  private readonly employeesService = inject(ManagerEmployeesService);
  private readonly locationsService = inject(ManagerLocationsService);
  private readonly shiftsNeededService = inject(ManagerShiftsNeededService);
  private readonly availabilityService = inject(ManagerEmployeeAvailabilityService);

  protected override readonly viewMode = signal<ViewMode>('month');

  protected readonly allShiftsNeeded = signal<ShiftNeeded[]>([]);
  protected readonly availabilityBundles = signal<Map<string, EmployeeAvailabilityBundle>>(
    new Map(),
  );

  // ── Modal state ──────────────────────────────────────────────────────────────
  protected readonly modalOpen = signal(false);
  protected readonly editingShift = signal<Shift | null>(null);
  protected readonly formDate = signal('');
  protected readonly formEmployeeId = signal('');
  protected readonly formLocationId = signal('');
  protected readonly formStartTime = signal('');
  protected readonly formEndTime = signal('');
  protected readonly modalSaving = signal(false);
  protected readonly modalError = signal<string | null>(null);
  /** Per-field validation messages for the shift modal. */
  /** Set by the first Save attempt; from then on the errors follow the form live. */
  private readonly shiftSubmitted = signal(false);
  /** Per-field validation messages — shown after a Save attempt and cleared as soon as fixed. */
  protected readonly fieldErrors = computed<Partial<Record<ShiftField, string>>>(() =>
    this.shiftSubmitted() ? this.validateShiftForm() : {},
  );

  protected readonly generating = signal(false);
  protected readonly publishing = signal(false);
  protected readonly scheduleActionResult = signal<string | null>(null);

  protected readonly draftRunCount = signal(0);
  protected readonly maxDraftRuns = signal(10);
  protected readonly draftLimitReached = computed(
    () => this.draftRunCount() >= this.maxDraftRuns(),
  );

  // ── Feature #166: Unfilled shifts-needed ─────────────────────────────────────

  protected readonly unfilledSlots = computed<UnfilledSlot[]>(() =>
    computeUnfilledSlots(this.allShiftsNeeded(), this.shiftsAndMarkers(), this.filterLocation()),
  );

  protected readonly unfilledByDate = computed(() => {
    const map = new Map<string, UnfilledSlot[]>();
    for (const slot of this.unfilledSlots()) {
      const existing = map.get(slot.shiftNeeded.date) ?? [];
      map.set(slot.shiftNeeded.date, [...existing, slot]);
    }
    return map;
  });

  /** Employee-slots still "not yet scheduled" on the day being viewed (0 when the filter hides them). */
  protected readonly unscheduledToday = computed(() => {
    if (!this.showUnfilledSlots()) return 0;
    const slots = this.unfilledByDate().get(toDateKey(this.currentDate())) ?? [];
    return slots.reduce((sum, u) => sum + u.remaining, 0);
  });

  /** The calendar period on screen: month, week or day (other tabs count as the month). */
  private readonly periodMode = computed<'month' | 'week' | 'day'>(() => {
    const m = this.viewMode();
    return m === 'week' || m === 'day' ? m : 'month';
  });

  /** Shifts in the period being viewed, after filters — what the footer counts. */
  protected readonly visibleShifts = computed(() =>
    getVisibleShifts(this.filteredShifts(), this.currentDate(), this.periodMode()),
  );

  /**
   * What the footer's "filtered from N total" refers to: everything in the period being viewed
   * BEFORE filters — shifts plus employee-slots not yet scheduled (a slot is a shift you can see).
   */
  protected readonly periodTotals = computed(() => {
    const mode = this.periodMode();
    const date = this.currentDate();
    const slots = computeUnfilledSlots(this.allShiftsNeeded(), this.shiftsAndMarkers())
      .filter((u) => isDateInView(u.shiftNeeded.date, date, mode))
      .reduce((sum, u) => sum + u.remaining, 0);
    const shifts = getVisibleShifts(this.allShifts(), date, mode).length;
    return { shifts, slots, all: shifts + slots };
  });

  /** Employee-slots "not yet scheduled" in the period being viewed (0 when the filter hides them). */
  protected readonly unscheduledTotal = computed(() =>
    this.showUnfilledSlots()
      ? this.unfilledSlots()
          .filter((u) => isDateInView(u.shiftNeeded.date, this.currentDate(), this.periodMode()))
          .reduce((sum, u) => sum + u.remaining, 0)
      : 0,
  );

  /** Unfilled slots per date, for the phone month grid's red rings. Honors the status-chip filter. */
  protected override readonly unfilledCountByDate = computed(() => {
    if (!this.showUnfilledSlots()) return undefined;
    const counts = new Map<string, number>();
    for (const [date, slots] of this.unfilledByDate()) counts.set(date, slots.length);
    return counts;
  });

  // ── Feature #165: Availability view ──────────────────────────────────────────

  protected readonly DAYS_DISPLAY: { key: DayOfWeek; label: string }[] = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  /**
   * Employees who can be scheduled: everyone not disabled. The full `employees()` list stays
   * available so past shifts still show their (now disabled) employee's name.
   */
  protected readonly assignableEmployees = computed(() =>
    this.employees().filter((e) => e.status !== 'DISABLED'),
  );

  /** The Add/Edit Shift employee choices: active people, plus whoever is already on the shift. */
  protected readonly modalEmployeeOptions = computed(() =>
    this.employees().filter(
      (e) => e.status !== 'DISABLED' || e.employee_id === this.formEmployeeId(),
    ),
  );

  protected readonly availabilityRows = computed(() =>
    this.assignableEmployees().map((emp) => {
      const bundle = this.availabilityBundles().get(emp.employee_id);
      return { employee: emp, bundle: bundle ?? null };
    }),
  );

  /** One card per employee for the phone availability list (replaces the 560px matrix). */
  protected readonly availabilityCards = computed((): AvailabilityCard[] =>
    this.availabilityRows().map(({ employee, bundle }) => ({
      employeeId: employee.employee_id,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
      hasSchedule: !!bundle?.availability?.schedule,
      days: this.DAYS_DISPLAY.map(({ key, label }) => {
        const avail = this.dayAvailForEmployee(bundle, key);
        const slots = avail?.available ? (avail.slots ?? []) : [];
        return { key, label, letter: label[0], available: !!avail?.available, slots };
      }),
    })),
  );

  /** Employee ids whose phone availability card is open. */
  private readonly expandedAvailability = signal<ReadonlySet<string>>(new Set());

  protected isAvailabilityExpanded(employeeId: string): boolean {
    return this.expandedAvailability().has(employeeId);
  }

  protected toggleAvailability(employeeId: string): void {
    this.expandedAvailability.update((open) => {
      const next = new Set(open);
      if (!next.delete(employeeId)) next.add(employeeId);
      return next;
    });
  }

  protected readonly showUnavailableCandidates = signal(false);

  // ── Fill-shift tab ────────────────────────────────────────────────────────────

  protected readonly selectedUnfilledSlot = signal<UnfilledSlot | null>(null);
  /** Holds the existing Shift record when the Fill Shift view was opened from an amber (unassigned) chip. */
  protected readonly selectedEmptyShift = signal<Shift | null>(null);
  protected readonly fillShiftReturnMode = signal<Exclude<ViewMode, 'fill-shift'>>('month');
  protected readonly fillShiftSaving = signal(false);
  protected readonly fillShiftError = signal<string | null>(null);
  protected readonly fillShiftSuccess = signal<string | null>(null);

  protected readonly fillShiftRemaining = computed(() => {
    // When in existing-shift mode (amber chip), there is exactly 1 slot to fill.
    if (this.selectedEmptyShift()) return 1;
    const slot = this.selectedUnfilledSlot();
    if (!slot) return 0;
    const sn = slot.shiftNeeded;
    return Math.max(
      0,
      sn.employee_count -
        this.allShifts().filter(
          (s) =>
            s.date === sn.date &&
            s.location_id === sn.location_id &&
            s.start_time === sn.start_time &&
            s.end_time === sn.end_time,
        ).length,
    );
  });

  protected readonly fillShiftCandidates = computed(() => {
    const date = this.formDate();
    const start = this.formStartTime();
    const end = this.formEndTime();
    if (!date || !start || !end) return [];
    const shiftHours = shiftMinutes(start, end) / 60;
    return this.assignableEmployees()
      .map((emp) => {
        const bundle = this.availabilityBundles().get(emp.employee_id);
        const avail = effectiveDayAvail(
          date,
          bundle?.availability?.schedule,
          bundle?.overrides?.overrides,
        );
        const availableSlots = bundle?.availability?.schedule?.[dayOfWeek(date)]?.slots ?? null;
        const nextAvail = shiftCrossesMidnight(start, end)
          ? effectiveDayAvail(
              nextDateKey(date),
              bundle?.availability?.schedule,
              bundle?.overrides?.overrides,
            )
          : null;
        const available = isAvailableFor(avail, start, end, nextAvail);
        const weekHours = weeklyHoursForEmployee(emp.employee_id, date, this.allShifts());
        const wouldExceed = weekHours + shiftHours > 39;
        return { employee: emp, available, availableSlots, weekHours, wouldExceed };
      })
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.weekHours - b.weekHours;
      });
  });

  /** Who a Publish would reach: employees with a draft shift, and drafts still posted open. */
  protected readonly draftEmployeeCount = computed(
    () =>
      new Set(
        this.allShifts()
          .filter((s) => s.status === 'draft' && s.employee_id !== '')
          .map((s) => s.employee_id),
      ).size,
  );
  protected readonly draftOpenCount = computed(
    () => this.allShifts().filter((s) => s.status === 'draft' && s.employee_id === '').length,
  );

  protected readonly hasDrafts = computed(() => this.allShifts().some((s) => s.status === 'draft'));
  protected readonly draftCount = computed(
    () => this.allShifts().filter((s) => s.status === 'draft').length,
  );
  protected readonly publishedCount = computed(
    () => this.allShifts().filter((s) => s.status === 'published').length,
  );

  protected readonly viewLabel = computed(() =>
    buildViewLabel(this.currentDate(), this.viewMode() as 'day' | 'week' | 'month'),
  );

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    const month = toMonthKey(this.currentDate());
    forkJoin({
      shifts: this.shiftsService.list(month),
      employees: this.employeesService.getAll(),
      locations: this.locationsService.list(),
      shiftsNeeded: this.shiftsNeededService.list(month),
      meta: this.scheduleService.getMeta(month),
    }).subscribe({
      next: ({ shifts, employees, locations, shiftsNeeded, meta }) => {
        this.setShifts(shifts);
        this.employees.set(employees);
        this.locations.set(locations);
        this.allShiftsNeeded.set(shiftsNeeded);
        this.draftRunCount.set(meta.draftCount);
        this.openSlots.set(meta.openSlots);
        this.openShifts.set(meta.openShifts);
        this.maxDraftRuns.set(meta.maxDrafts);
        this.loading.set(false);
        this.loadAvailability(employees.map((e) => e.employee_id));
      },
      error: () => {
        this.error.set('Failed to load schedule. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private loadAvailability(employeeIds: string[]): void {
    this.availabilityService.getAllBundles(employeeIds).subscribe({
      next: (bundles) => this.availabilityBundles.set(bundles),
    });
  }

  protected override loadShifts(): void {
    const month = toMonthKey(this.currentDate());
    forkJoin({
      shifts: this.shiftsService.list(month),
      shiftsNeeded: this.shiftsNeededService.list(month),
      meta: this.scheduleService.getMeta(month),
    }).subscribe({
      next: ({ shifts, shiftsNeeded, meta }) => {
        this.setShifts(shifts);
        this.allShiftsNeeded.set(shiftsNeeded);
        this.draftRunCount.set(meta.draftCount);
        this.openSlots.set(meta.openSlots);
        this.openShifts.set(meta.openShifts);
        this.maxDraftRuns.set(meta.maxDrafts);
      },
      error: () => this.error.set('Failed to refresh shifts.'),
    });
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  protected openCreateModal(prefillDate?: string): void {
    this.editingShift.set(null);
    this.formDate.set(prefillDate ?? toDateKey(this.currentDate()));
    this.formEmployeeId.set('');
    // Never pick a location silently: preselect only when there is exactly one to choose.
    this.formLocationId.set(this.locations().length === 1 ? this.locations()[0].location_id : '');
    this.formStartTime.set('09:00');
    this.formEndTime.set('17:00');
    this.modalError.set(null);
    this.shiftSubmitted.set(false);
    this.modalOpen.set(true);
  }

  protected openFillShiftView(slot: UnfilledSlot): void {
    const sn = slot.shiftNeeded;
    this.selectedUnfilledSlot.set(slot);
    this.formDate.set(sn.date);
    this.formEmployeeId.set('');
    this.formLocationId.set(sn.location_id);
    this.formStartTime.set(sn.start_time);
    this.formEndTime.set(sn.end_time);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
    this.fillShiftReturnMode.set(
      this.viewMode() === 'fill-shift'
        ? this.fillShiftReturnMode()
        : (this.viewMode() as Exclude<ViewMode, 'fill-shift'>),
    );
    this.viewMode.set('fill-shift');
  }

  /**
   * Opens the Fill Shift view for an existing Shift record that has no assigned employee
   * (amber chip — scheduler ran but found no candidate, or shift was created without one).
   * Instead of creating a new Shift on assign, this path PATCHes the existing record.
   */
  protected openFillShiftViewForExistingShift(shift: Shift): void {
    this.selectedEmptyShift.set(shift);
    this.formDate.set(shift.date);
    this.formEmployeeId.set('');
    this.formLocationId.set(shift.location_id);
    this.formStartTime.set(shift.start_time);
    this.formEndTime.set(shift.end_time);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
    this.fillShiftReturnMode.set(
      this.viewMode() === 'fill-shift'
        ? this.fillShiftReturnMode()
        : (this.viewMode() as Exclude<ViewMode, 'fill-shift'>),
    );
    this.viewMode.set('fill-shift');
  }

  /** Edit the shift shown on the Fill Shift tab (the same modal as for an assigned shift). */
  protected editSelectedShift(): void {
    const shift = this.selectedEmptyShift();
    if (shift) this.openEditModal(shift);
  }

  // ── Delete a shift needed (from a "Not yet scheduled" slot's Fill Shift tab) ──
  /** The shift need awaiting a delete confirmation. Shifts already created from it are not removed. */
  protected readonly deletingNeed = signal<UnfilledSlot['shiftNeeded'] | null>(null);
  protected readonly deletingNeedBusy = signal(false);
  protected readonly deleteNeedError = signal<string | null>(null);

  protected requestDeleteNeed(): void {
    const slot = this.selectedUnfilledSlot();
    if (!slot) return;
    this.deleteNeedError.set(null);
    this.deletingNeed.set(slot.shiftNeeded);
  }

  protected cancelDeleteNeed(): void {
    this.deletingNeed.set(null);
  }

  protected confirmDeleteNeed(): void {
    const need = this.deletingNeed();
    if (!need) return;
    this.deletingNeedBusy.set(true);
    this.deleteNeedError.set(null);
    this.shiftsNeededService.remove(need.shift_id).subscribe({
      next: () => {
        this.deletingNeedBusy.set(false);
        this.deletingNeed.set(null);
        this.allShiftsNeeded.update((list) => list.filter((n) => n.shift_id !== need.shift_id));
        this.closeFillShiftView();
      },
      error: () => {
        this.deletingNeedBusy.set(false);
        this.deleteNeedError.set('Failed to delete the shift needed. Please try again.');
      },
    });
  }

  /** Delete the shift shown on the Fill Shift tab — opens the delete dialog directly. */
  protected deleteSelectedShift(): void {
    this.requestDeleteShift(this.selectedEmptyShift());
  }

  /**
   * What to call a shift with no employee. A published one is an OPEN shift (visible to employees,
   * waiting for someone); a draft is an unpublished open shift; a `draft_failed` sentinel is a slot
   * the scheduler couldn't fill. It must never read "Draft" for a published shift.
   */
  protected openShiftLabel(shift: Shift): string {
    if (shift.status === 'draft_failed') return 'Unfilled — no employee available';
    if (shift.status === 'draft') return 'Draft open shift — no employee assigned';
    return 'Open shift — no employee assigned';
  }

  protected closeFillShiftView(): void {
    this.viewMode.set(this.fillShiftReturnMode());
    this.selectedUnfilledSlot.set(null);
    // Clear existing-shift state so fill view resets on next open.
    this.selectedEmptyShift.set(null);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
  }

  protected assignFromFillView(employeeId: string): void {
    // When an amber (unassigned) Shift record was clicked, PATCH it instead of creating a new one.
    const emptyShift = this.selectedEmptyShift();
    if (emptyShift) {
      this.fillShiftSaving.set(true);
      this.fillShiftError.set(null);
      this.fillShiftSuccess.set(null);
      this.shiftsService.update(emptyShift.shift_id, { employee_id: employeeId }).subscribe({
        next: (updated) => {
          this.fillShiftSaving.set(false);
          // Replace the old unassigned record in-memory with the updated one.
          this.allShifts.update((s) =>
            s.map((sh) => (sh.shift_id === updated.shift_id ? updated : sh)),
          );
          this.closeFillShiftView();
        },
        error: (err: { error?: { message?: string } }) => {
          this.fillShiftSaving.set(false);
          this.fillShiftError.set(err?.error?.message ?? 'Failed to assign employee');
        },
      });
      return;
    }

    // ShiftNeeded (red chip) path — create a new Shift record for the unfilled slot.
    const sn = this.selectedUnfilledSlot()?.shiftNeeded;
    if (!sn) return;
    this.fillShiftSaving.set(true);
    this.fillShiftError.set(null);
    this.fillShiftSuccess.set(null);
    const body: CreateShiftBody = {
      employee_id: employeeId,
      location_id: sn.location_id,
      date: sn.date,
      start_time: sn.start_time,
      end_time: sn.end_time,
    };
    this.shiftsService.create(body).subscribe({
      next: (shift) => {
        this.fillShiftSaving.set(false);
        this.allShifts.update((s) => [...s, shift]);
        const emp = this.employees().find((e) => e.employee_id === employeeId);
        const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
        if (this.fillShiftRemaining() === 0) {
          this.closeFillShiftView();
        } else {
          this.fillShiftSuccess.set(
            `${name} assigned. ${this.fillShiftRemaining()} slot${this.fillShiftRemaining() === 1 ? '' : 's'} remaining.`,
          );
        }
      },
      error: () => {
        this.fillShiftSaving.set(false);
        this.fillShiftError.set('Failed to assign shift. Please try again.');
      },
    });
  }

  protected openEditModal(shift: Shift): void {
    this.editingShift.set(shift);
    this.formDate.set(shift.date);
    this.formEmployeeId.set(shift.employee_id);
    this.formLocationId.set(shift.location_id);
    this.formStartTime.set(shift.start_time);
    this.formEndTime.set(shift.end_time);
    this.modalError.set(null);
    this.shiftSubmitted.set(false);
    this.modalOpen.set(true);
  }

  /**
   * Routes a shift-chip click to the correct action based on assignment state.
   * Amber shifts (employee_id === '') open the Fill Shift view so the manager can
   * pick an employee from the availability/OT-risk list. Assigned shifts open the
   * standard edit modal so the manager can update times, location, or delete.
   */
  protected openShiftAction(shift: Shift): void {
    if (shift.employee_id === '') {
      this.openFillShiftViewForExistingShift(shift);
    } else {
      this.openEditModal(shift);
    }
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected saveShift(): void {
    this.shiftSubmitted.set(true);
    if (Object.keys(this.validateShiftForm()).length > 0) {
      this.modalError.set(null);
      return;
    }

    // No employee selected = an open shift (create) / un-assign (edit).
    const body: CreateShiftBody = {
      ...(this.formEmployeeId() ? { employee_id: this.formEmployeeId() } : {}),
      location_id: this.formLocationId(),
      date: this.formDate(),
      start_time: this.formStartTime(),
      end_time: this.formEndTime(),
    };

    this.modalSaving.set(true);
    this.modalError.set(null);

    const editing = this.editingShift();
    const request = editing
      ? this.shiftsService.update(editing.shift_id, { ...body, employee_id: this.formEmployeeId() })
      : this.shiftsService.create(body);

    request.subscribe({
      next: () => {
        this.modalOpen.set(false);
        this.modalSaving.set(false);
        // Saved from the Fill Shift tab: the shift it was showing has changed, so go back.
        if (this.viewMode() === 'fill-shift') this.closeFillShiftView();
        this.loadShifts();
      },
      error: () => {
        this.modalError.set('Failed to save shift. Please try again.');
        this.modalSaving.set(false);
      },
    });
  }

  /** True when the form's location is one of the manager's current locations. */
  protected readonly locationKnown = computed(() =>
    this.locations().some((l) => l.location_id === this.formLocationId()),
  );

  private validateShiftForm(): Partial<Record<ShiftField, string>> {
    const errors: Partial<Record<ShiftField, string>> = {};
    if (!this.formDate()) errors.date = 'Date is required.';
    if (!this.formLocationId()) errors.location = 'Location is required.';
    if (!this.formStartTime()) errors.start = 'Start time is required.';
    if (!this.formEndTime()) errors.end = 'End time is required.';
    else if (this.formStartTime() && this.formEndTime() === this.formStartTime())
      errors.end = 'End time must be different from the start time.';
    return errors;
  }

  // ── Delete a shift ───────────────────────────────────────────────────────────
  // A dialog of its own (not a panel inside the edit modal): Cancel just closes it, wherever the
  // delete was started from — it never drops you into the edit form.

  /** The shift awaiting a delete confirmation, or null. */
  protected readonly deletingShift = signal<Shift | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  /** Ask to delete a shift. Closes the edit modal first if the request came from there. */
  protected requestDeleteShift(shift: Shift | null): void {
    if (!shift) return;
    this.modalOpen.set(false);
    this.deleteError.set(null);
    this.deletingShift.set(shift);
  }

  protected cancelDeleteShift(): void {
    this.deletingShift.set(null);
  }

  protected confirmDeleteShift(): void {
    const shift = this.deletingShift();
    if (!shift) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.shiftsService.remove(shift.shift_id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deletingShift.set(null);
        this.allShifts.update((shifts) => shifts.filter((s) => s.shift_id !== shift.shift_id));
        if (this.viewMode() === 'fill-shift') this.closeFillShiftView();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('Failed to delete shift. Please try again.');
      },
    });
  }

  // ── Generate / Publish ───────────────────────────────────────────────────────

  protected readonly showGenerateConfirm = signal(false);
  /** Drives the status dialog: it stays up (undismissable while processing) until accepted. */
  protected readonly draftStatus = signal<GenerateDraftStatus>('idle');
  /** Open employee-slots a Generate Draft run would try to fill this month; null until known. */
  protected readonly openSlots = signal<number | null>(null);
  /** Open shifts (no employee) this month — shown, never generated. */
  protected readonly openShifts = signal<number | null>(null);
  protected readonly showPublishConfirm = signal(false);

  protected readonly monthLabel = computed(() =>
    this.currentDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );

  protected acceptDraftResult(): void {
    this.draftStatus.set('idle');
  }

  /** Step 1: explain what a run does (and what it costs) before spending one. */
  protected requestGenerate(): void {
    this.showGenerateConfirm.set(true);
  }

  protected cancelGenerate(): void {
    this.showGenerateConfirm.set(false);
  }

  protected generateDraft(): void {
    this.showGenerateConfirm.set(false);
    this.generating.set(true);
    this.draftStatus.set('processing');
    this.scheduleActionResult.set(null);
    const month = toMonthKey(this.currentDate());
    this.scheduleService.generateDraft(month).subscribe({
      next: (result) => {
        this.generating.set(false);
        this.draftRunCount.set(result.draftCount);
        this.maxDraftRuns.set(result.maxDrafts);
        this.openSlots.set(result.unfilled);
        this.openShifts.set(result.openShifts);
        let msg = generateDraftMessage(result, { monthLabel: this.monthLabel() });
        if (result.openSlots !== 0) {
          const remaining = result.maxDrafts - result.draftCount;
          msg += ` ${remaining} run${remaining === 1 ? '' : 's'} remaining.`;
        }
        this.scheduleActionResult.set(msg);
        this.draftStatus.set('success');
        this.loadShifts();
      },
      error: (err) => {
        this.generating.set(false);
        this.draftStatus.set('failure');
        const detail = err?.error?.message as string | undefined;
        this.scheduleActionResult.set(
          detail?.includes('Maximum')
            ? detail
            : 'Failed to generate draft schedule. Please try again.',
        );
      },
    });
  }

  /** Step 1: ask before publishing — drafts become visible to the manager's employees. */
  protected requestPublish(): void {
    if (this.draftCount() === 0) {
      this.scheduleActionResult.set(noDraftsToPublishMessage({ monthLabel: this.monthLabel() }));
      return;
    }
    this.showPublishConfirm.set(true);
  }

  protected cancelPublish(): void {
    this.showPublishConfirm.set(false);
  }

  protected publishSchedule(): void {
    this.showPublishConfirm.set(false);
    this.publishing.set(true);
    this.scheduleActionResult.set(null);
    const month = toMonthKey(this.currentDate());
    this.scheduleService.publish(month).subscribe({
      next: (result) => {
        this.publishing.set(false);
        this.scheduleActionResult.set(publishedMessage(result.published));
        this.loadShifts();
      },
      error: () => {
        this.publishing.set(false);
        this.scheduleActionResult.set('Failed to publish schedule. Please try again.');
      },
    });
  }

  protected toDateKey(d: Date): string {
    return toDateKey(d);
  }

  // ── Availability view helpers ────────────────────────────────────────────────

  protected dayAvailForEmployee(
    bundle: EmployeeAvailabilityBundle | null,
    dayKey: DayOfWeek,
  ): DayAvailability | null {
    return bundle?.availability?.schedule?.[dayKey] ?? null;
  }
}
