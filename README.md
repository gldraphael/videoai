# VideoAI

VideoAI is a local prototype for chat-driven video generation. It starts from a
small catalog of sample videos, prepares those videos into local development
assets, lets you search them from a chat UI, and keeps a Go render-service
boundary ready for `vspec` rendering work.

## Quick start

Prerequisites:

- Podman with `podman compose`
- Git and a shell
- Optional for host-side development: pnpm 11.18.0 and Go 1.26.2

The compose file provides local defaults. Copy `.env.example` to `.env` only if
you want to override ports or generated-data paths.

Start the full local stack from the repository root:

```bash
podman compose up --build
```

Then open the app:

```text
http://videoai.localhost:8080
```

The first run can take a while because the seed image builds `whisper.cpp`,
downloads the local Whisper model, downloads the configured videos, and prepares
generated media files. Keep the compose process running while using the app.

Useful local URLs:

- Web app: `http://videoai.localhost:8080`
- API health: `http://api.videoai.localhost:8080/health`
- API devasset readiness: `http://api.videoai.localhost:8080/devassets/status`
- Render health: `http://render.videoai.localhost:8080/health`

Traefik owns the host HTTP port, which defaults to `8080`. The webapp, API, and
render service ports are only exposed inside the compose network.

For host-side checks:

```bash
pnpm install
pnpm check
pnpm --filter @videoai/api test
pnpm --filter @videoai/webapp test
(cd services/render && go test ./...)
```

## Configuration

The main local configuration file is
[`devassets/catalog.yaml`](devassets/catalog.yaml). It lists the sample videos
that the prototype should prepare for local development.

A compact catalog looks like this:

```yaml
version: 1

assets:
  - id: sintel-1280-mirror2
    title: Sintel
    type: video
    source:
      url: http://peach.themazzone.com/durian/movies/sintel-1280-surround.mp4
```

Supported fields:

- `version`: catalog schema version. The current value must be `1`.
- `assets`: non-empty list of sample media assets.
- `id`: stable asset identifier used in generated paths and clip ids.
- `title`: human-readable label shown in library and clip results.
- `type`: currently only `video`.
- `source.url`: absolute `http` or `https` URL for the source video.

Key validation rules:

- Asset ids must be unique lowercase slugs using letters, numbers, and hyphens.
- Asset ids must start and end with a letter or number and must be 2 to 80
  characters long.
- Titles must not be empty.
- Local file paths are not supported in the catalog during this phase.
- Extra top-level, asset-level, or `source` fields are rejected.

The `seed` service reads this catalog during normal compose startup. For each
asset, it downloads the source video, probes media metadata, extracts audio,
generates a thumbnail, creates word-timestamped transcripts, and writes the
local media library that the app and API consume.

Generated files are gitignored and stay inspectable on the host:

- `var/devassets/`: seed status, source media, audio, transcripts, and
  `library.json`
- `var/thumbnails/`: generated poster frames and thumbnails
- `var/renders/`: generated `vspec` files and rendered videos

After changing the catalog, restart the stack or rerun only the seed service:

```bash
podman compose run --rm seed pnpm --filter @videoai/seed seed:devassets devassets/catalog.yaml
```

The seed identity is based on each asset's `id` and `source.url`. Changing a
title refreshes `library.json` metadata without redownloading media. Changing an
asset id or URL creates a new asset identity and prepares new generated outputs.
Use `--force` on the seed command to regenerate existing media artifacts.

More generated-data details live in [`var/README.md`](var/README.md), and
`devassets` directory conventions live in
[`devassets/README.md`](devassets/README.md).

## System architecture

```text
Browser
  |
  v
Traefik on :8080
  |-- videoai.localhost ----------> Webapp (React + Vite)
  |-- videoai.localhost/api/* ----> API (Fastify, /api prefix stripped)
  |-- api.videoai.localhost -----> API (Fastify)
  `-- render.videoai.localhost --> Render service (Go)

devassets/catalog.yaml
  |
  v
Seed service
  |
  v
Generated local data
  |-- var/devassets/library.json
  |-- var/devassets/assets/... source media, audio, transcripts
  |-- var/thumbnails/...
  `-- var/renders/...

API
  |-- reads generated devasset data for status, clip search, thumbnails, previews
  `-- uses the render service boundary for rendered-video workflows
```

Generated files under `var/devassets`, `var/thumbnails`, and `var/renders` are
the current local data path. Database-backed persistence for conversations,
render jobs, larger catalogs, or retrieval is deferred until a future change has
a concrete data model.

## How it works

The catalog is the starting point. It tells the prototype which sample videos to
use, with a stable id, a title, and a URL for each one.

The seed service hides the tedious media-preparation work. Instead of asking you
to download files, inspect codecs, make thumbnails, extract audio, run
transcription, and assemble a local index by hand, it turns the catalog into the
generated files under `var/`.

The webapp is the front door. It shows setup progress until the generated
library is ready, then opens a chat experience where you can describe the kind
of clip you want.

The API connects the chat request to local clip search. It reads the generated
media library and transcripts, returns matching clip candidates, and exposes
browser-safe thumbnail and preview URLs for the webapp. Detailed API route
reference lives in [`services/api/README.md`](services/api/README.md).

The render service is the Go boundary for turning future edit plans into
rendered video outputs. It shares the same generated local data directories as
the API so render inputs and outputs stay visible in the workspace.

Traefik supports the local development environment by giving the stack stable
local hostnames that match how the browser talks to the services.
