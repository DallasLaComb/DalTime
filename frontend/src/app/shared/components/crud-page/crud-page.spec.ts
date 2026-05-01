import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrudPageComponent } from './crud-page';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

@Component({
  imports: [CrudPageComponent],
  template: `
    <app-crud-page
      [title]="title()"
      [actionLabel]="actionLabel()"
      [loading]="loading()"
      [error]="error()"
      [empty]="empty()"
      [emptyTitle]="emptyTitle()"
      [emptyDescription]="emptyDescription()"
      (action)="actionFired = true"
      (retry)="retryFired = true"
    >
      <a slot="before-title" data-testid="back-link">← Back</a>
      <div data-testid="content">Table goes here</div>
      <div slot="modals" data-testid="modals">Modal goes here</div>
    </app-crud-page>
  `,
})
class TestHost {
  title = signal('Items');
  actionLabel = signal('+ Add');
  loading = signal(false);
  error = signal<string | null>(null);
  empty = signal(false);
  emptyTitle = signal('No items');
  emptyDescription = signal('Add one.');
  actionFired = false;
  retryFired = false;
}

function query<T extends HTMLElement>(fixture: ComponentFixture<unknown>, testid: string): T {
  return fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as T;
}

describe('CrudPageComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: APP_TEST_PROVIDERS,
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('renders page header with title and action button', async () => {
    await createComponent();

    expect(fixture.nativeElement.textContent).toContain('Items');
    expect(query(fixture, 'page-header-action')).toBeTruthy();
  });

  it('emits action when page header button is clicked', async () => {
    await createComponent();

    query<HTMLButtonElement>(fixture, 'page-header-action').click();
    expect(host.actionFired).toBe(true);
  });

  it('shows loading spinner when loading is true', async () => {
    await createComponent();
    host.loading.set(true);
    fixture.detectChanges();

    expect(query(fixture, 'loading-spinner')).toBeTruthy();
    expect(query(fixture, 'content')).toBeNull();
  });

  it('shows error alert when error is set', async () => {
    await createComponent();
    host.error.set('Something broke');
    fixture.detectChanges();

    expect(query(fixture, 'error-alert')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Something broke');
  });

  it('emits retry when error retry is clicked', async () => {
    await createComponent();
    host.error.set('fail');
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, 'error-alert-retry').click();
    expect(host.retryFired).toBe(true);
  });

  it('shows empty state when empty is true', async () => {
    await createComponent();
    host.empty.set(true);
    fixture.detectChanges();

    expect(query(fixture, 'empty-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('No items');
  });

  it('projects content when not loading, no error, and not empty', async () => {
    await createComponent();

    expect(query(fixture, 'content')).toBeTruthy();
    expect(query(fixture, 'content').textContent).toContain('Table goes here');
  });

  it('projects modal content outside the container', async () => {
    await createComponent();

    expect(query(fixture, 'modals')).toBeTruthy();
  });

  it('projects before-title slot into page header', async () => {
    await createComponent();

    expect(query(fixture, 'back-link')).toBeTruthy();
    expect(query(fixture, 'back-link').textContent).toContain('← Back');
  });

  it('has dt-debug class on container', async () => {
    await createComponent();

    const container = fixture.nativeElement.querySelector('.container-fluid');
    expect(container.classList.contains('dt-debug')).toBe(true);
  });
});
