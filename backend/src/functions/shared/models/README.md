# Shared Models

This directory contains TypeScript interfaces that define the entities stored in DynamoDB and the request/response shapes used across Lambda functions.

## Purpose

- **Entity interfaces** represent the data as it exists in DynamoDB (e.g., `Organization`).
- **Request body interfaces** define the expected shape of API request payloads (e.g., `CreateOrganizationBody`, `UpdateOrganizationBody`).

These models are shared across all Lambda function groups (`web-admin`, `org-admin`, `manager`, `employee`) to ensure consistent typing and avoid duplication.

## Single-Table Design

All entities share one DynamoDB table (`daltime-<stack>`) with a composite primary key:

| Key      | Description                        | Example              |
| -------- | ---------------------------------- | -------------------- |
| `PK`     | Partition key — `TYPE#<id>`        | `ORG#abc-123`        |
| `SK`     | Sort key — item type               | `METADATA`           |
| `GSI1PK` | GSI1 partition — entity type       | `ORG`                |
| `GSI1SK` | GSI1 sort — sortable attribute     | `2026-02-23T...`     |

**GSI1** is used to list all items of a given entity type (e.g., all organizations) via `QueryCommand` — never `ScanCommand`.

## Models

| File                                | Entity          | PK prefix | SK         | GSI1PK | GSI1SK       |
| ----------------------------------- | --------------- | --------- | ---------- | ------ | ------------ |
| `web-admin/organization.model.ts`   | `Organization`  | `ORG#`    | `METADATA` | `ORG`  | `created_at` |

## Conventions

- Each model file exports the **entity interface** and any associated **request body interfaces**.
- Entity interfaces include `PK`, `SK`, `GSI1PK`, `GSI1SK` — these are stripped before returning API responses.
- Entity-specific fields use `snake_case` to match the database.
- Timestamps are stored as ISO 8601 strings (`created_at`, `updated_at`).
- Request body interfaces use `?` for optional fields (partial updates).
