# Requirements Document

## Introduction

This feature establishes a reusable components library under `frontend/src/app/shared/components/` for the DalTime Angular application. The existing feature pages (organizations, org-admins, managers) contain heavily duplicated UI patterns — loading spinners, error alerts, empty states, responsive data tables with card fallbacks, confirmation modals, form modals, status badges, page headers, and action buttons. Extracting these into standalone, signal-driven components will eliminate duplication, enforce visual consistency across all four role areas (WebAdmin, OrgAdmin, Manager, Employee), and accelerate development of future pages.

## Glossary

- **Component_Library**: The collection of reusable Angular standalone components located in `frontend/src/app/shared/components/`
- **Loading_Spinner**: A centered Bootstrap spinner displayed while asynchronous data is being fetched
- **Error_Alert**: A Bootstrap danger alert displaying an error message with an optional retry action
- **Empty_State**: A centered placeholder displayed when a data collection contains zero items
- **Page_Header**: A responsive flex container holding a page title and optional action button
- **Data_Table**: A responsive Bootstrap table with hover styling and light header, visible on large screens
- **Card_List**: A mobile-friendly card-based layout that replaces the Data_Table on small screens
- **Confirmation_Modal**: A modal dialog requesting user confirmation before a destructive or significant action
- **Status_Badge**: A Bootstrap badge whose color class is determined by a status value
- **Search_Bar**: A text input with debounced output used to filter list data
- **Feature_Page**: Any page within the WebAdmin, OrgAdmin, Manager, or Employee feature areas that displays list data
- **Steering_File**: A Kiro markdown file placed in `.kiro/steering/` that provides contextual guidance to AI assistants when working on matching files

## Requirements

### Requirement 1: Loading Spinner Component

**User Story:** As a developer, I want a reusable loading spinner component, so that every Feature_Page displays a consistent loading indicator without duplicating markup.

#### Acceptance Criteria

1. WHEN a Feature_Page sets its loading state to true, THE Loading_Spinner SHALL render a centered Bootstrap spinner with a visually-hidden accessible label
2. THE Loading_Spinner SHALL accept an optional custom label input, defaulting to "Loading..."
3. THE Loading_Spinner SHALL apply the `text-center py-5` layout and `spinner-border text-secondary` styling to match the existing pattern
4. THE Loading_Spinner SHALL include a `data-testid="loading-spinner"` attribute on the outer container

### Requirement 2: Error Alert Component

**User Story:** As a developer, I want a reusable error alert component, so that every Feature_Page displays error messages and retry actions in a consistent format.

#### Acceptance Criteria

1. WHEN an error message string is provided, THE Error_Alert SHALL render a Bootstrap danger alert displaying that message
2. WHEN a retry callback is provided, THE Error_Alert SHALL render a retry button inside the alert that invokes the callback on click
3. WHEN no retry callback is provided, THE Error_Alert SHALL render the alert without a retry button
4. THE Error_Alert SHALL use the responsive flex layout `d-flex flex-column flex-sm-row align-items-sm-center gap-2` matching the existing pattern
5. THE Error_Alert SHALL include `role="alert"` for accessibility and `data-testid="error-alert"` on the container

### Requirement 3: Empty State Component

**User Story:** As a developer, I want a reusable empty state component, so that every Feature_Page displays a consistent placeholder when no data exists.

#### Acceptance Criteria

1. WHEN a data collection is empty, THE Empty_State SHALL render a centered container with a title and a description message
2. THE Empty_State SHALL accept a required title input and a required description input
3. THE Empty_State SHALL apply the `text-center py-5 text-muted` layout with the title styled as `fs-5 mb-1` matching the existing pattern
4. THE Empty_State SHALL include a `data-testid="empty-state"` attribute on the outer container

### Requirement 4: Page Header Component

**User Story:** As a developer, I want a reusable page header component, so that every Feature_Page has a consistent title area with optional action buttons.

#### Acceptance Criteria

1. THE Page_Header SHALL render a page title within an `h2` element
2. WHEN an action button label and callback are provided, THE Page_Header SHALL render a primary-styled button that invokes the callback on click
3. WHEN no action button is configured, THE Page_Header SHALL render only the title without a button
4. THE Page_Header SHALL use the responsive flex layout `d-flex flex-column flex-sm-row justify-content-sm-between align-items-sm-center gap-2 mb-4` matching the existing pattern
5. THE Page_Header SHALL support an optional content projection slot for custom elements such as back-navigation links

### Requirement 5: Data Table Component

**User Story:** As a developer, I want a reusable data table component, so that every Feature_Page renders tabular data with consistent styling and responsive behavior.

#### Acceptance Criteria

1. THE Data_Table SHALL accept column definitions as an input, where each definition specifies a header label and a template reference for cell rendering
2. THE Data_Table SHALL accept a data array input and render one row per item using the provided cell templates
3. THE Data_Table SHALL apply `table table-hover align-middle` on the table element and `table-light` on the thead element
4. THE Data_Table SHALL wrap the table in a `table-responsive` container
5. THE Data_Table SHALL be hidden on screens smaller than the `lg` breakpoint by applying the `d-none d-lg-block` class
6. THE Data_Table SHALL accept a trackBy function input for efficient `@for` rendering
7. THE Data_Table SHALL support an optional column visibility class input per column to allow hiding columns at specific breakpoints

### Requirement 6: Card List Component

**User Story:** As a developer, I want a reusable card list component, so that every Feature_Page renders mobile-friendly cards as a responsive alternative to the Data_Table.

#### Acceptance Criteria

1. THE Card_List SHALL accept a data array input and a card template reference for rendering each item
2. THE Card_List SHALL render one Bootstrap card per item with `card mb-3 shadow-sm` styling
3. THE Card_List SHALL be visible only on screens smaller than the `lg` breakpoint by applying the `d-lg-none` class
4. THE Card_List SHALL accept a trackBy function input for efficient `@for` rendering

