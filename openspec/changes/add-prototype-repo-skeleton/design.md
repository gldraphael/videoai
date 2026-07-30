## Context

The repository currently contains project direction and OpenSpec configuration, but no runnable application structure. ADR 0001 defines a prototype composed of React web UI, TypeScript API, TypeScript seed CLI, PostgreSQL, and a Go render service using `gldraphael/vspec`.

Before building the seed service, the project needs a Phase 0 foundation that establishes where each service lives, how services run locally, how generated files are mounted, and how future changes verify the system is still runnable.

## Goals / Non-Goals

**Goals:**

- Establish a monorepo layout for the prototype services.
- Provide Podman-compatible local orchestration for the runnable services.
- Add minimal web, API, and render service shells.
- Add basic API and render health checks.
- Add a PostgreSQL service and a database connectivity smoke check.
- Add conventions for tracked `devassets/catalog.yaml` and gitignored runtime outputs under `var/`.
- Add a seed CLI package location and placeholder command surface for the next change.
- Document the commands needed to start and smoke-test the skeleton.

**Non-Goals:**

- Implement asset seeding, transcription, thumbnail generation, or clip creation.
- Implement chat, clip search, EditPlan generation, `vspec` conversion, or rendering jobs.
- Add auth, user/workspace management, upload UI, embeddings, pgvector, or a timeline editor.
- Finalize every API shape, schema, prompt, UI behavior, or phase acceptance criterion.

## Decisions

### Use a monorepo with service-focused directories

Use a simple service layout:

```text
services/webapp/
services/api/
services/render/
tools/seed/
db/
devassets/
var/
```

This keeps the initial structure obvious and maps directly to the services in ADR 0001. A package-oriented layout was considered, but service directories are easier to navigate for a prototype with separate runtime boundaries.

### Use pnpm workspaces for TypeScript code

The TypeScript web, API, and seed packages should be managed from one workspace so dependency installation and scripts are consistent. This also allows later shared packages to be added without changing the repo shape.

`pnpm` is available in the development environment and gives the prototype a stricter, faster workspace package manager than npm. An isolated package manager per service was considered, but it would add duplicate lockfiles and container setup for little benefit at this stage.

### Keep Go render service separate

The render service should have its own Go module under `services/render/`. This preserves a clean boundary around `gldraphael/vspec`, FFmpeg, and ffprobe while allowing the TypeScript services to evolve independently.

Reimplementing the render boundary in TypeScript was rejected because `vspec` already has a Go library/CLI surface.

### Make Podman Compose the primary local runtime

The skeleton should provide `compose.yaml` and service-specific `Containerfile.*` files. The expected first smoke test is:

```bash
podman compose up --build
```

The compose setup should be rootless-friendly and avoid Docker-specific assumptions. Generated outputs should be written under local gitignored `var/` paths so they are easy to inspect and clean.

### Include only minimal service behavior

The web app should render a simple prototype shell. The API should expose health and database smoke endpoints. The render service should expose a health endpoint. The seed CLI should exist as a package/command placeholder that explains seeding is implemented by a later change.

This keeps Phase 0 small while producing a real Minimal Testable Product.

### Establish tracked source and gitignored runtime path conventions early

The skeleton should define these local paths:

```text
devassets/catalog.yaml     tracked source manifest
devassets/README.md        tracked explanation of devasset inputs
var/devassets/             gitignored prepared/copied/downloaded media
var/renders/               gitignored rendered videos and generated vspec artifacts
var/thumbnails/            gitignored generated poster frames/thumbnails
```

The repository should not track generated media outputs. `devassets/catalog.yaml` is the input manifest; later seed work will make referenced sources available under `var/devassets/` and write derived artifacts under `var/thumbnails/`. Rendering work will write outputs under `var/renders/`.

Containers should use local bind mounts for these paths, for example:

```text
./devassets:/app/devassets:ro
./var/devassets:/data/devassets
./var/renders:/data/renders
./var/thumbnails:/data/thumbnails
```

Bind mounts are preferred over opaque named volumes for prototype media because generated files are useful to inspect from the host. PostgreSQL data can still use a named volume.

## Risks / Trade-offs

- Multiple services before product behavior exists -> Keep each service minimal and validate only health/connectivity in this change.
- Container setup could slow iteration -> Provide direct package scripts where practical, but make Podman Compose the authoritative smoke test.
- Premature structure could be wrong -> Treat ADR 0001 and this proposal as high-level direction; refine package boundaries as later MTP phases expose constraints.
- Generated files could accidentally enter git -> Add `.gitignore` rules for `var/` runtime contents and document that generated media belongs there.
- Seed placeholder may be mistaken for a working importer -> Make the placeholder explicit and document that real seeding belongs to the next change.
- FFmpeg image dependencies can be heavy -> Install FFmpeg only where needed for the skeleton smoke checks and future render/seed work.

## Migration Plan

This is a greenfield repository, so no production migration is required.

Implementation should proceed by adding the skeleton in small increments:

1. Add repo/workspace metadata and documentation.
2. Add web/API/render/seed source directories.
3. Add minimal health endpoints and package scripts.
4. Add database bootstrap/migration conventions.
5. Add Podman Compose and Containerfiles.
6. Run the smoke checks and adjust the skeleton before starting the seed-service proposal.

Rollback is deleting the newly added skeleton files because no existing runtime behavior depends on them.

## Open Questions

- Whether the TypeScript database layer should start with Drizzle ORM or Kysely.
- Whether the web app should use Vite alone or a framework such as Next.js in a later phase.
- Whether the seed CLI should share the API package's database code immediately or start isolated and extract shared code later.
- Whether local development should provide non-container convenience scripts beyond the Podman-first path.
    
