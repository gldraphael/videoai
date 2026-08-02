# VideoAI

VideoAI is a prototype for chat-driven video generation with a rich `vspec`
rendering pipeline. This repository currently contains the local development
stack, service boundaries, health checks, and a catalog-driven devasset seed
workflow for preparing sample media.

## Services

- `services/webapp`: React + TypeScript prototype shell
- `services/api`: TypeScript Fastify API with health, database smoke checks,
  and devasset readiness
- `services/render`: Go render-service shell with a health check
- `tools/seed`: TypeScript seed CLI for local devasset media generation
- `traefik`: local reverse proxy for HTTP routing
- `postgres`: local PostgreSQL service from `compose.yaml`

## Local Paths

Tracked source configuration:

- `devassets/catalog.yaml`: URL-only source manifest for sample media
- `devassets/README.md`: notes for development asset conventions

Generated runtime data:

- `var/devassets/`: seed status, media library JSON, source media, audio, and
  transcripts
- `var/thumbnails/`: generated poster frames and thumbnails
- `var/renders/`: generated `vspec` files and rendered videos

The generated `var/*` directories are gitignored and mounted into containers as
local bind mounts so outputs remain inspectable on the host.

## Setup

Copy `.env.example` to `.env` if you want to override local defaults. The
compose file also provides defaults for the skeleton.

Install workspace dependencies:

```bash
pnpm install
```

Run local checks:

```bash
pnpm check
(cd services/render && go test ./...)
```

## Podman

Start the local stack:

```bash
podman compose up --build
```

The `seed` service runs during normal compose startup. On the first run it reads
`devassets/catalog.yaml`, downloads the configured videos, probes metadata,
extracts audio, generates thumbnails, runs `whisper-cli` for word-timestamped
SRT and JSON transcripts, writes `var/devassets/library.json`, and exits. The
webapp shows a setup state until the API reports the generated library is ready.

Expected local URLs:

- Web app: `http://videoai.localhost:8080`
- API health: `http://api.videoai.localhost:8080/health`
- API database smoke check: `http://api.videoai.localhost:8080/health/db`
- API devasset readiness: `http://api.videoai.localhost:8080/devassets/status`
- Render health: `http://render.videoai.localhost:8080/health`

Traefik owns the host HTTP port. The webapp, API, and render service ports are
only exposed inside the compose network. PostgreSQL remains directly available
on `localhost:5432` for local database tooling.

The PostgreSQL container runs SQL files from `db/init/` when its named data
volume is first created.

## Devasset Seed

The seed command can also be run directly through compose:

```bash
podman compose run --rm seed pnpm --filter @videoai/seed seed:devassets devassets/catalog.yaml
```

Use `--force` to regenerate current media artifacts even when the catalog
identity is unchanged:

```bash
podman compose run --rm seed pnpm --filter @videoai/seed seed:devassets devassets/catalog.yaml --force
```

The no-op identity is based only on each asset's `id` and `source.url`. Title
changes refresh `library.json` metadata without re-downloading or regenerating
media artifacts. Delete `var/devassets/` and `var/thumbnails/` to manually clean
all generated seed output before running seed again.
