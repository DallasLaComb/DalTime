import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrgAdminLocationsService } from './locations.service';
import { environment } from '../../../../environments/environment';

const API_BASE = `${environment.api.baseUrl}/org-admin/locations`;

const mockLocation = {
  location_id: 'loc-123',
  org_id: 'org-123',
  name: 'Main Office',
  address: '123 Main St',
  created_by: 'user-123',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('OrgAdminLocationsService', () => {
  let service: OrgAdminLocationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [OrgAdminLocationsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrgAdminLocationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getAll()', () => {
    it('sends GET to /org-admin/locations and returns location array', () => {
      service.getAll().subscribe((result) => {
        expect(result).toEqual([mockLocation]);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('GET');
      req.flush([mockLocation]);
    });
  });

  describe('create()', () => {
    it('sends POST to /org-admin/locations with body and returns created location', () => {
      const body = { name: 'Main Office', address: '123 Main St' };

      service.create(body).subscribe((result) => {
        expect(result).toEqual(mockLocation);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(mockLocation);
    });
  });

  describe('update()', () => {
    it('sends PUT to /org-admin/locations/{locationId} with body and returns updated location', () => {
      const body = { name: 'Updated Office' };
      const updated = { ...mockLocation, name: 'Updated Office' };

      service.update('loc-123', body).subscribe((result) => {
        expect(result).toEqual(updated);
      });

      const req = httpMock.expectOne(`${API_BASE}/loc-123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(updated);
    });
  });

  describe('remove()', () => {
    it('sends DELETE to /org-admin/locations/{locationId}', () => {
      service.remove('loc-123').subscribe();

      const req = httpMock.expectOne(`${API_BASE}/loc-123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 200, statusText: 'OK' });
    });
  });
});
