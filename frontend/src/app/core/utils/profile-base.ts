import { inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import type { ProfileData, UpdateProfileData } from '@common-daltime';

export interface IProfileService {
  get(): Observable<ProfileData>;
  update(body: UpdateProfileData): Observable<ProfileData>;
}

export abstract class ProfileComponentBase {
  protected abstract readonly profileService: IProfileService;
  protected abstract readonly dashboardRoute: string;

  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profileData = signal<ProfileData | null>(null);
  readonly saving = signal(false);
  readonly saveSuccess = signal(false);
  readonly saveError = signal<string | null>(null);

  protected init(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.profileService.get().subscribe({
      next: (profile: ProfileData) => {
        this.profileData.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load profile');
        this.loading.set(false);
      },
    });
  }

  onStartedEditing(): void {
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  handleSave(body: UpdateProfileData): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.profileService.update(body).subscribe({
      next: (updated: ProfileData) => {
        this.profileData.set(updated);
        this.saving.set(false);
        this.saveSuccess.set(true);
      },
      error: (err: { error?: { error?: string } }) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error ?? 'Failed to save profile');
      },
    });
  }

  goToDashboard(): void {
    void this.router.navigate([this.dashboardRoute]);
  }
}
