import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrgAdminOverviewService } from './overview.service';
import { environment } from '../../../../environments/environment';

describe('OrgAdminOverviewService', () => {
  it('GETs /org-admin/overview', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);

    TestBed.inject(OrgAdminOverviewService).get().subscribe();

    const req = http.expectOne(`${environment.api.baseUrl}/org-admin/overview`);
    expect(req.request.method).toBe('GET');
    req.flush({});
    http.verify();
  });
});
