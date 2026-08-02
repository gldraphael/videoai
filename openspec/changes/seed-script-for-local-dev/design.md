## Context

The repository currently has a Phase 0 skeleton with a placeholder seed
command, empty catalog, stable gitignored runtime paths, and local Podman
Compose orchestration. The next local-development milestone is to let a
developer start the stack and get a usable media library generated from tracked
source configuration.

The app should not require PostgreSQL writes to prepare local media. It should
also not assume the seed process is always running, because seed is a one-shot
tool that may spend minutes preparing assets and then exit. The durable contract
between seed, API, and webapp should be generated files under shared runtime
mounts.

## Goals / Non-Goals

**Goals:**

- Generate a local media library from `devassets/catalog.yaml`.
- Keep catalog authoring minimal: `id`, `title`, `type`, and `source.url`.
- Keep the implementation lean, readable, and easy to maintain.
- Download source videos and avoid downloading again when the current asset
  source file already exists.
- Probe video metadata, generate thumbnails, extract audio, and create
  word-timestamped transcript files.
- Use `whisper.cpp` inside the seed container for local transcript generation.
- Write `var/devassets/library.json` as the media library index.
- Reference transcript files from `library.json` rather than embedding full
  transcript payloads.
- Keep `seed` in `compose.yaml` as a first-class service that runs during local
  compose startup.
- Surface seed readiness through an API endpoint so the webapp can show setup,
  ready, and error states.
- Make reruns no-ops when the catalog identity and generated outputs are
  unchanged.

**Non-Goals:**

- Insert seed output into PostgreSQL.
- Implement PostgreSQL full-text retrieval.
- Implement chat, clip selection, EditPlan generation, or rendering.
- Add upload UI or production ingestion workers.
- Support local source paths in the catalog for this phase.
- Detect remote content changes when an asset keeps the same `id` and URL.

## Decisions

### Prefer the simplest maintainable seed implementation

The seed command should be built around the generated-file contract, not around
a predetermined application framework. TypeScript remains acceptable because the
repository already has a `tools/seed` package, but Bash or another small
container-local script is also acceptable if it keeps the workflow simpler.

The implementation should still use real parsers or purpose-built CLI tools for
structured data and media work. The important constraint is to avoid adding
unnecessary abstractions, service layers, or dependencies that do not make the
seed workflow easier to understand.

### Use JSON files as the local media library contract

The seed script should materialize `var/devassets/library.json` and related
artifact files. The API can read those files to expose local readiness and later
media-library behavior.

This keeps media setup independent from database lifecycle and makes generated
state easy to inspect, delete, cache, and regenerate. Direct PostgreSQL upserts
were considered because ADR 0001 names Postgres full-text search as a future
retrieval direction, but requiring database writes during local media setup
would make the first developer experience more fragile than needed.

### Keep `catalog.yaml` minimal and URL-only

The catalog schema should be:

```yaml
version: 1

assets:
  - id: launch-interview
    title: Launch Interview
    type: video
    source:
      url: https://example.com/media/launch-interview.mp4
```

`id` is the stable local identity, `title` is display metadata, `type` declares
the media kind, and `source.url` is the only supported source location in this
phase.

Richer catalog fields such as tags, notes, checksums, poster timestamps,
thumbnail schedules, and per-asset transcript options were considered. They are
useful later, but the current request favors the smallest authoring surface that
can generate a media library.

### Hash only asset IDs and URLs for seed identity

Seed should compute a deterministic catalog identity hash from the ordered or
canonicalized set of asset `id` and `source.url` pairs. Title and type changes
should update generated library metadata but should not force download,
thumbnail, audio, or transcript regeneration.

The seed process should treat downloaded files as reusable when the current
asset identity already has a source file. If an asset `id` or URL changes, that
asset identity changes and generated outputs for that asset should be rebuilt
unless `--force` causes a full rebuild.

Remote checksum validation was considered and rejected for this phase. The
trade-off is intentional: remote content changes at the same URL are not
detected automatically.

### Generate separate transcript artifacts with `whisper.cpp`

Seed should extract normalized audio with FFmpeg and run `whisper-cli` to
produce word-timestamped SRT output plus native JSON output. `library.json`
should record a transcript reference with format, path, JSON path, generator,
model, and language when known.

Embedding transcripts directly in `library.json` was considered, but separate
SRT and JSON files keep the library compact and allow the API to load transcript
detail only when needed.

### Add a dedicated seed image

Create `Containerfile.seed` instead of extending the API image with seed-only
dependencies. The seed image should include the minimum runtime needed by the
chosen implementation plus:

- FFmpeg and ffprobe.
- Build/runtime dependencies for `whisper.cpp`.
- `whisper-cli`.
- A default Whisper model suitable for local development.

This makes the default local workflow self-contained while keeping the API image
small. If TypeScript is the chosen implementation, the image can include Node
and pnpm. If a shell-oriented implementation is simpler, the image can instead
include small command-line helpers such as `curl` and a YAML/JSON processor.
Model selection can be made configurable with build args or environment
variables later, but a default should work out of the box.

### Keep seed in Compose and communicate through files plus API

The `seed` service should be part of the normal `compose.yaml` service graph,
not hidden behind a tools-only profile. It should start during local compose
startup, write progress state, and exit with status 0 after setup is ready or
skipped.

The webapp should not call seed directly because seed is a one-shot service.
Instead:

```text
seed -> var/devassets/.seed/status.json -> API -> webapp
```

The API should expose a devasset status endpoint. The webapp should poll that
endpoint and render a setup page while state is missing/running, the normal app
when ready, and an error state when seeding failed.

### Write generated state atomically

Seed should write status and library updates through temporary files and atomic
renames. This avoids serving partially written JSON while the API polls for
readiness.

## Risks / Trade-offs

- Seed image size grows because it includes transcription tooling -> Keep the
  toolchain isolated in `Containerfile.seed` so API/web images remain smaller.
- First-run transcription can take minutes -> Surface progress through status
  messages and keep later runs no-op.
- Remote media can change without changing URL -> Document that id/URL are the
  cache identity and support `--force` or deletion of generated outputs.
- A failed seed run could leave stale status -> Seed should write explicit error
  state on failure and overwrite status at the start of each run.
- API might read half-written output -> Use atomic writes for `status.json` and
  `library.json`.
- Compose startup ordering can be misleading -> Do not block API/webapp startup
  on seed completion; let the webapp show setup state through the API.

## Migration Plan

This is still local prototype behavior with no production data migration.

Implementation should:

1. Add the catalog contract and generated file contracts.
2. Add the dedicated seed container image and update compose to run it as a
   normal service.
3. Replace the seed placeholder with the media-generation pipeline.
4. Add API status/readiness over generated seed files.
5. Add webapp setup/ready/error handling.
6. Update local development documentation.

Rollback is removing the new seed behavior, deleting generated `var/` outputs,
and returning compose to the previous placeholder seed command. No persistent
application data is migrated in this phase.

## Open Questions

- Which default Whisper model should be baked into the seed image for the best
  balance of build size and transcript quality?
- Should stale generated asset directories be cleaned automatically when catalog
  entries are removed, or left for manual cleanup in the first implementation?
- Should the API expose only setup status in this change, or also expose the
  generated library JSON for early inspection?
