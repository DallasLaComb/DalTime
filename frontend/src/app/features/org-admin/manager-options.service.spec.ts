import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { OrgAdminManagerOptionsService } from './manager-options.service';
import { ProfileService } from './profile/profile.service';

function setup(profileName: string | null) {
  const profile = { get: vi.fn().mockReturnValue(of({ name: profileName })) };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: {
          userSub: signal('admin-1'),
          firstName: signal('Cog'),
          lastName: signal('Nito'),
        },
      },
      { provide: ImpersonationService, useValue: { viewingAs: signal(null) } },
      { provide: ProfileService, useValue: profile },
    ],
  });
  return { svc: TestBed.inject(OrgAdminManagerOptionsService), profile };
}

const label = (o: { first_name: string; last_name: string } | null) =>
  `${o!.first_name} ${o!.last_name}`;

describe('OrgAdminManagerOptionsService — one display name', () => {
  it('labels the admin with their profile name plus a single "(you)"', () => {
    const { svc } = setup('Dev Admin');
    svc.self();
    expect(label(svc.self())).toBe('Dev Admin (you)');
  });

  it('falls back to the Cognito name until/unless the profile name is known', () => {
    const { svc } = setup(null);
    expect(label(svc.self())).toBe('Cog Nito (you)');
  });

  it('updates immediately when the profile name is edited', () => {
    const { svc } = setup('Dev Admin');
    svc.self();
    svc.setProfileName('Dana Admin');
    expect(label(svc.self())).toBe('Dana Admin (you)');
  });

  it('loads the profile only once', () => {
    const { svc, profile } = setup('Dev Admin');
    svc.self();
    svc.self();
    expect(profile.get).toHaveBeenCalledTimes(1);
  });
});
