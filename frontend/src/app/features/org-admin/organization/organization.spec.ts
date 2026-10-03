import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrgAdminOrganizationComponent } from './organization';
import { OrgAdminOrganizationService } from './organization.service';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

const ORG = { org_id: 'o1', name: 'YMCA', address: 'Meriden,CT,06489' };

async function setup() {
  const service = {
    get: vi.fn().mockReturnValue(of(ORG)),
    update: vi.fn().mockImplementation((b) => of({ ...ORG, ...b })),
  };
  await TestBed.configureTestingModule({
    imports: [OrgAdminOrganizationComponent],
    providers: [...APP_TEST_PROVIDERS, { provide: OrgAdminOrganizationService, useValue: service }],
  }).compileComponents();
  const fixture = TestBed.createComponent(OrgAdminOrganizationComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const q = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  const typeInto = (id: string, v: string) => {
    const el = q(id) as HTMLInputElement;
    el.value = v;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (id: string) => {
    ((q(id).querySelector('button') ?? q(id)) as HTMLElement).click();
    fixture.detectChanges();
  };
  return { service, q, typeInto, click };
}

describe('OrgAdminOrganizationComponent — address', () => {
  it('displays a legacy unspaced address with proper spacing', async () => {
    const { q } = await setup();
    expect(q('org-address').textContent).toContain('Meriden, CT 06489');
  });

  it('splits the stored address into street, city, state and ZIP inputs when editing', async () => {
    const { q, click } = await setup();
    click('edit-btn');
    expect((q('edit-street-input') as HTMLInputElement).value).toBe('');
    expect((q('edit-city-input') as HTMLInputElement).value).toBe('Meriden');
    expect((q('edit-state-input') as HTMLInputElement).value).toBe('CT');
    expect((q('edit-zip-input') as HTMLInputElement).value).toBe('06489');
  });

  it('does not require a street: a legacy org can still be renamed', async () => {
    const { q, click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-name-input', 'YMCA of Meriden');
    click('save-btn');
    expect(q('street-error')).toBeNull();
    expect(service.update).toHaveBeenCalledTimes(1);
  });

  it('a name-only change sends no address, so the stored address is untouched', async () => {
    const { click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-name-input', 'YMCA of Meriden');
    click('save-btn');
    expect(service.update).toHaveBeenCalledWith({ name: 'YMCA of Meriden' });
  });

  it('keeps the city, 2-letter state and 5-digit ZIP checks once the address is edited', async () => {
    const { q, click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-city-input', '');
    typeInto('edit-state-input', 'C');
    typeInto('edit-zip-input', '1234');
    click('save-btn');
    expect(service.update).not.toHaveBeenCalled();
    expect(q('city-error').textContent).toContain('City is required');
    expect(q('state-error').textContent).toContain('Use a 2-letter state');
    expect(q('zip-error').textContent).toContain('Use a 5-digit ZIP');
  });

  it('rejects a well-formed but non-existent state code such as ZZ', async () => {
    const { q, click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-state-input', 'ZZ');
    click('save-btn');
    expect(service.update).not.toHaveBeenCalled();
    expect(q('state-error').textContent).toContain('US state or territory');
  });

  it('accepts territories and lower-case input', async () => {
    const { click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-state-input', 'pr');
    click('save-btn');
    expect(service.update).toHaveBeenCalledWith({ name: 'YMCA', address: 'Meriden, PR 06489' });
  });

  it('saves the parts composed as "street, city, ST ZIP"', async () => {
    const { q, click, typeInto, service } = await setup();
    click('edit-btn');
    typeInto('edit-street-input', '12 Main St');
    click('save-btn');
    expect(service.update).toHaveBeenCalledWith({
      name: 'YMCA',
      address: '12 Main St, Meriden, CT 06489',
    });
    expect(q('org-address').textContent).toContain('12 Main St, Meriden, CT 06489');
  });
});
