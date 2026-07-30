## Why

The project needs a runnable foundation before implementing the seed service so future changes can add behavior into known service boundaries instead of inventing structure as they go. Starting with a containerized skeleton gives the prototype a Minimal Testable Product: the web, API, render service, and PostgreSQL can start together and prove basic connectivity.

## What Changes

- Add a prototype repo skeleton aligned with ADR 0001.
- Add service directories for the React web app at `services/webapp`, TypeScript API at `services/api`, TypeScript seed CLI at `tools/seed`, and Go render service at `services/render`.
- Add shared local-development conventions for environment variables, generated files, and mounted directories.
- Add Podman Compose orchestration for `web`, `api`, `render`, and `postgres`.
- Add minimal health checks or equivalent smoke-test endpoints for the API and render service.
- Add database migration/bootstrap structure sufficient for the API to verify PostgreSQL connectivity.
- Add tracked `devassets/catalog.yaml` and documentation as the source manifest for later seeding work.
- Add gitignored runtime path conventions for prepared devassets, renders, and thumbnails under `var/`.
- Configure container mounts so later seed output can be shared with API/render services through local bind-mounted `var/` directories.
- Add setup documentation for starting the skeleton and validating the Phase 0 Minimal Testable Product.
- Do not implement seed ingestion, transcription, full-text clip search, chat behavior, EditPlan generation, or `vspec` rendering in this change.

## Capabilities

### New Capabilities

- `prototype-repo-skeleton`: Defines the runnable repository foundation, service boundaries, local container orchestration, and Phase 0 smoke-test behavior for the VideoAI prototype.

### Modified Capabilities

- None.

## Impact

- Adds initial app/service source layout for `webapp`, `api`, `seed`, and `render`.
- Adds Podman-compatible container definitions and compose orchestration.
- Adds initial PostgreSQL local-development configuration and migration/bootstrap conventions.
- Establishes tracked `devassets` catalog conventions and gitignored local runtime directories for generated artifacts.
- Establishes commands and smoke checks that later implementation phases can build on.
- Keeps later MVP phases unimplemented so seed ingestion can be proposed and implemented as a focused follow-up.
