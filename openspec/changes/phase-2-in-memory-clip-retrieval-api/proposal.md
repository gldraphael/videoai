## Why

Phase 1 produces a local generated media library, but the prototype still needs
an API capability that can turn prompt-like text into plausible clip candidates.
ADR 0004 makes this the next Minimal Testable Product by removing PostgreSQL
from the critical path and using the generated devasset artifacts directly.

## What Changes

- Add API support for reading `var/devassets/library.json` and referenced
  transcript artifacts as the source of searchable media.
- Build an in-memory clip index at API startup and rebuild or refresh it when
  devassets become ready during local startup.
- Derive searchable clip documents from asset titles, transcript text,
  transcript timing data, catalog/generated notes when available, media
  duration, thumbnails, and previewable media references.
- Add a prompt-like clip search API that returns ranked candidate clips for
  creative requests such as `launch recap with product demo`.
- Return structured clip result metadata needed by the future chat UI: clip id,
  asset id, title, snippet, thumbnail or poster reference, preview/media
  reference, start/end times, and score.
- Keep retrieval intentionally modest: use a small in-memory full-text library
  such as `MiniSearch` or a simple weighted lexical ranker, with no database,
  vector embeddings, pgvector, or external search cluster.
- Expose clear API behavior while devassets are missing or still being seeded,
  reusing the existing readiness/status contract where possible.
- Add focused tests and documentation for indexing, searching, result shape,
  and local verification.

## Capabilities

### New Capabilities

- `in-memory-clip-retrieval`: file-backed devasset clip indexing and ranked
  clip candidate search through the API.

### Modified Capabilities

- None.

## Impact

- Affects the TypeScript API service by adding devasset library loading,
  transcript parsing, in-memory indexing, search ranking, result shaping, and a
  clip search endpoint.
- May add a small API runtime dependency for in-memory full-text search if that
  is simpler than a custom ranker.
- Affects shared runtime conventions for how API responses reference generated
  media, thumbnails, transcripts, and previewable source files under `var/`.
- Affects local compose readiness only insofar as the API should behave
  predictably before and after seed output is available.
- Adds API tests and documentation for the Phase 2 acceptance checks.
- Does not add chat UI, clip selection UI, EditPlan generation, vspec
  conversion, rendering workflow, durable conversations, uploads, auth, or
  PostgreSQL-backed retrieval.
