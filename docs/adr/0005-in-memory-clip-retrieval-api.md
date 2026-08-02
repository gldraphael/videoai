# ADR 0005: In-Memory Clip Retrieval API

## Status

Accepted.

Records the implementation in commit `55b58cd` (`Clip retrieval API`) for
OpenSpec change `phase-2-in-memory-clip-retrieval-api`.

## Context

ADR 0004 moved the prototype away from PostgreSQL-backed retrieval for the next
increments and made the generated local devasset library the source of truth for
clip search. Phase 1 already established the seed output contract:
`var/devassets/library.json`, generated source media, thumbnails, audio, and
`whisper.cpp` transcript artifacts.

The next prototype milestone needed the API to turn prompt-like text into
ranked clip candidates for the future chat UI, while keeping the API healthy
when the one-shot seed service has not finished yet. Retrieval quality only
needs to be plausible enough for a local demo; durable indexing, embeddings,
SQL ranking, and external search services are not required at this stage.

## Decision

Implement clip retrieval in the TypeScript API as an in-process, file-backed
index over generated devasset artifacts.

The API exposes:

```text
POST /clips/search
```

The route validates a JSON request with a required non-empty `query` and an
optional `limit`. `limit` defaults to `8` and is capped at `20`. Invalid request
bodies return `400` with a `validation_error` response.

When devassets are missing, still running, or in an error state, the route
returns `503` with `devassets_not_ready` and the current devasset readiness
payload. It does not build an index, query stale state, or require the API
process to restart after seed output becomes ready.

Successful responses return the normalized query plus ranked clip candidates:

```text
clip result
  id
  assetId
  title
  startMs
  endMs
  snippet
  thumbnailPath
  previewPath
  score
```

Clip IDs are deterministic in the form `<asset-id>:<start-ms>-<end-ms>`.
Thumbnail and preview references are copied from the generated library after
root validation, rather than accepted from client input.

## Implementation

The API reads devasset readiness through the existing status contract before it
loads `library.json`. Once ready, `ClipIndexCache` lazily builds an in-memory
index on first search. The cache is reused while the library identity, file
size, and modification time are unchanged, then rebuilt on the next search when
those values change.

The media library validator accepts only the Phase 2 fields the search path
uses: video asset id, title, media duration, source path, thumbnail path, and
transcript JSON path. Generated path references must resolve under configured
`DEVASSETS_DIR` or `THUMBNAILS_DIR` roots.

For assets with usable `whisper.cpp` JSON transcript entries, the indexer:

- normalizes transcript text
- filters empty text, replacement characters, and special-token-only content
- clamps transcript offsets to asset duration
- merges adjacent timed entries into deterministic windows around the target
  preview length
- derives snippets directly from transcript text

For assets without usable transcript text, the indexer creates fixed-duration
fallback windows from media duration and asset metadata. Fallback windows leave
`snippet` empty so the API does not fabricate transcript content.

Ranking uses a custom weighted lexical scorer instead of adding a search
dependency. It normalizes query and document text, scores title matches above
snippet matches, rewards phrase and term coverage, filters zero-score results,
and sorts ties deterministically by score, asset id, start time, end time, and
clip id.

Fastify app construction was split from the listen side effect so route tests
can instantiate the API without binding a port. Clip search is independent of
the PostgreSQL smoke-check path; PostgreSQL may be unavailable while
`POST /clips/search` still succeeds if devassets are ready.

## Consequences

Phase 2 now has a minimal testable retrieval path for the future chat UI:
prompt-like text can return plausible, structured clip cards from local media
artifacts without database setup.

The implementation stays aligned with the seed contract and ADR 0004. Generated
files remain the local source of truth, PostgreSQL remains outside the critical
demo path, and later phases can consume stable clip IDs without asking the model
to invent clip metadata.

Search quality is intentionally modest. The custom ranker is predictable and
easy to test, but it is lexical only. Larger media catalogs, semantic matching,
durable conversations, saved selections, or multi-session render state may
justify PostgreSQL, embeddings, or another retrieval layer later.

Returning local generated paths is enough for this API milestone, but the future
chat UI may need constrained browser-fetchable media and thumbnail URLs. That
should be added as a separate serving decision rather than widening this search
endpoint into arbitrary file access.

## Validation

The completed change added fixture-based API tests and retrieval unit tests for:

- request validation and limit handling
- non-ready devasset states
- transcript parsing and noise filtering
- transcript-derived and fallback clip windows
- deterministic lexical ranking and tie ordering
- cache reuse and rebuild after library changes
- successful route responses with required clip card metadata
- clip search succeeding without PostgreSQL connectivity

The README documents the endpoint, example `curl` command, response shape, clip
window behavior, and the file-backed in-memory retrieval constraint.

## Deferred Decisions

- Whether Phase 3 should expose API-hosted media and thumbnail URLs instead of
  generated local path references.
- Whether search should stay as a custom lexical ranker or move to a small
  library such as `MiniSearch`.
- Whether PostgreSQL should return for durable conversations, selections,
  render jobs, or larger retrieval catalogs.
- Whether clip windows should continue to be derived in the API or become seed
  output once the media contract stabilizes.
