## Why

ADR 0004/0005 moved the local prototype to generated files and in-memory clip
retrieval, but the repo still carries PostgreSQL from the initial skeleton. That
leftover service, health check, dependency, and documentation now make the local
demo look heavier than it is.

## What Changes

- Remove PostgreSQL from the default local compose stack.
- Remove required API database startup/configuration and the PostgreSQL smoke
  check path.
- Remove PostgreSQL client dependencies from the API package.
- Update README, API docs, `.env.example`, and related architecture notes so the
  documented local data path is generated files under `var/`.
- Keep database-backed durability as a deferred future decision for
  conversations, render jobs, larger catalogs, or retrieval work.

## Capabilities

### New Capabilities

- `postgres-free-local-stack`: Defines the default local stack and health surface
  without PostgreSQL as a required service.

### Modified Capabilities

- None.

## Impact

- Affects `compose.yaml`, `.env.example`, API config/startup, API health routes,
  API dependencies, and tests that currently account for database wiring.
- Affects root and service documentation that currently advertises PostgreSQL or
  `/health/db` as part of the default local workflow.
- Does not change clip search, assistant chat, selected clips, devasset seeding,
  media serving, or render-service behavior.
