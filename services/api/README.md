# API Service

`services/api` is the Fastify service behind local health checks, devasset
readiness, clip search, assistant chat responses, and browser-safe generated
media routes.

Routes below are listed as service-local paths. Through Traefik, they are
available either on `http://api.videoai.localhost:8080` without a prefix or on
`http://videoai.localhost:8080/api` with the `/api` prefix stripped before the
request reaches Fastify.

## Development commands

From the repository root:

```bash
pnpm --filter @videoai/api dev
pnpm --filter @videoai/api check
pnpm --filter @videoai/api test
pnpm --filter @videoai/api build
```

The compose stack sets these API environment variables:

- `API_PORT`
- `DATABASE_URL`
- `DEVASSETS_DIR`
- `RENDERS_DIR`
- `THUMBNAILS_DIR`

## Health and readiness

```text
GET /health
GET /health/db
GET /devassets/status
```

`GET /health` returns the API service health. `GET /health/db` checks
PostgreSQL connectivity and reports the schema version from the initialized
database. `GET /devassets/status` returns the generated devasset state consumed
by the webapp. Devassets are ready only after the seed flow has written both the
seed status file and `var/devassets/library.json`.

## Clip search

```text
POST /clips/search
```

Through the webapp host:

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

If local devassets are missing, still running, or failed, the endpoint returns
`503` with `error: "devassets_not_ready"` and the current devasset state instead
of stale results.

Clip search reads `var/devassets/library.json` only after devassets are ready,
then loads each referenced `whisper.cpp` transcript JSON file. Usable transcript
entries are normalized, empty or special-token-only text is filtered, and
adjacent timed entries are merged into deterministic clip windows with stable
ids in the form `<asset-id>:<start-ms>-<end-ms>`. Assets without usable
transcript text produce fixed-duration fallback windows from media duration and
asset metadata; fallback windows leave the transcript snippet empty.

## Assistant chat

```text
POST /chat
```

Through the webapp host:

```bash
curl --fail -sS \
  -H 'content-type: application/json' \
  -d '{"message":"launch recap with product demo","limit":8}' \
  http://videoai.localhost:8080/api/chat
```

Request body:

```json
{
  "message": "launch recap with product demo",
  "limit": 8
}
```

`message` is required and must contain non-whitespace text. `limit` is optional,
defaults to `8`, and is capped at `20`.

The endpoint calls the same clip search service as `POST /clips/search` and
returns assistant content parts:

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
clip cards. Empty searches return explanatory text plus an empty candidate
list. The API does not fabricate clip ids, snippets, paths, or media URLs.

This chat path is deterministic and local in the current prototype phase. It
does not require OpenAI, Gemini, or another model-provider API key.

## Browser media routes

Clip search and chat responses preserve trusted generated references such as
`var/thumbnails/...` and `var/devassets/...` for backend validation. Chat
responses also include browser-fetchable URLs:

```text
var/thumbnails/example.jpg
  -> /api/media/thumbnails/example.jpg

var/devassets/assets/example/<identity>/source.mp4
  -> /api/media/devassets/assets/example/<identity>/source.mp4
```

Service-local routes:

```text
GET /media/thumbnails/*
GET /media/devassets/*
GET /media/*
```

The API resolves media route suffixes only under configured `THUMBNAILS_DIR` and
`DEVASSETS_DIR` roots. Thumbnail routes serve supported generated image formats.
Devasset preview routes serve generated `source.mp4`, `source.mov`, or
`source.webm` files and support browser byte-range requests. Transcript JSON,
SRT files, audio extraction artifacts, seed status files, library metadata,
path traversal, absolute paths, and unsupported file names are rejected.
