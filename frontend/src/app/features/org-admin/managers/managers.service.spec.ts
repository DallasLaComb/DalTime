import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ManagersService } from './managers.service';

const API_BASE = 'http://localhost:3000/org-admin/managers';

const mockManager = {
  manager_id: 'mgr-123',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@acme.com',
  phone: '555-1234',
  org_id: 'org-123',
  org_admin_id: 'admin-123',
  status: 'FORCE_CHANGE_PASSWORD',
  employee_count: 0,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

describe('ManagersService', () => {
  let service: ManagersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ManagersService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManagersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll()', () => {
    it('sends GET to /org-admin/managers and returns manager array', () => {
      service.getAll().subscribe((result) => {
        expect(result).toEqual([mockManager]);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('GET');
      req.flush([mockManager]);
    });
  });

  describe('create()', () => {
    it('sends POST to /org-admin/managers with the request body and returns created manager', () => {
      const body = { first_name: 'John', last_name: 'Doe', email: 'john@acme.com', temp_password: 'Temp@1234' };

      service.create(body).subscribe((result) => {
        expect(result).toEqual(mockManager);
      });

      const req = httpMock.expectOne(API_BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(mockManager);
    });
  });

  describe('update()', () => {
    it('sends PUT to /org-admin/managers/{managerId} with the request body and returns updated manager', () => {
      const body = { first_name: 'Jane' };
      const updated = { ...mockManager, first_name: 'Jane' };

      service.update('mgr-123', body).subscribe((result) => {
        expect(result).toEqual(updated);
      });

      const req = httpMock.expectOne(`${API_BASE}/mgr-123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(updated);
    });
  });

  describe('disable()', () => {
    it('sends DELETE to /org-admin/managers/{managerId}', () => {
      service.disable('mgr-123').subscribe();

      const req = httpMock.expectOne(`${API_BASE}/mgr-123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
