# DynamoDB Entity Map

Single-table design reference for DalTime. Documents every record type, where entities are referenced, and what must be cleaned up on delete.

In SQL, you'd have foreign keys and `ON DELETE CASCADE`. In DynamoDB single-table design, **you are the cascade**. This doc is the map.

---

## Record Types

### Organization

| Record | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Org metadata | `ORG#<org_id>` | `METADATA` | `ORG` | `<created_at>` |

### OrgAdmin

| Record | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Primary (under org) | `ORG#<org_id>` | `USER#<user_sub>` | `ORG_ADMIN` | `<created_at>` |
| Reverse-lookup | `USER#<user_sub>` | `METADATA` | — | — |

### Manager

| Record | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Primary (under org) | `ORG#<org_id>` | `MANAGER#<manager_id>` | `MANAGER` | `<created_at>` |
| Reverse-lookup | `USER#<manager_id>` | `METADATA` | — | — |

### Employee (future)

| Record | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Primary (under manager) | `ORG#<org_id>` | `EMPLOYEE#<employee_id>` | `EMPLOYEE` | `<created_at>` |
| Reverse-lookup | `USER#<employee_id>` | `METADATA` | — | — |

### Shift (future)

| Record | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Shift definition | `ORG#<org_id>` | `SHIFT#<shift_id>` | TBD | TBD |

### Schedule Assignment (future)

| Record | PK | SK | Notes |
|--------|----|----|-------|
| Assignment | TBD | TBD | References employee_id, shift_id, manager_id |

---

## Entity Relationship Hierarchy

```
Organization
├── OrgAdmin (created by WebAdmin)
│   └── owns manager_count on their USER record
├── Manager (created by OrgAdmin)
│   └── owns employee_count on their MANAGER record
│   └── owns shift definitions (future)
│   └── owns schedule assignments (future)
└── Employee (created by Manager, future)
    └── owns availability submissions (future)
    └── referenced in schedule assignments (future)
    └── referenced in shift pickups (future)
```

---

## Deletion Cascade Map

What must happen when each entity is removed from the system.

### Delete Organization

| Step | Action | Record Affected |
|------|--------|----------------|
| 1 | Disable all OrgAdmins in Cognito | Cognito users |
| 2 | Disable all Managers in Cognito | Cognito users |
| 3 | Disable all Employees in Cognito | Cognito users |
| 4 | Delete/mark all records under `PK = ORG#<org_id>` | All SK prefixes |
| 5 | Delete reverse-lookups for all users | `USER#<sub>` / `METADATA` |
| 6 | Delete org metadata | `ORG#<org_id>` / `METADATA` |

### Delete OrgAdmin

| Step | Action | Record Affected |
|------|--------|----------------|
| 1 | Disable Cognito user | Cognito |
| 2 | Update `org_admin_count` on org metadata | `ORG#<org_id>` / `METADATA` |
| 3 | Delete primary record | `ORG#<org_id>` / `USER#<sub>` |
| 4 | Delete reverse-lookup | `USER#<sub>` / `METADATA` |
| 5 | Reassign or orphan their managers? | **Decision needed** |

### Delete Manager (e.g. John Smith quits)

This is the scenario where cascading matters most. A manager is referenced by:

| Where | Record | Field |
|-------|--------|-------|
| Primary record | `ORG#<org_id>` / `MANAGER#<mgr_id>` | — (this IS the record) |
| Reverse-lookup | `USER#<mgr_id>` / `METADATA` | — |
| OrgAdmin's counter | `ORG#<org_id>` / `USER#<org_admin_sub>` | `manager_count` |
| Every employee under them | `ORG#<org_id>` / `EMPLOYEE#<emp_id>` | `manager_id` (future) |
| Shift definitions they created | `ORG#<org_id>` / `SHIFT#<shift_id>` | `manager_id` (future) |
| Schedule assignments | TBD | `manager_id` (future) |

**Cascade steps:**

| Step | Action | Record Affected |
|------|--------|----------------|
| 1 | Disable Cognito user | Cognito |
| 2 | Decrement `manager_count` on OrgAdmin | `ORG#<org_id>` / `USER#<org_admin_sub>` |
| 3 | Update status to `DISABLED` on primary | `ORG#<org_id>` / `MANAGER#<mgr_id>` |
| 4 | Reassign employees to another manager OR disable them | `ORG#<org_id>` / `EMPLOYEE#<emp_id>` (future) |
| 5 | Handle future shifts — cancel, reassign, or leave unassigned | Shift/schedule records (future) |

> **Current behavior:** Managers are soft-deleted (Cognito disabled, status set to `DISABLED`). Records are preserved. No cascade to employees/shifts yet because those features don't exist.

### Delete Employee (future)

| Where | Record | Field |
|-------|--------|-------|
| Primary record | `ORG#<org_id>` / `EMPLOYEE#<emp_id>` | — |
| Reverse-lookup | `USER#<emp_id>` / `METADATA` | — |
| Manager's counter | `ORG#<org_id>` / `MANAGER#<mgr_id>` | `employee_count` |
| Availability submissions | TBD | `employee_id` |
| Schedule assignments | TBD | `employee_id` |
| Shift pickups | TBD | `employee_id` |

---

## Design Principles

1. **Soft delete over hard delete** — disable Cognito user, set `status: DISABLED` in DynamoDB. Preserves audit trail and avoids orphaned references.
2. **Counters are atomic** — `manager_count`, `employee_count` use DynamoDB `ADD` operations, not read-modify-write.
3. **Reverse-lookups enable cascade discovery** — `USER#<id>` / `METADATA` stores `org_id`, allowing you to find the primary record without knowing the org upfront.
4. **Future cascades should be transactional** — when employee/shift features are built, use `TransactWriteItems` to update multiple records atomically (DynamoDB supports up to 100 items per transaction).

---

## Open Questions (resolve when building future features)

- [ ] When a Manager is deleted, should their employees be reassigned to another manager or disabled?
- [ ] When a Manager is deleted, should their future shift definitions be cancelled or reassigned?
- [ ] Should schedule assignments reference manager_id at all, or only employee_id + shift_id?
- [ ] Do we need a `DELETED` status distinct from `DISABLED` for hard-removal scenarios?
