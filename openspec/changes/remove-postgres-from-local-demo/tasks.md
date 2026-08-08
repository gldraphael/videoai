## 1. API Database Removal

- [x] 1.1 Remove the API database abstraction and PostgreSQL pool code.
- [x] 1.2 Remove database construction and shutdown from API server startup.
- [x] 1.3 Remove the required `database` option from Fastify app construction.
- [x] 1.4 Remove or retire `GET /health/db` so the default API health surface does not query PostgreSQL.
- [x] 1.5 Update API tests to construct the app without database fakes.
- [x] 1.6 Add or update API tests proving `/health`, `/devassets/status`, `/chat`, `/clips/search`, and media routes work without database configuration.

## 2. Dependency And Config Cleanup

- [x] 2.1 Remove `pg` from API runtime dependencies.
- [x] 2.2 Remove `@types/pg` from API dev dependencies.
- [x] 2.3 Refresh the pnpm lockfile after dependency removal.
- [x] 2.4 Remove `DATABASE_URL` from API config and defaults.
- [x] 2.5 Remove `DATABASE_URL` from `.env.example` and compose API environment.

## 3. Compose And Database Assets

- [x] 3.1 Remove the `postgres` service from `compose.yaml`.
- [x] 3.2 Remove API `depends_on` references to `postgres`.
- [x] 3.3 Remove the exposed database port and `postgres-data` volume from the default compose stack.
- [x] 3.4 Remove `db/init` bootstrap usage from default local setup.
- [x] 3.5 Remove or clearly mark `db/README.md` and bootstrap SQL as archival/deferred if the directory remains.

## 4. Documentation

- [x] 4.1 Update the root README quick start and useful URLs to remove PostgreSQL and `/health/db`.
- [x] 4.2 Update the architecture diagram and prose to describe generated files under `var/` as the current local data path.
- [x] 4.3 Update `services/api/README.md` to remove `DATABASE_URL` and database health documentation.
- [x] 4.4 Update `openspec/config.yaml` so future OpenSpec instructions no longer prefer PostgreSQL for the current local demo path.
- [x] 4.5 Ensure docs mention database-backed persistence only as a deferred future decision.

## 5. Verification

- [x] 5.1 Run `pnpm --filter @videoai/api test`.
- [x] 5.2 Run `pnpm --filter @videoai/api check`.
- [x] 5.3 Run `pnpm --filter @videoai/webapp test`.
- [x] 5.4 Run `pnpm --filter @videoai/webapp check`.
- [x] 5.5 Run `(cd services/render && go test ./...)`.
- [x] 5.6 Run `pnpm check`.
- [x] 5.7 Run `openspec validate remove-postgres-from-local-demo --type change --strict`.
- [x] 5.8 Start the default local stack with `podman compose up --build` and verify no PostgreSQL service is required.
