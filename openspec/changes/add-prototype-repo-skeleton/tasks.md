## 1. Repository And Workspace Structure

- [x] 1.1 Create the service/tool directory structure for `services/webapp`, `services/api`, `services/render`, `tools/seed`, `db`, `devassets`, and `var`.
- [x] 1.2 Add root project metadata for a pnpm TypeScript workspace covering the web app, API service, and seed CLI.
- [x] 1.3 Add tracked `devassets/catalog.yaml` and `devassets/README.md` placeholders that document the future source manifest.
- [x] 1.4 Add `.gitignore` rules so generated runtime data under `var/devassets`, `var/renders`, and `var/thumbnails` is not tracked.
- [x] 1.5 Add `.env.example` with the local settings needed by the skeleton services.

## 2. Web Service Skeleton

- [x] 2.1 Add a minimal React + TypeScript web app under `services/webapp`.
- [x] 2.2 Add a simple VideoAI prototype shell page that confirms the web service is running.
- [x] 2.3 Add package scripts for local development and production build of the web app.

## 3. API Service Skeleton

- [x] 3.1 Add a minimal TypeScript Fastify API service under `services/api`.
- [x] 3.2 Add an API health endpoint that returns a healthy response.
- [x] 3.3 Add database connection configuration using environment variables.
- [x] 3.4 Add a database smoke-check endpoint that confirms PostgreSQL connectivity.
- [x] 3.5 Add package scripts for local development and production start of the API service.

## 4. Render Service Skeleton

- [x] 4.1 Add a minimal Go render service under `services/render`.
- [x] 4.2 Add a render-service health endpoint that returns a healthy response.
- [x] 4.3 Add Go module metadata and basic build/run commands.
- [x] 4.4 Leave actual `vspec` validation/rendering behavior for a later change.

## 5. Seed CLI Placeholder

- [x] 5.1 Add a TypeScript seed CLI package under `tools/seed`.
- [x] 5.2 Add a placeholder `seed:devassets` command surface for future `devassets/catalog.yaml` ingestion.
- [x] 5.3 Ensure the placeholder clearly reports that real asset import is out of scope for this skeleton change.

## 6. Database Bootstrap

- [x] 6.1 Add an initial database migration/bootstrap location under `db`.
- [x] 6.2 Add enough schema or bootstrap SQL for the API database smoke check to run reliably.
- [x] 6.3 Document how database bootstrap runs in local Podman development.

## 7. Podman Containerization

- [x] 7.1 Add Podman-compatible `Containerfile.web`, `Containerfile.api`, and `Containerfile.render`.
- [x] 7.2 Add `compose.yaml` for `web`, `api`, `render`, and `postgres`.
- [x] 7.3 Configure service environment variables, ports, dependencies, and volumes.
- [x] 7.4 Mount tracked `devassets/` read-only where the manifest is needed.
- [x] 7.5 Mount gitignored `var/devassets`, `var/renders`, and `var/thumbnails` as writable local bind mounts where generated files are needed.
- [x] 7.6 Mount PostgreSQL data with a rootless-friendly named volume.
- [x] 7.7 Ensure FFmpeg/ffprobe availability is planned or installed where the skeleton needs it for future seed/render phases.

## 8. Documentation And Verification

- [x] 8.1 Add local setup documentation for starting the skeleton with `podman compose up --build`.
- [x] 8.2 Document that `devassets/catalog.yaml` is tracked source configuration and generated media/artifacts belong under gitignored `var/` paths.
- [x] 8.3 Document the intended future seed command for `devassets/catalog.yaml`.
- [x] 8.4 Verify the web app loads through the compose-exposed URL.
- [x] 8.5 Verify the API health endpoint responds successfully.
- [x] 8.6 Verify the API database smoke-check endpoint confirms PostgreSQL connectivity.
- [x] 8.7 Verify the render service health endpoint responds successfully.
- [x] 8.8 Run `openspec status --change add-prototype-repo-skeleton` and confirm the change remains apply-ready.
