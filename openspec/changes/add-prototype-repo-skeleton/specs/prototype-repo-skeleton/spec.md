## ADDED Requirements

### Requirement: Repository Defines Prototype Service Boundaries

The repository SHALL define clear locations for the web app, API service, render service, seed CLI, database assets, tracked development asset manifests, and gitignored runtime outputs.

#### Scenario: Developer inspects the skeleton layout

- **WHEN** a developer checks out the repository after this change
- **THEN** the repository contains service or tool directories for `services/webapp`, `services/api`, `services/render`, and `tools/seed`
- **AND** the repository contains documented locations for `db`, `devassets/catalog.yaml`, `var/devassets`, `var/renders`, and `var/thumbnails`

### Requirement: Podman Compose Starts Core Services

The repository SHALL provide Podman-compatible compose orchestration for the runnable prototype services.

#### Scenario: Developer starts the skeleton

- **WHEN** a developer runs `podman compose up --build`
- **THEN** the PostgreSQL, API, render, and web services start successfully
- **AND** the services use repository-defined configuration rather than ad hoc local commands

### Requirement: API Exposes Health And Database Smoke Checks

The API service SHALL expose a health check and a database connectivity check suitable for validating the skeleton.

#### Scenario: Developer validates API health

- **WHEN** a developer requests the API health endpoint
- **THEN** the API responds successfully with a healthy status

#### Scenario: Developer validates database connectivity

- **WHEN** a developer requests the API database smoke-check endpoint
- **THEN** the API confirms it can connect to PostgreSQL

### Requirement: Render Service Exposes Health Check

The render service SHALL expose a minimal health check suitable for validating that the Go service is running.

#### Scenario: Developer validates render service health

- **WHEN** a developer requests the render service health endpoint
- **THEN** the render service responds successfully with a healthy status

### Requirement: Web App Loads Prototype Shell

The web service SHALL serve a minimal React application shell for the prototype.

#### Scenario: Developer opens the web app

- **WHEN** a developer opens the local web URL exposed by Podman Compose
- **THEN** the browser displays the VideoAI prototype shell
- **AND** the page indicates that the skeleton is running

### Requirement: Seed CLI Has A Placeholder Command Surface

The repository SHALL include a seed CLI package location and documented command surface for future `devassets` ingestion work.

#### Scenario: Developer inspects seed command availability

- **WHEN** a developer reviews the seed package scripts or documentation
- **THEN** they can identify the intended command for future `devassets/catalog.yaml` ingestion
- **AND** the skeleton clearly indicates that actual asset import is out of scope for this change

### Requirement: Development Asset Manifest Is Tracked

The repository SHALL establish `devassets/catalog.yaml` as the tracked source manifest for future development asset ingestion.

#### Scenario: Developer reviews the devasset source manifest

- **WHEN** a developer reviews the local-development documentation
- **THEN** `devassets/catalog.yaml` is documented as the source of truth for future sample asset ingestion
- **AND** actual prepared media generated from the manifest is documented as runtime data rather than tracked source

### Requirement: Local Generated Paths Are Gitignored And Stable

The repository SHALL establish stable gitignored local paths for prepared development assets, rendered outputs, and generated thumbnails.

#### Scenario: Developer prepares for later seed and render phases

- **WHEN** a developer reviews the local-development documentation, gitignore rules, and compose mounts
- **THEN** `var/devassets/`, `var/renders/`, and `var/thumbnails/` are the documented paths for generated inputs and outputs
- **AND** those paths are excluded from source control except for any intentional placeholder or documentation files
- **AND** those paths are compatible with rootless Podman local development

### Requirement: Runtime Asset Paths Are Shared Through Bind Mounts

The repository SHALL configure local container mounts so generated devassets and renders can be inspected on the host and shared between services.

#### Scenario: Developer inspects compose mounts

- **WHEN** a developer reviews the Podman Compose configuration
- **THEN** the tracked `devassets/` directory is mounted read-only where services need the manifest
- **AND** gitignored `var/devassets/`, `var/renders/`, and `var/thumbnails/` paths are mounted as writable runtime data where services need generated files
