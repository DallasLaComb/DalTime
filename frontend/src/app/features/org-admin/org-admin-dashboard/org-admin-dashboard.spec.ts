import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrgAdminDashboard } from './org-admin-dashboard';

describe('OrgAdminDashboard', () => {
  let component: OrgAdminDashboard;
  let fixture: ComponentFixture<OrgAdminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgAdminDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrgAdminDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
