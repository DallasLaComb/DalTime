# Implementation Plan: Reusable Components Library

## Overview

Build a shared component library at `frontend/src/app/shared/components/` containing nine standalone Angular 21 components (LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DataTable, CardList, ConfirmationModal, StatusBadge, SearchBar), a barrel export, and an AI steering file. Each component uses signal-based inputs/outputs, `ChangeDetectionStrategy.OnPush`, and Bootstrap 5.3 utility classes. Components are implemented incrementally, starting with simple leaf components and building toward more complex ones, with tests alongside each component.

## Tasks

- [x] 1. Project setup and simple display components
  - [x] 1.1 Install fast-check as a dev dependency in the frontend project
    - Run `npm install --save-dev fast-check` in the `frontend/` directory
    - _Requirements: Design Testing Strategy_

  - [x] 1.2 Create LoadingSpinnerComponent
    - Create `frontend/src/app/shared/components/loading-spinner/loading-spinner.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-loading-spinner`
    - Signal input: `label` (optional, defaults to `'Loading...'`)
    - Template: centered `spinner-border text-secondary` with `role="status"`, visually-hidden label, `data-testid="loading-spinner"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1_

  - [x] 1.3 Write unit tests for LoadingSpinnerComponent
    - Create `frontend/src/app/shared/components/loading-spinner/loading-spinner.spec.ts`
    - Test: renders with default label "Loading...", renders with custom label, has correct CSS classes (`text-center py-5`, `spinner-border text-secondary`), has `role="status"` and `data-testid="loading-spinner"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1_

  - [x] 1.4 Create ErrorAlertComponent
    - Create `frontend/src/app/shared/components/error-alert/error-alert.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-error-alert`
    - Signal inputs: `message` (required), `retryable` (optional, defaults to `false`)
    - Output: `retry`
    - Template: Bootstrap danger alert with responsive flex layout, conditional retry button, `role="alert"`, `data-testid="error-alert"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 11.2_

  - [x] 1.5 Write unit tests for ErrorAlertComponent
    - Create `frontend/src/app/shared/components/error-alert/error-alert.spec.ts`
    - Test: renders message, shows retry button when `retryable=true`, hides retry button when `retryable=false`, emits `retry` on click, has `role="alert"` and `data-testid="error-alert"`, has correct flex layout classes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 11.2_

  - [x] 1.6 Create EmptyStateComponent
    - Create `frontend/src/app/shared/components/empty-state/empty-state.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-empty-state`
    - Signal inputs: `title` (required), `description` (required)
    - Template: centered muted container with `fs-5 mb-1` title, `data-testid="empty-state"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.7 Write unit tests for EmptyStateComponent
    - Create `frontend/src/app/shared/components/empty-state/empty-state.spec.ts`
    - Test: renders title and description, has correct CSS classes (`text-center py-5 text-muted`, `fs-5 mb-1`), has `data-testid="empty-state"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Layout and structural components
  - [x] 3.1 Create PageHeaderComponent
    - Create `frontend/src/app/shared/components/page-header/page-header.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-page-header`
    - Signal inputs: `title` (required), `actionLabel` (optional)
    - Output: `action`
    - Template: responsive flex layout with `h2` title, conditional action button (`btn btn-dark`), `[slot=before-title]` content projection for back-navigation links
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.2 Write unit tests for PageHeaderComponent
    - Create `frontend/src/app/shared/components/page-header/page-header.spec.ts`
    - Test: renders title in `h2`, shows action button with label, hides button when no label, emits `action` on click, projects content in `[slot=before-title]` slot, has correct flex layout classes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.3 Create ColumnDef model and DataTableComponent
    - Create `frontend/src/app/shared/components/data-table/column-def.model.ts` with `ColumnDef` interface (`header`, `cssClass?`, `headerCssClass?`)
    - Create `frontend/src/app/shared/components/data-table/data-table.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-data-table`
    - Signal inputs: `columns` (required `ColumnDef[]`), `data` (required `T[]`), `trackBy` (required function)
    - Template: `d-none d-lg-block` outer div, `table-responsive` wrapper, `table table-hover align-middle` table, `table-light` thead, column headers from `ColumnDef[]`, `<ng-content>` for tbody rows
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 3.4 Write unit tests for DataTableComponent
    - Create `frontend/src/app/shared/components/data-table/data-table.spec.ts`
    - Test: renders column headers from `ColumnDef` array, applies `cssClass` to `th` elements, wraps in `table-responsive`, has `d-none d-lg-block` on outer div, applies `table table-hover align-middle` and `table-light` classes
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.7_

  - [x] 3.5 Create CardListComponent
    - Create `frontend/src/app/shared/components/card-list/card-list.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-card-list`
    - Signal inputs: `data` (required `T[]`), `trackBy` (required function), `cardTemplate` (required `TemplateRef`)
    - Template: `d-lg-none` outer div, iterates data with `@for`, renders each card with `card mb-3 shadow-sm` and `card-body`, uses `ngTemplateOutlet` for card content
    - Import `NgTemplateOutlet` from `@angular/common`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.6 Write unit tests for CardListComponent
    - Create `frontend/src/app/shared/components/card-list/card-list.spec.ts`
    - Test: renders cards from data array, applies `card mb-3 shadow-sm` per card, has `d-lg-none` on outer div
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Interactive components
  - [x] 5.1 Create ConfirmationModalComponent
    - Create `frontend/src/app/shared/components/confirmation-modal/confirmation-modal.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-confirmation-modal`
    - Import `LoadingSpinnerComponent` (not needed — uses inline spinner-border, but import if design specifies)
    - Signal inputs: `open` (required boolean), `title` (required string), `confirmLabel` (optional, defaults to `'Confirm'`), `confirmStyle` (optional, defaults to `'btn-danger'`), `saving` (optional boolean, defaults to `false`)
    - Outputs: `confirm`, `cancel`
    - Template: conditional rendering with `@if (open())`, backdrop, centered modal dialog with `modal-fullscreen-sm-down`, `<ng-content>` for body, cancel/confirm buttons, spinner when saving, `data-testid="confirmation-modal"`
    - Implement focus trapping: on open, capture previously focused element, move focus to modal, trap Tab/Shift+Tab within focusable elements; on close, restore focus
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 11.3, 11.4_

  - [x] 5.2 Write unit tests for ConfirmationModalComponent
    - Create `frontend/src/app/shared/components/confirmation-modal/confirmation-modal.spec.ts`
    - Test: renders when `open=true`, hidden when `open=false`, emits `confirm` on confirm click, emits `cancel` on cancel click, emits `cancel` on backdrop click, shows spinner when `saving=true`, disables confirm button when saving, applies custom `confirmStyle`, has `data-testid="confirmation-modal"`, has `modal-dialog-centered modal-fullscreen-sm-down` classes, traps focus within modal, returns focus on close
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 11.3, 11.4_

  - [x] 5.3 Create StatusBadgeComponent
    - Create `frontend/src/app/shared/components/status-badge/status-badge.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-status-badge`
    - Signal inputs: `status` (required string), `label` (required string), `colorMap` (required `Record<string, string>`)
    - Computed signal: `badgeClass = computed(() => this.colorMap()[this.status()] ?? 'bg-secondary')`
    - Template: `<span class="badge" [class]="badgeClass()" data-testid="status-badge">{{ label() }}</span>`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Write unit tests for StatusBadgeComponent
    - Create `frontend/src/app/shared/components/status-badge/status-badge.spec.ts`
    - Test: renders label text, applies mapped color class, falls back to `bg-secondary` for unknown status, has `data-testid="status-badge"`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Write property test for StatusBadgeComponent color resolution
    - **Property 1: Status badge color resolution**
    - **Validates: Requirements 8.2, 8.3**
    - Add property test in `status-badge.spec.ts` using fast-check
    - Generator: arbitrary status strings (`fc.string()`) and arbitrary colorMap records (`fc.dictionary(fc.string(), fc.constantFrom('bg-success', 'bg-warning', 'bg-danger', 'bg-primary', 'bg-info', 'bg-secondary'))`)
    - Assertion: resolved class equals `colorMap[status] ?? 'bg-secondary'`
    - Test the `badgeClass` computed signal directly via component instance

  - [x] 5.6 Create SearchBarComponent
    - Create `frontend/src/app/shared/components/search-bar/search-bar.ts`, `.html`, `.css`
    - Standalone component with `ChangeDetectionStrategy.OnPush`, selector `app-search-bar`
    - Signal inputs: `placeholder` (optional, defaults to `'Search...'`), `ariaLabel` (optional, defaults to `'Search'`)
    - Output: `searchChange`
    - Internal: `searchValue` signal, rxjs `Subject` with `debounceTime(300)` piped in constructor, emitting through `searchChange` output
    - Template: `input-group` with `form-control` input, conditional clear button (`btn btn-outline-secondary`), `data-testid="search-bar-container"` on container, `data-testid="search-bar"` on input, `aria-label` attribute
    - Implement `DestroyRef` or `takeUntilDestroyed` for subscription cleanup
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.5_

  - [x] 5.7 Write unit tests for SearchBarComponent
    - Create `frontend/src/app/shared/components/search-bar/search-bar.spec.ts`
    - Test: renders with default placeholder, renders with custom placeholder, shows clear button when text present, clears input on clear click, emits empty string on clear, has `aria-label`, has `data-testid="search-bar"`, has `form-control` class
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 11.5_

  - [x] 5.8 Write property test for SearchBar debounce behavior
    - **Property 2: Search bar debounce emits final value**
    - **Validates: Requirements 9.2**
    - Add property test in `search-bar.spec.ts` using fast-check
    - Generator: arbitrary non-empty strings (`fc.string({ minLength: 1 })`)
    - Assertion: after typing the string and advancing fake timer by 300ms, the last emitted value equals the input string
    - Use Vitest fake timers (`vi.useFakeTimers()` / `vi.advanceTimersByTime(300)`) to control debounce timing

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Barrel export and steering file
  - [x] 7.1 Create barrel export file
    - Create `frontend/src/app/shared/components/index.ts`
    - Re-export all nine components and the `ColumnDef` interface
    - Exports: `LoadingSpinnerComponent`, `ErrorAlertComponent`, `EmptyStateComponent`, `PageHeaderComponent`, `DataTableComponent`, `ColumnDef`, `CardListComponent`, `ConfirmationModalComponent`, `StatusBadgeComponent`, `SearchBarComponent`
    - _Requirements: 10.1, 10.2_

  - [x] 7.2 Create AI steering file for shared component usage
    - Create `.kiro/steering/shared-components.md`
    - Front-matter: `inclusion: fileMatch` with glob pattern `frontend/src/**`
    - Content: instruct AI to import from barrel export, prefer shared components over inline markup, list all nine components with brief descriptions, guidance on extending vs creating new components, criteria for when to create new shared components (pattern appears in 2+ Feature_Pages), guidance on keeping components abstract yet strict in API
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All components use Angular 21 standalone component pattern with signal inputs, `ChangeDetectionStrategy.OnPush`, and Bootstrap 5.3 utility classes
- Tests run via `cd frontend && npx ng test`
- fast-check is used for property-based tests (Property 1: status badge color resolution, Property 2: search bar debounce)
