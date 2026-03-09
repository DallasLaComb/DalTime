import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebAdminDashboard } from './web-admin-dashboard';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

describe('WebAdminDashboard', () => {
  let component: WebAdminDashboard;
  let fixture: ComponentFixture<WebAdminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebAdminDashboard],
      providers: APP_TEST_PROVIDERS,
    }).compileComponents();

    fixture = TestBed.createComponent(WebAdminDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
