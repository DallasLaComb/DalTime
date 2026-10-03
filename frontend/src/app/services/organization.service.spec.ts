import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrganizationService } from './organization.service';
import { environment } from '../../environments/environment';

const API_BASE = `${environment.api.baseUrl}/organizations`;

const mockOrg = {
  org_id: 'org-123',
  name: 'Acme Corp',
  address: '123 Main St',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  org_admin_count: 0,
};

describe('OrganizationService', () => {
  let service: OrganizationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [OrganizationService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrganizationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll()', () => {
    it('sends GET to /organizations and returns organization array', () => {
      const orgs = [mockOrg];
      service.getAll().subscribe((result) => {
        expect(result).toEqual(orgs);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('GET');
      req.flush(orgs);
    });
  });

  describe('getById()', () => {
    it('sends GET to /organizations/{orgId} and returns a single organization', () => {
      service.getById('org-123').subscribe((result) => {
        expect(result).toEqual(mockOrg);
      });

      const req = httpMock.expectOne(`${API_BASE}/org-123`);
      expect(req.request.method).toBe('GET');
      req.flush(mockOrg);
    });
  });

  describe('create()', () => {
    it('sends POST to /organizations with the request body and returns created organization', () => {
      const body = { name: 'Acme Corp', address: '123 Main St' };

      service.create(body).subscribe((result) => {
        expect(result).toEqual(mockOrg);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(mockOrg);
    });
  });

  describe('update()', () => {
    it('sends PUT to /organizations/{orgId} with the request body and returns updated organization', () => {
      const body = { name: 'Updated Name' };
      const updated = { ...mockOrg, name: 'Updated Name' };

      service.update('org-123', body).subscribe((result) => {
        expect(result).toEqual(updated);
      });

      const req = httpMock.expectOne(`${API_BASE}/org-123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(updated);
    });
  });

  describe('delete()', () => {
    it('sends DELETE to /organizations/{orgId}', () => {
      service.delete('org-123').subscribe();

      const req = httpMock.expectOne(`${API_BASE}/org-123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
