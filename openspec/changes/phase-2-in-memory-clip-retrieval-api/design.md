## Context

Phase 1 established a generated-file contract for local media. The seed service
writes `var/devassets/library.json`, transcript files, source media, audio, and
thumbnails, while the API exposes `/devassets/status` so the webapp can wait
until local devassets are ready.

ADR 0004 supersedes the earlier PostgreSQL-first retrieval direction for the
next prototype increments. Phase 2 should prove that the API can read the
generated local artifacts directly and return ranked clip candidates for
prompt-like search text. The API currently has a small Fastify surface, so the
retrieval implementation should stay in-process and easy to test.

## Goals / Non-Goals

**Goals:**

- Build an in-memory search index from ready `library.json` assets and
  referenced transcript artifacts.
- Keep the API process healthy when seed output is missing, running, or invalid.
- Derive deterministic clip windows with valid asset references and millisecond
  start/end times.
- Expose a prompt-like clip search endpoint for the future chat UI.
- Return ranked results with the metadata needed for rich clip cards.
- Add focused tests that use small generated-library fixtures instead of real
  downloaded media.
- Document the endpoint, response shape, and local verification path.

**Non-Goals:**

- Add assistant-ui chat behavior or clip selection UI.
- Generate EditPlan JSON, convert EditPlan to `vspec`, or render videos.
- Persist conversations, selections, indexes, or render jobs.
- Reintroduce PostgreSQL, pgvector, embeddings, or external search services for
  clip retrieval.
- Build a production media serving layer or upload pipeline.

## Decisions

### Use the generated media library as the retrieval source of truth

The API will read `var/devassets/library.json` plus the transcript files
referenced by each asset. Asset titles, media duration, thumbnail references,
source media references, and transcript timing data become the inputs for clip
documents.

Using PostgreSQL was considered because the Phase 0 skeleton still includes a
database service, but ADR 0004 intentionally removes it from the critical demo
path. Reading generated files keeps Phase 2 aligned with the seed contract and
lets the API search even if PostgreSQL is unavailable.

### Build the index lazily and refresh when the library identity changes

The API should not fail startup just because seed is still running. Instead,
clip search should check devasset readiness, then build the in-memory index on
first search when ready. The index should be reused while the library identity
and relevant file metadata are unchanged, and rebuilt when the catalog identity
or `library.json` modification state changes.

A startup-only index was considered but rejected because compose can start the
API before the one-shot seed service finishes. A watch-based rebuild loop was
also considered, but request-time stale checks are simpler and enough for a
small local prototype.
normal for him
### Derive deterministic clip windows from transcripts first

For assets with `whisper.cpp` JSON transcripts, the indexer should read the
`transcription` entries, normalize text, discard empty/special-token-only
segments, and merge adjacent timed entries into searchable clip windows. Windows
should be long enough to be meaningful for preview and editing, while preserving
the transcript-derived start and end offsets. A target range around 8-20 seconds
with a reasonable maximum window length is sufficient for the prototype.

If an asset has no usable transcript text, the indexer should create fallback
fixed-duration windows from media duration and asset title/notes. This keeps the
API useful for silent or poorly transcribed samples without pretending the model
invented transcript content.

Clip IDs should be deterministic from the asset id and window offsets, such as
`<asset-id>:<start-ms>-<end-ms>`. This gives later selection and EditPlan work a
stable reference format.

### Use a small weighted lexical ranker for Phase 2

The first implementation should use a custom in-memory lexical ranker before
adding a dependency. Normalize query and document text, score title matches
above transcript/snippet matches, reward phrase or term coverage, and sort ties
deterministically by score, asset id, and start time.

`MiniSearch` remains acceptable if the custom ranker becomes awkward, but the
current sample corpus is tiny and retrieval only needs plausible candidates.
Avoiding a dependency keeps this phase easier to apply and verify.

### Expose a narrow search endpoint

Add an internal Fastify route:

```text
POST /clips/search
```

The webapp can reach it through Traefik as `/api/clips/search`. The request
should accept JSON like:

```json
{
  "query": "launch recap with product demo",
  "limit": 8
}
```

`query` is required and must contain non-whitespace text. `limit` should be
optional, default to a small value such as 8, and have a fixed maximum such as
20. When devassets are not ready, the endpoint should return a non-ready
response instead of stale or fabricated clips.

Successful responses should include the normalized query and a `results` array.
Each result should include:

- `id`
- `assetId`
- `title`
- `startMs`
- `endMs`
- `snippet`
- `thumbnailPath`
- `previewPath`
- `score`

The paths should come from the generated library and remain within configured
devasset/thumbnail roots. If this phase adds browser-fetchable URLs, they should
be derived from those same validated references rather than allowing arbitrary
file reads.

## Risks / Trade-offs

- Search quality is intentionally modest -> Keep ranking deterministic, test
  common prompt-like queries, and revisit `MiniSearch` only if simple lexical
  scoring blocks the demo.
- Transcript output can be sparse or noisy -> Filter empty/special-token text,
  fall back to title-based windows, and use deterministic fixtures for tests.
- The API may start before seed finishes -> Keep index construction lazy and
  return clear non-ready responses while devassets are missing or running.
- Generated files can change while the API is reading them -> Rely on Phase 1
  atomic writes and rebuild the index when library identity or modification
  state changes.
- Large transcripts could increase memory use -> Accept this for the local
  prototype and keep only normalized clip documents in the search index.
- Returning local file paths is not enough for final clip cards -> Make the
  reference format explicit now and add constrained media serving in Phase 3 if
  the chat UI needs browser-fetchable URLs.

## Migration Plan

This is local prototype behavior with no durable data migration.

Implementation should:

1. Add typed contracts for media library assets, transcript JSON, clip
   documents, search requests, and search responses.
2. Add the in-memory index builder and ranker behind small API modules.
3. Add the `POST /clips/search` route and non-ready/error handling.
4. Add fixture-based tests for indexing, ranking, validation, and devasset
   readiness states.
5. Update README/API documentation with the endpoint and verification commands.

Rollback is removing the new modules, endpoint, tests, and docs. Generated seed
outputs and PostgreSQL data do not need migration.

## Open Questions

- Should Phase 3 require API-hosted thumbnail/media URLs, or are path references
  enough until the chat UI is implemented?
- What exact transcript window size gives the best preview behavior for the
  initial sample corpus?
