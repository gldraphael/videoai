# ADR 0004: Lean Chat-First Video AI Prototype Architecture

## Status

Proposed.

Supersedes [ADR 0001: Video AI Prototype Architecture](0001-video-ai-prototype-architecture.md).

## Context

ADR 0001 set a high-level direction for a containerized VideoAI prototype with
React, a TypeScript API, PostgreSQL full-text search, a seed/import flow, and a
Go render service. That direction remains broadly useful, but later work changed
two important constraints.

First, the prototype's central value is the chat-driven path from prompt, to
candidate clips, to selected clips, to validated `vspec`, to rendered video. It
is not intended to prove production-grade asset ingestion, user management,
conversation persistence, or retrieval sophistication.

Second, ADR 0003 established a generated JSON media library as the local
devasset contract. The seed service now prepares source media, thumbnails,
audio, transcripts, and `var/devassets/library.json` without requiring database
writes. That makes PostgreSQL an avoidable dependency for the next prototype
increments.

The chat UI is now the higher-leverage decision. We need an off-the-shelf React
chat surface that can support streaming assistant responses and rich inline
content cards for clip candidates, including video thumbnails/previews and
selection controls.

## Decision

Use `assistant-ui` as the prototype chat UI foundation.

The web application will use `assistant-ui` for the chat thread, message
composer, streaming state, and rich assistant output. Clip search results will
be rendered as custom tool/data UI inside the assistant response, not as plain
Markdown. The custom card renderer will own video-specific UI such as thumbnail
display, preview links or inline playback, start/end timestamps, snippets, and
select/deselect controls.

Keep the backend lean for the prototype. The API service will read the generated
media library and transcript artifacts from `var/devassets/`, build an
in-memory search index at startup or when devassets become ready, and serve clip
search from that index. A small in-memory full-text library such as `MiniSearch`
is acceptable, but a simple weighted lexical search is also acceptable if the
sample corpus stays tiny.

PostgreSQL is removed from the prototype's critical path. It is deferred until
we need durable user data, larger media catalogs, multi-session conversation
history, concurrent job coordination, or retrieval behavior that cannot be
maintained comfortably in process memory.

The Go render service remains responsible for validating, compiling, and
rendering `vspec` through the local `vspec` Go library and FFmpeg. TypeScript
continues to own product orchestration, chat, retrieval, selection state,
EditPlan validation, and deterministic `EditPlan -> vspec` conversion.

## Architecture

```text
┌────────────────────────────────────────────┐
│ Web UI                                     │
│ React + assistant-ui                       │
│ chat, clip cards, selections, playback     │
└────────────────────┬───────────────────────┘
                     │ HTTP/SSE
                     ▼
┌────────────────────────────────────────────┐
│ API Service                                │
│ TypeScript + Fastify                       │
│ chat orchestration, in-memory search,      │
│ selections, EditPlan, render coordination  │
└────────────┬─────────────────────┬─────────┘
             │ reads local files   │ HTTP
             ▼                     ▼
┌────────────────────────────┐  ┌──────────────────────┐
│ var/devassets/library.json │  │ Render Service        │
│ transcripts, media refs    │  │ Go + gldraphael/vspec │
└────────────▲───────────────┘  │ FFmpeg / ffprobe      │
             │                  └──────────┬───────────┘
┌────────────┴───────────────┐             ▼
│ Seed Service / CLI         │        var/renders/
│ download/probe/transcribe  │
│ thumbnail + library output │
└────────────▲───────────────┘
             │
        devassets/catalog.yaml
```

## Service Stack

| Service | Technology | Responsibilities | Candidate libraries/tools |
| --- | --- | --- | --- |
| `web` | React + TypeScript | Chat UI, rich clip cards, clip selection, generated plan/vspec display, render status, output playback | Vite, `assistant-ui`, local CSS/components |
| `api` | Node.js + TypeScript | Devasset readiness, in-memory clip indexing/search, chat orchestration, selection state, EditPlan validation, render coordination | Fastify, Zod, AI SDK/OpenAI SDK, `MiniSearch` or simple lexical search |
| `seed` | TypeScript CLI | Prepare local media, thumbnails, audio, transcripts, and `library.json` | FFmpeg/ffprobe, `whisper.cpp` |
| `render` | Go | Convert/validate/render `vspec`, invoke FFmpeg, write outputs | `github.com/gldraphael/vspec`, FFmpeg, ffprobe |

## Data And Retrieval

The local devasset library is the source of truth for available media during the
prototype.

The API should derive searchable clip documents from:

- asset id and title
- transcript text and word timestamps
- generated or catalog-provided notes when available
- media duration and thumbnail references
- deterministic clip windows derived from transcripts or simple time slicing

The in-memory index should be rebuilt from local artifacts. It does not need to
survive process restarts. The prototype should expose enough metadata for the UI
to render candidate cards:

```text
clip
  id
  asset_id
  title
  start_ms
  end_ms
  snippet
  thumbnail_path
  preview_path
  score
```

This keeps retrieval honest but intentionally modest: searches only need to
return plausible candidates for the user to select before generating a
structured edit plan.

## Chat UI Boundary

The assistant response should separate natural language from structured UI.

