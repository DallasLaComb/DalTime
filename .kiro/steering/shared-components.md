---
inclusion: fileMatch
fileMatchPattern: "frontend/src/**"
---

# Shared Components Library

The DalTime frontend has a shared component library at `frontend/src/app/shared/components/`. When building or modifying any Feature_Page UI (WebAdmin, OrgAdmin, Manager, Employee), always use these shared components instead of writing inline or duplicated markup.

## Import Rule

Always import shared components from the barrel export:

```typescript
import { LoadingSpinnerComponent, ErrorAlertComponent } from '@app/shared/components';
```

Do NOT import from individual component files:

```typescript
// ❌ Wrong
import { LoadingSpinnerComponent } from '@app/shared/components/loading-spinner/loading-spinner';

// ✅ Correct
import { LoadingSpinnerComponent } from '@app/shared/components';
```

The barrel export is located at `frontend/src/app/shared/components/index.ts`.

## Prefer Shared Components

When building any Feature_Page UI, always check the shared component library first. If a shared component exists for the UI pattern you need, use it rather than writing custom markup. This applies to all four role areas: WebAdmin, OrgAdmin, Manager, and Employee.

## Available Components

| Component | Selector | Purpose |
|---|---|---|
| **LoadingSpinnerComponent** | `app-loading-spinner` | Centered Bootstrap spinner for loading states. Accepts an optional `label` input (defaults to "Loading..."). |
| **ErrorAlertComponent** | `app-error-alert` | Danger alert with an optional retry button. Requires a `message` input; set `retryable` to true and handle the `retry` output to show a retry button. |
| **EmptyStateComponent** | `app-empty-state` | Centered placeholder for empty data collections. Requires `title` and `description` inputs. |
| **PageHeaderComponent** | `app-page-header` | Responsive flex header with a title (`h2`) and optional action button. Supports a `[slot=before-title]` content projection slot for back-navigation links. |
| **DataTableComponent** | `app-data-table` | Responsive Bootstrap table for large screens (`d-none d-lg-block`). Accepts `columns` (ColumnDef[]), `data`, and `trackBy` inputs. Table body rows are projected via `<ng-content>`. |
| **CardListComponent** | `app-card-list` | Mobile-friendly card layout for small screens (`d-lg-none`). Accepts `data`, `trackBy`, and `cardTemplate` (TemplateRef) inputs. |
| **ConfirmationModalComponent** | `app-confirmation-modal` | Modal dialog for destructive action confirmation. Accepts `open`, `title`, `confirmLabel`, `confirmStyle`, and `saving` inputs. Body content is projected via `<ng-content>`. |
| **StatusBadgeComponent** | `app-status-badge` | Bootstrap badge with status-to-color mapping. Accepts `status`, `label`, and `colorMap` inputs. Falls back to `bg-secondary` for unmapped statuses. |
| **SearchBarComponent** | `app-search-bar` | Debounced text input (300ms) for filtering. Accepts optional `placeholder` and `ariaLabel` inputs. Emits filtered text via the `searchChange` output. |

Also exported: `ColumnDef` interface from `data-table/column-def.model.ts` for defining DataTable columns.

## Extending vs Creating New Components

### When to extend an existing component

- You need a specialized variant of an existing shared component (e.g., a loading spinner with a different size or color).
- The new behavior can be achieved by composing the shared component with additional wrapper markup or by passing different inputs.
- Wrap or compose the shared component rather than bypassing the library and writing custom markup.

### When to create a new shared component

- A UI pattern appears in **two or more Feature_Pages**. This is the threshold for extraction into the shared library.
- The pattern is not already covered by an existing shared component or a reasonable composition of existing components.
- Place the new component in its own subfolder under `frontend/src/app/shared/components/`, add it to the barrel export in `index.ts`, and follow the same conventions: standalone component, `ChangeDetectionStrategy.OnPush`, signal-based inputs, `app-` selector prefix, separate `.ts`, `.html`, `.css` files.

### When NOT to create a shared component

- The pattern is used in only one Feature_Page. Keep it local until a second usage appears.
- The pattern is highly specific to a single domain concept and unlikely to generalize.

## API Design Guidance

Keep shared components **abstract enough** for reuse across all four role areas (WebAdmin, OrgAdmin, Manager, Employee) while remaining **strict enough** in their API to prevent misuse:

- Use **required inputs** (`input.required()`) for data that the component cannot function without.
- Use **optional inputs** with sensible defaults for customization points (e.g., labels, styles).
- Avoid overly broad inputs like `any` or unconstrained `Record<string, any>`. Prefer typed inputs (e.g., `ColumnDef[]`, `Record<string, string>`).
- Use **content projection** (`<ng-content>`, `TemplateRef`) for areas where the parent needs full control over rendering (e.g., table body rows, modal body content, card content).
- Do not add domain-specific logic to shared components. They should be presentation-only; data fetching and business logic belong in the parent Feature_Page.
