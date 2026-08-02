## Why

Developers need a one-command local setup path that turns the tracked devasset
catalog into a usable media library for the prototype. The current seed command
is only a placeholder, so the web app cannot distinguish "still setting up"
from "ready to use" and developers do not have generated media, thumbnails, or
word-timestamped transcripts available locally.

## What Changes

- Replace the seed placeholder with a real local devasset seed workflow driven
  by `devassets/catalog.yaml`.
- Keep the catalog intentionally small: each asset declares only `id`, `title`,
  `type`, and `source.url`.
- Keep the seed implementation lean and easy to maintain. TypeScript is allowed
  if it remains the simplest path, but Bash or another small container-local
  script is also acceptable.
- Add a dedicated seed container image that includes the seed CLI dependencies,
  FFmpeg/ffprobe, `whisper.cpp`, `whisper-cli`, and a default Whisper model.
- Keep `seed` in `compose.yaml` as a service that runs during local compose
  startup, reports setup progress, and exits successfully when setup is ready
  or skipped.
- Generate local runtime artifacts under gitignored paths:
  `var/devassets/library.json`, per-asset source media/audio/transcript files
  under `var/devassets/assets/`, and thumbnails under `var/thumbnails/`.
- Use `whisper.cpp` to generate word-timestamped SRT and JSON transcript files
  and reference those files from `library.json` instead of embedding full
  transcripts in the library index.
- Make consecutive seed runs a no-op when the catalog identity hash, based only
  on each asset's `id` and `source.url`, matches the existing outputs.
- Expose devasset setup status through the API so the webapp can show a
  "Setting things up" page while the seed service is running.
- Document the catalog format, generated file layout, compose workflow, and
  cache/no-op behavior.
- Do not insert seed output into PostgreSQL in this phase.

## Capabilities

### New Capabilities

- `local-devasset-library`: catalog-driven local media setup, generated media
  library JSON, generated thumbnail/transcript artifacts, seed status reporting,
  and webapp readiness behavior.

### Modified Capabilities

- None.

## Impact

- Affects `devassets/catalog.yaml`, `devassets/README.md`, and runtime
  conventions under `var/devassets/` and `var/thumbnails/`.
- Affects the seed command by replacing the placeholder with catalog validation,
  download reuse, media probing, thumbnail generation, audio extraction, local
  transcription, artifact generation, and status reporting. This can live in
  `tools/seed` or in another small script location if that produces a simpler
  implementation.
- Adds a dedicated `Containerfile.seed` and updates `compose.yaml` so `seed`
  runs as a first-class local service rather than sharing the API image.
- Affects the API by adding a devasset status/readiness endpoint over generated
  files.
- Affects the webapp by adding a setup/loading state before the local media
  library is ready.
- Adds the minimum dependencies needed for catalog parsing, media command
  execution, download handling, and the seed container's media/transcription
  toolchain.
