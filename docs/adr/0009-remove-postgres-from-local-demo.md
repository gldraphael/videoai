# ADR 0009: Remove PostgreSQL From Local Demo

## Status

Proposed.

Supports OpenSpec change `remove-postgres-from-local-demo`.

## Context

[ADR 0004: Lean Chat-First Video AI Prototype Architecture](0004-lean-chat-first-video-ai-prototype-architecture.md)
superseded the PostgreSQL-first direction from ADR 0001 for the current
prototype increments. It says PostgreSQL is removed from the critical path and
deferred until the project needs durable user data, larger catalogs,
multi-session history, concurrent job coordination, or retrieval behavior that
does not fit comfortably in process memory.

Later implementation followed that direction:

- seed writes generated local media state under `var/devassets/` and
  `var/thumbnails/`
- clip retrieval reads `var/devassets/library.json` and builds an in-memory
  index
- assistant chat and clip selection work without PostgreSQL or model-provider
  credentials

What remains is skeleton residue: a Postgres compose service, `DATABASE_URL`,
`pg`, `/health/db`, `db/init`, and docs that still present a database as part of
the default local setup.

## Decision

Remove PostgreSQL from the default local demo.

The default local stack should require only:

```text
traefik
webapp
api
render
seed
```

The current local data path is generated files plus in-memory API state:

```text
devassets/catalog.yaml
  -> seed
  -> var/devassets/library.json + transcripts
  -> var/thumbnails
  -> API in-memory clip index
  -> assistant chat and selected clips
```

The API should start without `DATABASE_URL`, should not construct a PostgreSQL
pool, and should not expose a default health check that queries a database.
`/health` and `/devassets/status` are the useful health/readiness surfaces for
the current local demo.

Database-backed persistence remains a future design decision. If durable
conversations, saved selections, render-job persistence, larger catalogs, or
more sophisticated retrieval become real requirements, the project can introduce
the right database with a concrete data model.

## Alternatives Considered

### Keep PostgreSQL In Compose But Unused

This avoids deleting the skeleton service, but it keeps unnecessary startup
surface, docs, ports, environment variables, and package dependencies. It also
makes new contributors wonder which part of the app needs a database.

### Move PostgreSQL To An Optional Profile

An optional profile is better than a required service, but it still asks docs and
maintenance work to explain infrastructure with no current behavior. A future
change can add a profile when there is a concrete use case.

### Replace PostgreSQL With SQLite

SQLite would be a reasonable local persistence choice if the demo had durable
state. It does not. Generated files and in-memory indexing already satisfy the
current local workflow, so adding SQLite would trade one unnecessary database for
another.

## Consequences

The local demo becomes simpler to run and explain. The default setup no longer
starts a database container, exposes a database port, or installs PostgreSQL
client packages for a smoke check.

The repository documentation becomes more consistent with ADR 0004: generated
files under `var/` are the local source of truth, and database-backed durability
is deferred.

Any local scripts or bookmarks that call `/health/db` will need to switch to
`/health` or `/devassets/status`.

## Validation

The implementation should validate this decision by:

- starting the default compose stack without a PostgreSQL service
- running API tests without database fakes or PostgreSQL connectivity
- confirming API startup does not require `DATABASE_URL`
- confirming `/health` and `/devassets/status` cover current health/readiness
- updating docs so PostgreSQL appears only as a deferred future option
