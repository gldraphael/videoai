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

## Phase 3 Chat Flow

Phase 3 replaces the ready-state web shell with an `assistant-ui` chat
experience at `http://videoai.localhost:8080` once local devassets are ready.
The chat path is deterministic and local: no OpenAI, Gemini, or other
model-provider API key is required.

The webapp sends creative requests to the API through Traefik:

```text
POST /api/chat
```

The Fastify route behind the stripped `/api` prefix is:

```text
POST /chat
```

Request body:

```json
{
  "message": "launch recap with product demo",
  "limit": 8
}
```

`message` is required and must contain non-whitespace text. `limit` is optional,
defaults to `8`, and is capped at `20`. The endpoint calls the same in-memory
clip retrieval service as `POST /clips/search` and returns assistant content
parts:

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I found 1 local clip matching \"launch recap\". Select clips to keep them for a later edit plan."
    },
    {
      "type": "clip-candidates",
      "query": "launch recap",
      "candidates": [
        {
          "id": "launch-demo:0-13400",
          "assetId": "launch-demo",
          "title": "Launch Product Demo",
          "startMs": 0,
          "endMs": 13400,
          "snippet": "The launch recap opens with a product demo.",
          "thumbnailPath": "var/thumbnails/launch-demo.jpg",
          "previewPath": "var/devassets/assets/launch-demo/test/source.mp4",
          "thumbnailUrl": "/api/media/thumbnails/launch-demo.jpg",
          "previewUrl": "/api/media/devassets/assets/launch-demo/test/source.mp4",
          "score": 34
        }
      ]
    }
  ]
}
```

The `text` part is rendered as the assistant response. The `clip-candidates`
part is structured data consumed by the webapp's custom renderer for selectable
clip cards. Empty searches return an explanatory text part plus an empty
candidate list; the API does not fabricate clip ids, snippets, paths, or media
URLs.

If devassets are missing, running, or failed, `POST /chat` returns
`devassets_not_ready` with the current devasset state. The webapp keeps selected
clips visible when a chat request fails.

## Browser Media URLs

Clip search and chat responses preserve trusted generated references such as
`var/thumbnails/...` and `var/devassets/...` for backend validation. Phase 3
also derives browser-fetchable URLs for thumbnails and source video previews:

```text
var/thumbnails/example.jpg
  -> /api/media/thumbnails/example.jpg

var/devassets/assets/example/<identity>/source.mp4
  -> /api/media/devassets/assets/example/<identity>/source.mp4
```

The API resolves media route suffixes only under configured `THUMBNAILS_DIR` and
`DEVASSETS_DIR` roots. Thumbnail routes serve supported generated image formats.
Devasset preview routes serve generated `source.mp4`, `source.mov`, or
`source.webm` files and support browser byte-range requests. Transcript JSON,
SRT files, audio extraction artifacts, seed status files, library metadata, path
traversal, absolute paths, and unsupported file names are rejected.

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
