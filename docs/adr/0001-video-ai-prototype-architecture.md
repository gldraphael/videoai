# ADR 0001: Video AI Prototype Architecture

## Status

Accepted as high-level direction.

## Context

We want to build a prototype Video AI web application that demonstrates an end-to-end chat-driven video creation workflow.

The intended user flow is:

1. The app has a database of available video/audio/image assets.
2. The user types a prompt in a chat interface describing the desired video.
3. The app searches available clips and presents relevant candidates.
4. The user selects the clips they want to use.
5. The app generates a rich `vspec` document from the selected clips and requested style.
6. The app renders the final video using `vspec` and FFmpeg.

The goal of the prototype is to showcase the system's ability to create polished videos using `vspec`. It is not intended to prove production-grade asset upload, user management, or retrieval sophistication.

This ADR sets the project direction, service boundaries, and intended phase outcomes. It is not a complete implementation specification. The detailed scope, APIs, schemas, prompts, UI behavior, and acceptance criteria for each phase will be refined as development progresses and each Minimal Testable Product exposes new constraints.

The local `vspec` project already provides a Go library/CLI capable of decoding, validating, compiling, and rendering `vspec` documents through FFmpeg. The application should use this instead of reimplementing render planning in TypeScript.

## Decision

Build a containerized prototype composed of:

- A React web frontend with an existing chat UI library.
- A TypeScript API service for chat orchestration, clip retrieval, edit-plan validation, and render job coordination.
- A TypeScript seed/import CLI for loading development assets into PostgreSQL.
- A PostgreSQL database using built-in full-text search.
- A Go render service that uses `github.com/gldraphael/vspec` and FFmpeg.
- Podman Compose for local development and orchestration.

Use `devassets`, not `fixtures`, for sample media and the import catalog:

```text
devassets/
  catalog.yaml
  media/
    launch-interview.mp4
    product-demo.mp4
    office-broll.mp4
    upbeat-bed.wav
    logo.png
```

The prototype will not include authentication, account/workspace management, upload UI, production ingestion workers, vector embeddings, or a full timeline editor.

## Architecture

```text
┌──────────────────────┐
│ Web UI               │
│ React + assistant-ui │
└──────────┬───────────┘
           │ HTTP/SSE
           ▼
┌────────────────────────────────────┐
│ API Service                         │
│ TypeScript + Fastify                │
│ chat, search, selections, renders   │
└───────┬───────────────┬────────────┘
        │ SQL           │ HTTP
        ▼               ▼
┌──────────────┐   ┌──────────────────────┐
│ PostgreSQL   │   │ Render Service        │
│ full-text DB │   │ Go + gldraphael/vspec │
└──────────────┘   │ FFmpeg / ffprobe      │
        ▲          └──────────┬───────────┘
        │                     │
┌───────┴────────────┐        ▼
│ Seed Service / CLI │   rendered outputs
│ TS + ffprobe       │   var/renders/
│ Whisper transcript │
└────────────────────┘
        ▲
        │
devassets/
  catalog.yaml
  media/*.mp4
  media/*.wav
  media/*.png
```

## Service Stack

| Service | Technology | Responsibilities | Candidate libraries/tools |
| --- | --- | --- | --- |
| `web` | React + TypeScript | Chat UI, clip result cards, clip selection, render status, output playback | Vite, `assistant-ui`, TanStack Query, Tailwind/shadcn-style components |
| `api` | Node.js + TypeScript | Chat orchestration, clip search, selection state, EditPlan validation, render coordination | Fastify, Zod, Drizzle ORM or Kysely, `pg`, OpenAI/AI SDK |
| `seed` | TypeScript CLI | Import `devassets`, probe media, transcribe videos, chunk transcripts, upsert database records | `tsx`, FFmpeg/ffprobe, OpenAI transcription API or local Whisper-compatible tool |
| `render` | Go | Convert/validate/render `vspec`, invoke FFmpeg, write outputs | `github.com/gldraphael/vspec`, FFmpeg, ffprobe |
| `postgres` | PostgreSQL | Store asset metadata, transcript segments, clips, conversations, render jobs | Built-in full-text search with `tsvector`, `websearch_to_tsquery`, `ts_rank_cd` |

## Data And Retrieval

Use PostgreSQL full-text search only. Do not include embeddings or pgvector in the MVP.

This is intentional: retrieval only needs to be good enough to provide plausible source clips for the `vspec` demo. The main value being tested is the app's ability to turn selected clips and user intent into a polished rendered video.

Suggested core tables:

```text
assets
  id, type, path, title, notes, duration_ms, width, height, fps, checksum

asset_artifacts
  asset_id, kind, path, metadata

transcript_segments
  asset_id, start_ms, end_ms, speaker, text

clips
  asset_id, start_ms, end_ms, title, summary, searchable_text, search_vector

conversations
  id, created_at, updated_at

messages
  conversation_id, role, content, metadata, created_at

renders
  id, status, edit_plan_json, vspec_yaml, output_path, error, created_at, updated_at
```

The seed script should read `devassets/catalog.yaml`, probe media with ffprobe, transcribe video/audio when requested, derive transcript segments and clips, and upsert the resulting records. It should be idempotent and support forced regeneration of derived artifacts.

Example command:

```bash
podman compose run --rm seed pnpm seed:devassets devassets/catalog.yaml
```

## AI And Vspec Boundary

The language model must not be the trusted producer of arbitrary final `vspec` YAML.

Instead:

