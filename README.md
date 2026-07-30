# VideoAI

VideoAI is a prototype for chat-driven video generation with a rich `vspec`
rendering pipeline. This repository currently contains the Phase 0 skeleton:
service boundaries, local container orchestration, health checks, and path
conventions for later seed/render work.

## Services

- `services/webapp`: React + TypeScript prototype shell
- `services/api`: TypeScript Fastify API with health and database smoke checks
- `services/render`: Go render-service shell with a health check
- `tools/seed`: TypeScript seed CLI placeholder for future `devassets` ingestion
- `traefik`: local reverse proxy for HTTP routing
- `postgres`: local PostgreSQL service from `compose.yaml`

## Local Paths

Tracked source configuration:

- `devassets/catalog.yaml`: future source manifest for sample media
- `devassets/README.md`: notes for development asset conventions

Generated runtime data:

- `var/devassets/`: prepared, copied, or downloaded sample media
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
go test ./...
```

## Podman

Start the skeleton:

```bash
podman compose up --build
```

Expected local URLs:

- Web app: `http://videoai.localhost:8080`
- API health: `http://api.videoai.localhost:8080/health`
- API database smoke check: `http://api.videoai.localhost:8080/health/db`
- Render health: `http://render.videoai.localhost:8080/health`

Traefik owns the host HTTP port. The webapp, API, and render service ports are
only exposed inside the compose network. PostgreSQL remains directly available
on `localhost:5432` for local database tooling.

The PostgreSQL container runs SQL files from `db/init/` when its named data
volume is first created.

## Seed Placeholder

The future devasset seed command is:

```bash
podman compose run --rm seed pnpm --filter @videoai/seed seed:devassets devassets/catalog.yaml
```

For now, the command is a placeholder. Real asset import, transcription,
thumbnail generation, and database upserts are intentionally out of scope for
this skeleton.
