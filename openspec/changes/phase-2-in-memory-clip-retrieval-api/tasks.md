## 1. API Contracts And Test Fixtures

- [x] 1.1 Add TypeScript contracts for generated media library assets, `whisper.cpp` transcript JSON, clip documents, search requests, and search responses.
- [x] 1.2 Add lightweight validation for the library fields Phase 2 consumes: asset id, title, media duration, source path, thumbnail path, and transcript JSON path.
- [x] 1.3 Add fixture builders or testdata for ready libraries, missing/running/error devasset states, usable transcripts, empty/noisy transcripts, and changed library identities.
- [x] 1.4 Extend API configuration if needed for thumbnail/devasset root validation while preserving existing `DEVASSETS_DIR` defaults.

## 2. In-Memory Index Construction

- [x] 2.1 Implement a media-library loader that reads `library.json` only after devasset readiness reports ready.
- [x] 2.2 Implement transcript JSON loading for library assets with referenced `whisper.cpp` transcript files.
- [x] 2.3 Implement transcript text normalization that filters empty text and special-token-only content.
- [x] 2.4 Implement deterministic transcript-based clip window derivation with stable ids, snippets, asset references, thumbnail references, preview references, and millisecond timing.
- [x] 2.5 Implement fallback fixed-duration clip windows for assets without usable transcript text.
- [x] 2.6 Implement an index cache that rebuilds when the library identity or generated library file state changes.

## 3. Search And Ranking

- [x] 3.1 Implement query normalization and validation for non-empty prompt-like search text.
- [x] 3.2 Implement deterministic weighted lexical scoring across title and snippet/transcript fields.
- [x] 3.3 Implement result sorting and limit handling with a documented default and maximum result count.
- [x] 3.4 Ensure search results include `id`, `assetId`, `title`, `startMs`, `endMs`, `snippet`, `thumbnailPath`, `previewPath`, and numeric `score`.
- [x] 3.5 Ensure result references are copied or derived from generated library paths and do not depend on client-provided file paths.

## 4. API Route Integration

- [x] 4.1 Extract Fastify app construction from the current listen side effect so route tests can instantiate the API without binding a port.
- [x] 4.2 Register `POST /clips/search` in the API service and expose it through the existing `/api` Traefik prefix on the webapp host.
- [x] 4.3 Return a validation error for empty, whitespace-only, malformed, or out-of-range search requests.
- [x] 4.4 Return a clear non-ready response with devasset state and message when devassets are missing, running, or error.
- [x] 4.5 Keep clip search independent of PostgreSQL connectivity and database health checks.

## 5. Tests

- [x] 5.1 Add unit tests for transcript parsing, text normalization, clip window derivation, and fallback window derivation.
- [x] 5.2 Add unit tests for ranking behavior, deterministic ordering, phrase/term coverage, and result limit enforcement.
- [x] 5.3 Add unit tests for index cache reuse and rebuild after library identity or file state changes.
- [x] 5.4 Add API route tests for successful search responses, invalid requests, non-ready devasset states, and required result fields.
- [x] 5.5 Add a test proving clip search does not require PostgreSQL when devassets are ready.

## 6. Documentation

- [x] 6.1 Update `README.md` with the Phase 2 clip search endpoint, example request, example response shape, and local curl command.
- [x] 6.2 Document how search derives clip windows from transcripts and how fallback windows behave when transcript text is unusable.
- [x] 6.3 Document that retrieval is in-memory and file-backed for this phase, with PostgreSQL deferred per ADR 0004.

## 7. Verification

- [x] 7.1 Run API tests with `pnpm --filter @videoai/api test`.
- [x] 7.2 Run workspace checks with `pnpm check`.
- [x] 7.3 Run the seed workflow or use existing generated devassets to verify `var/devassets/library.json` and referenced transcript files are present.
- [x] 7.4 Start the local stack with `podman compose up --build` and verify API, webapp, and render health endpoints still respond.
- [x] 7.5 Verify `POST /api/clips/search` through `videoai.localhost` returns ranked clip candidates with title, snippet, asset reference, thumbnail/preview reference, and start/end times.
- [x] 7.6 Run `openspec status --change phase-2-in-memory-clip-retrieval-api` and confirm the change is apply-ready.
