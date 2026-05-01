# DalTime — UI Guidance

Visual design system and frontend best-practice rules for the DalTime shift-scheduling web app.

**Design tone:** Minimal, modern, calm, professional. Prioritize clarity, readability, and low cognitive load.

---

## Brand & Color System

### Primary Palette

| Token | Role | HEX | Bootstrap Variable | Usage |
|-------|------|-----|--------------------|-------|
| **Primary** | Main brand, primary buttons, active nav links | `#1E3A5F` | `--bs-primary` | Primary CTAs, active states, navbar brand. **Not** for large background fills. |
| **Secondary** | Secondary actions, highlights | `#5A7FA5` | `--bs-secondary` | Secondary buttons, hover accents, selected table rows. **Not** for body text. |
| **Tertiary** | Accent, badges, subtle highlights | `#A8C8E8` | `--bs-tertiary` | Info badges, progress indicators, subtle callouts. **Not** for primary actions. |

### Neutral Grayscale

| Token | HEX | Usage |
|-------|-----|-------|
| `neutral-50` | `#F8F9FA` | Page background, card backgrounds |
| `neutral-100` | `#F1F3F5` | Alternate table rows, subtle dividers |
| `neutral-200` | `#DEE2E6` | Borders, input outlines |
| `neutral-300` | `#CED4DA` | Disabled states, placeholder text |
| `neutral-500` | `#6C757D` | Secondary text, captions |
| `neutral-700` | `#495057` | Body text |
| `neutral-900` | `#212529` | Headings, high-emphasis text |

### Semantic Colors

| Token | HEX | Bootstrap Class | Usage |
|-------|-----|-----------------|-------|
| **Success** | `#198754` | `text-success` / `bg-success` | Confirmed shifts, active status, save confirmations |
| **Warning** | `#FFC107` | `text-warning` / `bg-warning` | Pending approvals, schedule conflicts |
| **Error** | `#DC3545` | `text-danger` / `bg-danger` | Validation errors, failed actions, destructive buttons |
| **Info** | `#0DCAF0` | `text-info` / `bg-info` | Informational banners, tips |

### Color Rules

- Use `btn-dark` (`#212529`) as the default primary button style — this is the established pattern.
- Reserve `btn-danger` for destructive actions (delete, remove, deactivate).
- Use `btn-outline-secondary` or `btn-outline-dark` for cancel / dismiss actions.
- Never use raw HEX values in templates — always use Bootstrap utility classes or CSS variables.
- All color pairings must meet **WCAG AA** contrast ratio (4.5:1 for normal text, 3:1 for large text).
- Semantic colors are for status communication only — never use `bg-success` as a decorative background.

### Dark Mode Considerations

- Rely on Bootstrap's `data-bs-theme="dark"` attribute when dark mode is implemented.
- Neutral scale inverts naturally with Bootstrap dark mode.
- Primary palette was chosen to work on both light and dark backgrounds.
- Test all status badges and semantic colors against dark backgrounds before shipping.

---

## UI Style Guidelines

### Visual Personality

