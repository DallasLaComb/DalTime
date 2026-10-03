import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { viewModeInterceptor } from './view-mode.interceptor';
import { ViewModeService } from '../services/view-mode.service';
import { environment } from '../../../environments/environment';

const BASE = environment.api.baseUrl;

describe('viewModeInterceptor', () => {
  const managerMode = signal(false);
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    managerMode.set(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([viewModeInterceptor])),
        provideHttpClientTesting(),
        { provide: ViewModeService, useValue: { managerMode } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('asks to act as a manager on /manager routes while in Manager view', () => {
    managerMode.set(true);
    http.get(`${BASE}/manager/shifts`).subscribe();
    const req = httpMock.expectOne(`${BASE}/manager/shifts`);
    expect(req.request.headers.get('X-View-As')).toBe('manager');
    req.flush([]);
  });

  it('adds nothing in Org Admin view', () => {
    http.get(`${BASE}/manager/shifts`).subscribe();
    const req = httpMock.expectOne(`${BASE}/manager/shifts`);
    expect(req.request.headers.has('X-View-As')).toBe(false);
    req.flush([]);
  });

  it.each(['/org-admin/shifts', '/employee/schedule', '/shared/client-logs'])(
    'leaves %s alone even in Manager view',
    (path) => {
      managerMode.set(true);
      http.get(`${BASE}${path}`).subscribe();
      const req = httpMock.expectOne(`${BASE}${path}`);
      expect(req.request.headers.has('X-View-As')).toBe(false);
      req.flush([]);
    },
  );

  it('never adds the header to a third-party request', () => {
    managerMode.set(true);
    http.get('https://example.com/manager/x').subscribe();
    const req = httpMock.expectOne('https://example.com/manager/x');
    expect(req.request.headers.has('X-View-As')).toBe(false);
    req.flush({});
  });
});
