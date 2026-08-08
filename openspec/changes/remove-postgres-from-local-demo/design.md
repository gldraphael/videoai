## Context

See `proposal.md` for motivation. PostgreSQL is currently present in four
places:

- `compose.yaml` defines a `postgres` service, named volume, exposed port, and
  API dependency.
- `services/api` creates a `pg` pool for `/health/db`.
- `.env.example`, README, API docs, and database docs describe database
  configuration or smoke checks.
- API tests inject database fakes to prove chat/search/media routes do not touch
  the database.

The active demo path uses generated local files and in-memory search:

```text
devassets/catalog.yaml
  -> seed
  -> var/devassets/library.json + transcripts + thumbnails
  -> API in-memory clip search
  -> /chat and clip cards
```

## Goals / Non-Goals

**Goals:**

- Make the default local stack start without PostgreSQL.
- Make API startup and health independent of database configuration.
- Remove unused PostgreSQL client dependencies.
- Keep generated files under `var/` as the documented local data path.
- Keep future durable storage explicitly deferred.

**Non-Goals:**

- Do not replace PostgreSQL with SQLite.
- Do not change clip search, chat, selected-clip state, seeding, media serving,
  or render-service behavior.
- Do not introduce durable conversations, saved selections, or render-job
  persistence in this change.

## Decisions

### Remove the database smoke-check endpoint from the default API surface

The cleanest outcome is to remove `/health/db` rather than keep a fake or
optional database check. The default health surface should reflect what the
local demo actually needs: API process health and devasset readiness.

Alternative considered: keep `/health/db` but return a message saying the
database is disabled. That preserves a stale route and invites clients to keep
checking a dependency the app does not need.

### Remove API database construction entirely

The Fastify app should no longer require a `database` option, and `server.ts`
should no longer create or close a database pool. Tests can delete
`databaseThatMustNotBeUsed` helpers instead of proving every route avoids a
dead dependency.

Alternative considered: keep the database abstraction but leave it unwired.
That keeps unused types and constructor plumbing in the app.

### Remove PostgreSQL from compose rather than hiding it behind a profile

The default local demo should list only services that are required for the demo:
Traefik, webapp, API, render, and seed. PostgreSQL can return in a future change
with a concrete persistence requirement.

Alternative considered: move Postgres to an optional profile. That still leaves
docs and local setup explaining infrastructure that current behavior does not
use.

### Treat database docs and bootstrap SQL as archival or remove them

If `db/` remains, docs should clearly say it is historical/deferred and not part
of quick start. If no active reference needs it, removing the bootstrap SQL is
acceptable because it only supports the old smoke check.

## Risks / Trade-offs

- Old local bookmarks or scripts may call `/health/db` -> Update docs and tests,
  and let the route disappear as part of the narrowed API surface.
- Future persistence still needs design work -> Keep database reintroduction as a
  deferred decision tied to a real data model.
- Compose changes can be confused with unrelated local edits -> Keep the diff
  limited to the Postgres service, volume, environment variable, dependency, and
  docs.

## Migration Plan

This change has no data migration. Existing local `postgres-data` volumes can be
left unused or removed manually by developers who want to clean their machine.

Implementation should:

1. Remove API database code and update route construction/tests.
2. Remove PostgreSQL dependencies and lockfile entries.
3. Remove Postgres from default compose and environment examples.
4. Remove or archive `db/` bootstrap docs.
5. Update README/API/OpenSpec docs to describe generated files as the current
   local data path.
6. Run API, webapp, render, workspace, OpenSpec, and default compose validation.