```text
user prompt
    |
    v
API searches local clip index
    |
    v
assistant message
    |-- text: short explanation
    |-- tool/data part: clip candidates
            |
            v
       assistant-ui custom renderer
       selectable video cards
```

The model should not be asked to invent clip metadata or video paths. The API
owns retrieval and returns structured candidate data. The UI renders that data.
The model may summarize why clips are relevant, but selected clip identifiers
must come from API-provided candidates.

## AI And Vspec Boundary

Keep the trust boundary from ADR 0001.

```text
user prompt + selected clip ids
        ↓
LLM generates structured EditPlan JSON
        ↓
API validates EditPlan with Zod
        ↓
API deterministically converts EditPlan to vspec YAML
        ↓
render service validates/compiles/renders through videolib
```

The language model must not be the trusted producer of arbitrary final `vspec`
YAML. The API validates clip references, timestamps, transitions, overlays,
audio beds, and output settings before conversion or rendering.

## Containerization

The prototype should still run cleanly through Podman Compose, but PostgreSQL is
no longer a required service for the main demo path.

Expected project-level container assets:

```text
compose.yaml
Containerfile.web
Containerfile.api
Containerfile.render
Containerfile.seed
.env.example
```

Expected local runtime mounts:

```text
devassets/       mounted read-only into seed/api/render as needed
var/devassets/   writable generated media library and transcripts
var/thumbnails/  writable generated thumbnail/poster directory
var/renders/     writable rendered output directory
```

If PostgreSQL remains in local compose temporarily during migration, app
readiness and acceptance checks should not depend on it.

## Revised Prototype Phases

### Phase 0: Containerized Skeleton

Minimal Testable Product: `podman compose up --build` starts the web, API,
render, seed, and local routing services.

Acceptance checks:

- Web app loads.
- API health endpoint responds.
- Render service health endpoint responds.
- Web app reports devasset setup state through the API.

### Phase 1: Devasset Seeding

Minimal Testable Product: sample media becomes a generated local media library.

Acceptance checks:

- Seed command completes.
- `var/devassets/library.json` exists.
- Referenced thumbnails, media, audio, and transcripts exist.
- Re-running seed does not duplicate or regenerate unchanged artifacts.

### Phase 2: In-Memory Clip Retrieval API

Minimal Testable Product: prompt-like text returns ranked clip candidates from
local artifacts.

Acceptance checks:

- API builds an in-memory index from `library.json` and transcripts.
- Searching for a phrase like `launch recap with product demo` returns plausible
  clips.
- Results include title, snippet, asset reference, thumbnail/preview reference,
  and start/end times.

### Phase 3: assistant-ui Chat With Clip Results

Minimal Testable Product: user asks in chat and sees selectable clip cards.

Acceptance checks:

- User types a creative request in the assistant-ui composer.
- App responds with matching clip cards.
- User can select and deselect clips.
- Selected clips remain visible outside or alongside the chat flow.

### Phase 4: EditPlan Generation

Minimal Testable Product: selected clips become a validated structured edit plan.

Acceptance checks:

- Selected clips plus the user prompt generate valid `EditPlan` JSON.
- Invalid model output is rejected with a useful error.
- The UI can display the validated plan.

### Phase 5: EditPlan To Vspec

Minimal Testable Product: the app generates valid `vspec` YAML.

Acceptance checks:

- Generated `vspec` validates through the Go render service.
- Generated `vspec` uses meaningful features such as transitions, fades,
  title/color scenes, overlays, and audio tracks.

### Phase 6: Rendering

Minimal Testable Product: user receives a real rendered video.

Acceptance checks:

- User can prompt, select clips, generate an edit, render it, and play the final
  MP4.
- Render failures expose validation or FFmpeg errors clearly.

### Phase 7: Demo Polish

Minimal Testable Product: a coherent local demo.

Acceptance checks:

- A new developer can run the prototype with Podman commands.
- The demo clearly showcases chat-driven generation of a polished `vspec`
  video.
- The chat and clip-card experience feels like the core product, not a setup
  screen plus disconnected forms.

## Consequences

The prototype becomes materially leaner. We can build the chat and rendering
loop without database schema design, migrations, seed imports, or SQL ranking.

The main risk is that in-memory retrieval can become too limited if the sample
library grows or if transcript-derived clips need sophisticated ranking. That is
acceptable for the prototype because retrieval only needs to provide plausible
candidate clips. The data contract remains file-backed and can later feed a
PostgreSQL import without invalidating seed output.

`assistant-ui` becomes a meaningful frontend dependency. This is acceptable
because rich chat behavior is central to the prototype, and the library gives us
state management, streaming affordances, and custom assistant output rendering
that generic chat components would leave to application code.

Removing PostgreSQL from the critical path reduces local setup time and
operational surface. It also means conversation history, durable selections, and
render-job persistence should stay intentionally minimal until there is a real
need for durable multi-session behavior.

## Deferred Decisions

- Whether to reintroduce PostgreSQL for durable conversations, render jobs, or
  larger retrieval catalogs.
- Whether in-memory search should use `MiniSearch`, a simpler custom ranker, or
  another small library.
- Whether clip windows should be transcript-segment based, fixed-duration, or
  generated during seed.
- Whether assistant-ui should use an AI SDK transport, a custom runtime, or an
  externally owned message store.
- Whether selected clip state belongs only in the web session or should be
  persisted by the API.