- **Spacing:** Use Bootstrap's spacing scale consistently (`p-3`, `mb-4`, `gap-3`). Default content padding is `p-4` on desktop, `p-3` on mobile.
- **Border radius:** Use `rounded-3` (Bootstrap's soft radius) on cards, modals, and inputs. Badges use `rounded-pill`.
- **Shadows:** Use `shadow-sm` for cards and dropdowns. Never use `shadow-lg` — keep elevation subtle.
- **Typography:** Use the system font stack (Bootstrap default). Headings use `fw-semibold`. Body text is `neutral-700`.
- **Layout:** Maximum content width of `1200px` centered. Use Bootstrap grid (`container-fluid px-4`) for page layout.

### Buttons

| Style | Class | When to Use |
|-------|-------|-------------|
| Primary | `btn btn-dark` | Main page action (Create, Save, Submit) |
### Buttons

Always use `<app-button>` from `@common-daltime`. Never write raw `<button class="btn ...">` for action buttons.

```html
<app-button variant="primary" size="lg" [fullWidth]="true" [loading]="saving()" testId="save-btn" (clicked)="save()">
  Save
</app-button>
```

| Variant | Maps To | When to Use |
|---------|---------|-------------|
| `primary` | `btn-primary` | Main page action (Create, Save, Submit, Sign In) |
| `secondary` | `btn-outline-secondary` | Cancel, dismiss, back navigation |
| `danger` | `btn-danger` | Destructive confirms (Delete, Disable) |
| `danger-outline` | `btn-outline-danger` | Destructive in tables/cards, Retry |
| `primary-outline` | `btn-outline-primary` | Secondary positive actions (Edit) |

| Size | Maps To | When to Use |
|------|---------|-------------|
| `sm` | `btn-sm` | Table row actions, compact UI |
| `md` | (default) | Modal footers, page actions |
| `lg` | `btn-lg` | Auth pages (Sign In, Reset Password) |

Other inputs: `loading` (shows spinner + disables), `disabled`, `fullWidth` (`w-100`), `type` (`button` or `submit`), `testId`.

Rules:
- One primary button per view section. If two actions compete, one must be secondary.
- Use `[loading]` instead of manually adding spinners — it handles the spinner and disabled state.
- All buttons require `testId`.
- Exceptions (keep as native `<button>`): `btn-close`, `navbar-toggler`, input-group addons (Show/Hide), and `<a>` tags styled as buttons.

### Cards and Panels

```html
<div class="card shadow-sm rounded-3 border-0">
  <div class="card-body p-4">
    <!-- content -->
  </div>
</div>
```

- Use `border-0 shadow-sm` for the default card style.
- Card headers use `fw-semibold` text, not `<div class="card-header">` (avoids heavy visual weight).
- Group related cards with `d-flex flex-column gap-3` or the `app-card-list` shared component.

### Forms and Inputs

- Use Bootstrap form classes: `form-control`, `form-label`, `form-select`.
- Labels are always visible — never use placeholder-only inputs.
- Validation messages appear below the input with `text-danger small mt-1`.
- Group related fields with `mb-3`. Form sections separated by `mb-4`.
- Use reactive forms or signal-based forms — never `ngModel`.
- All inputs require `data-testid`.

### Tables

- Use the `app-data-table` shared component for all tabular data.
- Bootstrap classes: `table table-hover align-middle`.
- Alternate row striping via `neutral-100` background.
- Keep columns to 5-6 max on desktop. Use `app-card-list` on mobile breakpoints for complex data.
- Action columns are right-aligned with `text-end`.

### Status Badges

- Use the `app-status-badge` shared component with a `colorMap` input.
- Badge classes: `badge rounded-pill` + semantic background (`bg-success`, `bg-warning`, `bg-danger`, `bg-secondary`).
- Text inside badges must be short (1-2 words): "Active", "Pending", "Inactive".

### Interactive States

| State | Style |
|-------|-------|
| Hover | `btn-dark` → slight opacity change. Table rows → `table-hover` default. |
| Focus | Bootstrap's default focus ring (`outline`). Never remove `:focus-visible` styles. |
| Active | `active` class on nav links. Primary color underline or background. |
| Disabled | Reduced opacity (`opacity: 0.65`). Cursor `not-allowed`. |

---

## Angular Best Practices

These extend the rules in `frontend-rules.md`:

- **Standalone components only** — no NgModules.
- **Signals everywhere** — use `signal()`, `computed()`, `input()`, `output()` for all state and component communication. No `BehaviorSubject` for component state.
- **OnPush change detection** on every component (`ChangeDetectionStrategy.OnPush`).
- **Smart vs presentational separation:**
  - Smart components (pages/containers) live in `features/<role>/`. They inject services, manage state, and handle routing.
  - Presentational components live in `shared/components/`. They receive data via `input()` and emit events via `output()`. No service injection.
- **No business logic in templates** — move conditionals and transformations into `computed()` signals.
- **Services for data access** — HTTP calls and shared state live in `services/`. Components never call `HttpClient` directly.
- **Strict typing** — no `any`. All API responses have corresponding models in `core/models/`.
- **Composition over inheritance** — prefer injecting shared services or composing shared components over extending base classes.
- **Zoneless** — this project runs without Zone.js. Never use `fakeAsync`/`tick` in tests.
- **`trackBy` in all `@for` loops** — required for performance with OnPush.
- **`@defer` for lazy loading** heavy feature components.

---

## Bootstrap Best Practices

DalTime uses **Bootstrap 5** for layout and styling. No Tailwind.

- **Use Bootstrap utility classes** instead of custom CSS whenever possible (`d-flex`, `gap-3`, `p-4`, `text-center`, `rounded-3`).
- **No inline styles** — if Bootstrap doesn't have a utility, add a scoped CSS rule in the component's `.css` file.
- **Consistent spacing** — stick to Bootstrap's spacing scale (`0`, `1`, `2`, `3`, `4`, `5`). Don't invent custom spacing values.
- **Responsive design** — use Bootstrap breakpoints (`sm`, `md`, `lg`, `xl`). Mobile-first: start with the smallest layout and add breakpoint overrides.
- **Grid system** — use `container-fluid`, `row`, `col-*` for page layout. Use `d-flex` and `gap-*` for component-level layout.
- **Prefer Bootstrap variables** over raw values — use `var(--bs-border-color)` instead of `#DEE2E6`.
- **Keep class lists readable** — if a single element has more than 8-10 utility classes, extract a scoped CSS class.
- **No `!important`** unless overriding a third-party style.

---

## OOP & Code Organization

- **Separation of concerns:** Components handle presentation. Services handle data. Models define shapes. Guards handle access.
- **Reusable and testable:** Every component and service should be unit-testable in isolation with mocked dependencies.
- **Modular features:** Each role (`web-admin`, `org-admin`, `manager`, `employee`) is a self-contained feature folder. Cross-feature code goes in `shared/` or `core/`.
- **Interfaces over classes for models** — models in `core/models/` are interfaces only (no business logic). Parsing helpers and defaults are acceptable.
- **Avoid tight coupling** — feature components should not import from other feature folders. Shared logic goes in `shared/` or `services/`.
- **Small, focused components** — if a component file exceeds ~150 lines, consider extracting a child component.

---

## Shared Component Strategy

Shared components live at: `frontend/src/app/shared/components/`

All shared components are re-exported from `shared/components/index.ts` and available via the `@common-daltime` path alias:

```typescript
import { DataTableComponent, StatusBadgeComponent, type ColumnDef } from '@common-daltime';
```

Always use `@common-daltime` instead of relative paths when importing shared components.

### Rules

1. **Always check for an existing shared component before creating a new one.** Current inventory:
   - `ButtonComponent` — unified button with variant, size, loading, disabled, fullWidth, and testId inputs
   - `LoadingSpinnerComponent` — full-page or inline loading indicator
   - `ErrorAlertComponent` — dismissible error message display
   - `EmptyStateComponent` — placeholder for empty lists/tables (title + description)
   - `PageHeaderComponent` — page title with optional action button
   - `DataTableComponent` — generic typed table with column definitions and trackBy
   - `CardListComponent` — generic typed card grid with custom template
   - `ConfirmationModalComponent` — accessible modal with confirm/cancel, focus trapping, and loading state
   - `StatusBadgeComponent` — colored pill badge driven by a status-to-class color map
   - `SearchBarComponent` — debounced search input with clear button

2. **Shared components must be:**
   - Abstract enough to reuse across features (no role-specific logic)
   - Strict enough to prevent misuse (required inputs, typed generics)
   - Fully accessible (keyboard navigation, ARIA attributes, focus management)

3. **API design:**
   - Use `input()` / `input.required()` for configuration
   - Use `output()` for events
   - Use generics (`<T>`) for data-driven components (see `DataTableComponent`, `CardListComponent`)
   - Use `TemplateRef` inputs for custom rendering (see `CardListComponent.cardTemplate`)

4. **No feature-specific logic** inside shared components. If a component needs role-aware behavior, the parent smart component handles it and passes data down.

5. **Every shared component gets:**
   - Its own folder under `shared/components/`
   - An export in `shared/components/index.ts`
   - `ChangeDetectionStrategy.OnPush`
   - `data-testid` on interactive elements
   - A unit test file

### Good Candidates for Future Shared Components

| Component | Purpose |
|-----------|---------|
| **FormFieldComponent** | Wraps label + input + validation message for consistent form layout |
| **ToastComponent** | Non-blocking success/error notifications |
| **PaginationComponent** | Page controls for large data sets |
| **AvatarComponent** | User initials or image display |
| **SkeletonLoaderComponent** | Placeholder shimmer while data loads |

---

## Visual Debug Helper

All shared components and layout components (navbar, footer) include a `.dt-debug` CSS class on their root element. This class is defined in `frontend/src/styles.css` with a commented-out `border: 3px solid red` rule.

### How to Use

1. Open `frontend/src/styles.css`
2. Uncomment the border inside `.dt-debug`:
   ```css
   .dt-debug {
     border: 3px solid red;
   }
   ```
3. Every shared component will now have a visible red border, making it easy to verify they are used on every page
4. Comment the border back out when done testing

### Components with `.dt-debug`

- ButtonComponent, LoadingSpinner, ErrorAlert, EmptyState, PageHeader
- DataTable, CardList, ConfirmationModal
- StatusBadge, SearchBar
- Navbar, Footer