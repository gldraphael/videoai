## Purpose

Defines the default local demo stack after removing PostgreSQL as required
infrastructure for development, health checks, and acceptance verification.

## ADDED Requirements

### Requirement: Default local stack has no PostgreSQL service
The default local compose workflow SHALL run without a PostgreSQL service.

#### Scenario: Start local stack
- **WHEN** a developer runs the documented default `podman compose up --build`
  workflow
- **THEN** the required services are Traefik, webapp, API, render, and seed
- **AND** no database container, database volume, database port, or API database
  dependency is required

### Requirement: API has no database health dependency
The API SHALL start and serve local demo endpoints without `DATABASE_URL` or
PostgreSQL connectivity.

#### Scenario: API starts without database configuration
- **WHEN** the API starts without `DATABASE_URL`
- **THEN** `/health`, devasset status, chat, clip search, and media routes can
  operate according to their own readiness rules
- **AND** no endpoint in the default health path queries PostgreSQL

#### Scenario: Old database smoke check
- **WHEN** a client requests the old database smoke-check route
- **THEN** the API does not query PostgreSQL
- **AND** the route is absent or clearly reports that database health is not part
  of the default local demo

### Requirement: Documentation describes generated files as local state
Project documentation SHALL describe generated files and in-memory retrieval as
the current local demo data path.

#### Scenario: Developer follows docs
- **WHEN** a new developer follows the quick start and API documentation
- **THEN** the docs do not list PostgreSQL as a required service or health check
- **AND** the docs identify `var/devassets`, `var/thumbnails`, and `var/renders`
  as the local generated data locations

#### Scenario: Future database use is mentioned
- **WHEN** docs discuss durable conversations, render jobs, larger catalogs, or
  retrieval improvements
- **THEN** database storage is described as a deferred future decision
