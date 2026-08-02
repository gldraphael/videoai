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

## Clip Search API

Phase 2 exposes an in-memory, file-backed clip retrieval endpoint from the API:

```text
POST /clips/search
```

Through the webapp host and Traefik prefix, call it as:

```bash
curl --fail -sS \
  -H 'content-type: application/json' \
  -d '{"query":"launch recap with product demo","limit":8}' \
  http://videoai.localhost:8080/api/clips/search
```

Request body:

```json
{
  "query": "launch recap with product demo",
  "limit": 8
}
```

`query` is required and must contain non-whitespace text. `limit` is optional,
defaults to `8`, and is capped at `20`.

Successful responses include the normalized query and ranked candidate clips:

```json
{
  "query": "launch recap with product demo",
  "results": [
    {
      "id": "launch-demo:0-13400",
      "assetId": "launch-demo",
      "title": "Launch Product Demo",
      "startMs": 0,
      "endMs": 13400,
      "snippet": "The launch recap opens with a product demo.",
      "thumbnailPath": "var/thumbnails/launch-demo.jpg",
      "previewPath": "var/devassets/assets/launch-demo/test/source.mp4",
      "score": 34
    }
  ]
}
```

If local devassets are missing, still running, or failed, the endpoint returns a
non-ready response with the current devasset state and message instead of stale
results.

Clip search reads `var/devassets/library.json` only after the devasset status is
ready, then loads each referenced `whisper.cpp` transcript JSON file. Usable
transcript entries are normalized, empty or special-token-only text is filtered,
and adjacent timed entries are merged into deterministic clip windows with
stable ids in the form `<asset-id>:<start-ms>-<end-ms>`. Assets without usable
transcript text still produce fixed-duration fallback windows from media
duration and asset metadata; fallback windows leave the transcript snippet empty
rather than inventing transcript content.

Retrieval is intentionally local for this phase: the API uses generated files
and in-memory lexical ranking. PostgreSQL remains available for database smoke
checks, but clip search does not depend on database connectivity; durable
PostgreSQL-backed retrieval is deferred by ADR 0004.

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
