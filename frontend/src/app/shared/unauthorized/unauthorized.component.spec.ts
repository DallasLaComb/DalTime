import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth';
import type { UserRole } from '../../core/auth/user-role.model';
import { APP_TEST_PROVIDERS } from '../../../test-setup';
import { UnauthorizedComponent } from './unauthorized.component';

async function render(role: UserRole | null) {
  await TestBed.configureTestingModule({
    imports: [UnauthorizedComponent],
    providers: [
      ...APP_TEST_PROVIDERS,
      { provide: AuthService, useValue: { roleSignal: signal(role) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(UnauthorizedComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UnauthorizedComponent', () => {
  it('shows a friendly role label, never the raw enum value', async () => {
    const el = await render('OrgAdmin');
    expect(el.textContent).toContain('Organization Admin');
    expect(el.textContent).not.toContain('OrgAdmin');
  });

  it('is styled like the 404 page: logo, heading and a Back to Dashboard button', async () => {
    const el = await render('Employee');
    expect(el.querySelector('img[alt="DalTime"]')).toBeTruthy();
    expect(el.querySelector('h1')!.textContent).toContain('Access Denied');
    expect(el.querySelector('button')!.textContent).toContain('Back to Dashboard');
  });

  it('asks the user to contact an administrator when no role is assigned', async () => {
    const el = await render(null);
    expect(el.textContent).toContain('contact your administrator');
    expect(el.querySelector('button')).toBeNull();
  });
});
