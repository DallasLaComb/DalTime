import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { APP_TEST_PROVIDERS } from '../../../test-setup';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: APP_TEST_PROVIDERS,
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
