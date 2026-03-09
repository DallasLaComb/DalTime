import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagerDashboard } from './manager-dashboard';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

describe('ManagerDashboard', () => {
  let component: ManagerDashboard;
  let fixture: ComponentFixture<ManagerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerDashboard],
      providers: APP_TEST_PROVIDERS,
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
