import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table';
import { ColumnDef } from './column-def.model';

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  return fixture.nativeElement.querySelector(selector) as T;
}

function queryAll<T extends HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string
): T[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
}

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent<unknown>>;

  const testColumns: ColumnDef[] = [
    { header: 'Name' },
    { header: 'Email', cssClass: 'd-none d-xl-table-cell' },
    { header: 'Status' },
  ];

  async function createComponent(columns: ColumnDef[] = testColumns) {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('trackBy', (_index: number, item: unknown) => item);
    fixture.detectChanges();
  }

  // ─── Column headers ─────────────────────────────────────────────────────────

  it('renders column headers from ColumnDef array', async () => {
    await createComponent();

    const headers = queryAll<HTMLElement>(fixture, 'th');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent?.trim()).toBe('Name');
    expect(headers[1].textContent?.trim()).toBe('Email');
    expect(headers[2].textContent?.trim()).toBe('Status');
  });

  // ─── cssClass on th elements ────────────────────────────────────────────────

  it('applies cssClass to th elements', async () => {
    await createComponent();

    const headers = queryAll<HTMLElement>(fixture, 'th');
    expect(headers[1].classList.contains('d-none')).toBe(true);
    expect(headers[1].classList.contains('d-xl-table-cell')).toBe(true);
  });

  it('does not apply extra classes to th elements without cssClass', async () => {
    await createComponent([{ header: 'Solo' }]);

    const header = query<HTMLElement>(fixture, 'th');
    // The class attribute should be empty or not set when no cssClass is provided
    expect(header.className.trim()).toBe('');
  });

  // ─── table-responsive wrapper ───────────────────────────────────────────────

  it('wraps the table in a table-responsive container', async () => {
    await createComponent();

    const responsive = query<HTMLElement>(fixture, '.table-responsive');
    expect(responsive).toBeTruthy();

    const table = responsive.querySelector('table');
    expect(table).toBeTruthy();
  });

  // ─── d-none d-lg-block on outer div ─────────────────────────────────────────

  it('has d-none d-lg-block on the outer div', async () => {
    await createComponent();

    const outerDiv = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(outerDiv.classList.contains('d-none')).toBe(true);
    expect(outerDiv.classList.contains('d-lg-block')).toBe(true);
  });

  // ─── Table classes ──────────────────────────────────────────────────────────

  it('applies table table-hover align-middle classes on the table element', async () => {
    await createComponent();

    const table = query<HTMLElement>(fixture, 'table');
    expect(table.classList.contains('table')).toBe(true);
    expect(table.classList.contains('table-hover')).toBe(true);
    expect(table.classList.contains('align-middle')).toBe(true);
  });

  it('has thead element for column headers', async () => {
    await createComponent();

    const thead = query<HTMLElement>(fixture, 'thead');
    expect(thead).toBeTruthy();
  });
});