### Requirement 7: Confirmation Modal Component

**User Story:** As a developer, I want a reusable confirmation modal component, so that destructive actions across all Feature_Pages use a consistent confirmation dialog.

#### Acceptance Criteria

1. WHEN the modal open state is set to true, THE Confirmation_Modal SHALL render a centered modal with a backdrop, title, body message, cancel button, and confirm button
2. WHEN the user clicks the confirm button, THE Confirmation_Modal SHALL invoke the provided confirm callback
3. WHEN the user clicks the cancel button or the backdrop, THE Confirmation_Modal SHALL invoke the provided cancel callback
4. THE Confirmation_Modal SHALL accept a confirm button style input to support different Bootstrap button variants (e.g., `btn-danger` for delete, `btn-dark` for neutral actions)
5. THE Confirmation_Modal SHALL display a loading spinner on the confirm button when a saving state input is true, and disable the button during that state
6. THE Confirmation_Modal SHALL accept a title input, a body content projection slot, and confirm button label input
7. THE Confirmation_Modal SHALL apply `modal-dialog-centered modal-fullscreen-sm-down` for responsive centering matching the existing pattern
8. THE Confirmation_Modal SHALL include `data-testid="confirmation-modal"` on the modal container

### Requirement 8: Status Badge Component

**User Story:** As a developer, I want a reusable status badge component, so that status indicators across all Feature_Pages use consistent color mapping.

#### Acceptance Criteria

1. THE Status_Badge SHALL accept a status value input and a label input, and render a Bootstrap badge element
2. THE Status_Badge SHALL accept a color map input that maps status values to Bootstrap badge classes (e.g., `CONFIRMED` to `bg-success`, `PENDING` to `bg-warning text-dark`)
3. WHEN the status value has no entry in the color map, THE Status_Badge SHALL fall back to the `bg-secondary` class
4. THE Status_Badge SHALL include a `data-testid="status-badge"` attribute

### Requirement 9: Search Bar Component

**User Story:** As a developer, I want a reusable search bar component, so that list pages across all feature areas can offer consistent text-based filtering.

#### Acceptance Criteria

1. THE Search_Bar SHALL render a text input with a placeholder input defaulting to "Search..."
2. WHEN the user types in the Search_Bar, THE Search_Bar SHALL emit the current value through an output signal after a 300ms debounce period
3. WHEN the Search_Bar contains text, THE Search_Bar SHALL display a clear button that resets the input and emits an empty string
4. THE Search_Bar SHALL include a `data-testid="search-bar"` attribute on the input element
5. THE Search_Bar SHALL apply Bootstrap form-control styling consistent with the application design

### Requirement 10: Component Library Structure

**User Story:** As a developer, I want the reusable components organized in a predictable folder structure with a barrel export, so that importing shared components is straightforward.

#### Acceptance Criteria

1. THE Component_Library SHALL place each component in its own subfolder under `frontend/src/app/shared/components/` (e.g., `shared/components/loading-spinner/`)
2. THE Component_Library SHALL provide a barrel `index.ts` file at `frontend/src/app/shared/components/index.ts` that re-exports all public components
3. THE Component_Library SHALL ensure every component is a standalone Angular component using `ChangeDetectionStrategy.OnPush`
4. THE Component_Library SHALL ensure every component follows the project conventions: separate `.ts`, `.html`, `.css` files, `app-` selector prefix, and signal-based inputs where applicable

### Requirement 11: Accessibility Compliance

**User Story:** As a user with assistive technology, I want the reusable components to follow accessibility best practices, so that the application is usable with screen readers and keyboard navigation.

#### Acceptance Criteria

1. THE Loading_Spinner SHALL include a `role="status"` attribute on the spinner element and a visually-hidden text label
2. THE Error_Alert SHALL include a `role="alert"` attribute so screen readers announce error messages
3. THE Confirmation_Modal SHALL trap keyboard focus within the modal while it is open
4. THE Confirmation_Modal SHALL return focus to the triggering element when the modal closes
5. WHEN the Search_Bar input is rendered, THE Search_Bar SHALL include an `aria-label` attribute describing its purpose

### Requirement 12: AI Steering File for Shared Component Usage

**User Story:** As a developer working with AI assistants, I want a steering file that instructs AI to always prefer shared components when building UI, so that new development consistently uses the Component_Library and avoids duplicating markup.

#### Acceptance Criteria

1. THE Component_Library SHALL include a Kiro steering file at `.kiro/steering/shared-components.md` that provides AI assistants with guidance on using shared components
2. THE steering file SHALL use `inclusion: fileMatch` front-matter with a glob pattern matching frontend source files (e.g., `frontend/src/**`) so that the guidance is automatically loaded when working on frontend code
3. THE steering file SHALL instruct AI assistants to always import shared components from the barrel export at `frontend/src/app/shared/components/index.ts` rather than from individual component files
4. THE steering file SHALL instruct AI assistants to prefer shared components from `frontend/src/app/shared/components/` over inline or duplicated markup when building any Feature_Page UI
5. WHEN a specialized variant of a shared component is needed, THE steering file SHALL instruct AI assistants to extend or compose the shared component rather than bypassing the Component_Library
6. THE steering file SHALL include guidance on keeping shared components abstract enough for reuse across all four role areas while remaining strict enough in their API to prevent misuse through overly broad inputs or unconstrained content projection
7. THE steering file SHALL include criteria for when to create a new shared component versus when to use or extend an existing one, based on whether the pattern appears in two or more Feature_Pages
8. THE steering file SHALL list all available shared components by name and briefly describe the purpose of each so AI assistants can identify the correct component for a given UI need