```text
user prompt + selected clips
        ↓
LLM generates structured EditPlan JSON
        ↓
API validates EditPlan with Zod
        ↓
API deterministically converts EditPlan to vspec YAML
        ↓
render service validates/compiles/renders through videolib
```

The `EditPlan` should support enough structure to exercise `vspec` meaningfully:

- video trims
- explicit timelines
- crossfades/transitions
- fade in/out
- title/color scenes
- text overlays
- logo/image overlays
- audio beds
- output settings

## Containerization

Everything should run cleanly through Podman.

Expected project-level container assets:

```text
compose.yaml
Containerfile.web
Containerfile.api
Containerfile.render
.env.example
```

Expected local runtime mounts/volumes:

```text
devassets/       mounted into seed/api/render as needed
var/renders/     writable rendered output directory
var/thumbnails/  writable generated thumbnail/poster directory
postgres-data    named volume
```

Containers should be rootless-friendly and avoid Docker-only assumptions. FFmpeg and ffprobe must be available inside seed/render images.

Primary local commands:

```bash
podman compose up --build
podman compose run --rm seed pnpm seed:devassets devassets/catalog.yaml
```

## Phased Implementation Plan

Each phase should end with a Minimal Testable Product. The phase descriptions below define the intended direction and testable milestone for each increment; they are expected to be refined during implementation rather than treated as exhaustive task lists.

### Phase 0: Containerized Skeleton

Minimal Testable Product: `podman compose up --build` starts all core services.

Includes:

- React app shell
- TypeScript API health endpoint
- Go render-service health endpoint
- PostgreSQL container
- API-to-database connectivity

Acceptance checks:

- Web app loads.
- API health endpoint responds.
- Render service health endpoint responds.
- API can query PostgreSQL.

### Phase 1: Devasset Seeding

Minimal Testable Product: sample media becomes searchable database records.

Includes:

- `devassets/catalog.yaml`
- sample media under `devassets/media/`
- database schema/migrations
- seed CLI
- ffprobe metadata extraction
- transcription and transcript chunking
- idempotent upserts

Acceptance checks:

- `podman compose run --rm seed pnpm seed:devassets devassets/catalog.yaml` completes.
- Assets, transcript segments, and clips exist in PostgreSQL.
- Re-running the seed command does not duplicate records.

### Phase 2: Clip Retrieval API

Minimal Testable Product: prompt-like text returns ranked clips.

Includes:

- `POST /api/clips/search`
- `GET /api/clips`
- access to thumbnails/posters or other artifacts
- PostgreSQL full-text ranking over clip text, transcript text, titles, summaries, notes, and tags

Acceptance checks:

- Searching for a phrase like `launch recap with product demo` returns plausible clips.
- Results include title, transcript/summary snippet, asset reference, and start/end times.

### Phase 3: Chat UI With Clip Results

Minimal Testable Product: user asks in chat and sees selectable clips.

Includes:

- assistant-style chat interface
- API-backed clip search from chat prompts
- clip result cards
- select/deselect state
- selected clip list

Acceptance checks:

- User types a creative request.
- App responds with matching clip cards.
- User can select and deselect clips.
- Selected clips remain visible in the UI.

### Phase 4: EditPlan Generation

Minimal Testable Product: selected clips become a validated structured edit plan.

Includes:

- LLM prompt for generating `EditPlan` JSON
- Zod schema validation
- UI surface for inspecting the plan
- graceful handling of invalid model output

Acceptance checks:

- Selected clips plus a prompt generate a valid `EditPlan`.
- The plan includes at least ordering, trims, transitions, overlays or titles, audio bed, and output settings when appropriate.
- Invalid output is rejected with a useful error.

### Phase 5: EditPlan To Vspec

Minimal Testable Product: the app generates valid `vspec` YAML.

Includes:

- deterministic `EditPlan -> vspec` converter
- asset/clip ID validation
- timestamp validation
- render-service validation endpoint using `videolib`
- UI display/download of generated `.vspec`

Acceptance checks:

- Generated `vspec` validates through the Go render service.
- Generated `vspec` uses meaningful features such as transitions, fades, title/color scenes, overlays, and audio tracks.

### Phase 6: Rendering

Minimal Testable Product: user receives a real rendered video.

Includes:

- render job creation
- render status polling or streaming
- render service invoking FFmpeg through `vspec`
- output file storage under `var/renders/`
- output playback in the web UI

Acceptance checks:

- User can prompt, select clips, generate an edit, render it, and play the final MP4.
- Render failures expose validation or FFmpeg errors clearly.

### Phase 7: Demo Polish

Minimal Testable Product: a coherent local demo.

Includes:

- curated sample `devassets`
- good default prompts
- thumbnails/posters
- render progress states
- generated `vspec` visibility
- concise setup docs

Acceptance checks:

- A new developer can run the prototype with Podman commands.
- The demo clearly showcases chat-driven generation of a polished `vspec` video.

## Consequences

This architecture keeps the MVP focused on the central product hypothesis: chat can drive useful, attractive video generation when backed by structured assets and `vspec`.

The prototype avoids early complexity in auth, upload handling, production media processing, and semantic retrieval. Those capabilities can be added later without invalidating the core pipeline because the seed CLI mirrors the future ingestion path.

Keeping `vspec` behind a Go render service preserves a clean language boundary: TypeScript owns product orchestration, while Go owns deterministic media rendering.

## Deferred Decisions

- Whether to add upload UI after the prototype.
- Whether to add production async workers or keep simple render-job handling.
- Whether to add more advanced timeline editing.
- Whether to support local transcription by default or only as an optional mode.
- Whether to store dev media locally only or introduce object storage later.
