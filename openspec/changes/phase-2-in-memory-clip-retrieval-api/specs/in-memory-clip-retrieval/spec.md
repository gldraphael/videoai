## ADDED Requirements

### Requirement: API Builds In-Memory Clip Index From Ready Devassets

The API service SHALL build an in-memory clip index from the generated
devasset media library and referenced transcript artifacts when local devassets
are ready.

#### Scenario: Ready devassets are indexed

- **WHEN** `var/devassets/library.json` exists
- **AND** devasset status reports ready
- **AND** the library references transcript JSON files for video assets
- **THEN** the API builds searchable clip documents from asset metadata and
  transcript content
- **AND** the index includes asset titles, transcript text, thumbnail
  references, preview media references, and clip timing metadata

#### Scenario: API starts before seed completes

- **WHEN** the API starts while devasset status is missing or running
- **THEN** the API health endpoint remains available
- **AND** clip search does not require the API process to restart after
  devassets become ready

#### Scenario: Library identity changes

- **WHEN** `library.json` is replaced with a different catalog identity or
  updated generated content
- **THEN** the next clip search uses a rebuilt in-memory index for the current
  library

### Requirement: API Derives Deterministic Clip Candidates

The API service SHALL derive deterministic clip candidates with stable ids,
valid asset references, snippets, and millisecond start/end times.

#### Scenario: Transcript timing creates clip windows

- **WHEN** a video asset has usable transcript entries with text and offsets
- **THEN** the API derives clip windows from those transcript offsets
- **AND** each clip has a deterministic id based on asset id and time range
- **AND** each clip start and end time is within the asset duration
- **AND** each clip snippet is derived from the matched transcript window

#### Scenario: Transcript text is unavailable

- **WHEN** a video asset has no usable transcript text
- **THEN** the API still derives fallback searchable clip candidates from asset
  metadata and media duration
- **AND** it does not fabricate transcript snippets that are not present in the
  generated artifacts

### Requirement: API Exposes Prompt-Like Clip Search

The API service SHALL expose a clip search endpoint that accepts prompt-like
text and returns ranked clip candidates from the in-memory index.

#### Scenario: Client searches for matching clips

- **WHEN** a client sends `POST /clips/search` with a non-empty `query`
- **AND** local devassets are ready
- **AND** the query terms match asset title or transcript content
- **THEN** the API returns a successful response with ranked clip candidates
- **AND** higher-ranked results are more relevant to the query than lower-ranked
  results according to deterministic lexical scoring

#### Scenario: Prompt-like product demo search

- **WHEN** the ready devasset library contains local artifact text relevant to
  a request such as `launch recap with product demo`
- **AND** a client searches for `launch recap with product demo`
- **THEN** the API returns one or more plausible ranked clip candidates from
  those local artifacts
- **AND** all returned clip identifiers come from API-derived candidates rather
  than model-invented metadata

#### Scenario: Client limits result count

- **WHEN** a client sends `POST /clips/search` with a valid `limit`
- **THEN** the API returns no more than that many results
- **AND** the API enforces a documented maximum result count

### Requirement: Search Results Include Clip Card Metadata

The API service SHALL return structured clip metadata sufficient for the future
chat UI to render rich clip candidate cards.

#### Scenario: Search response includes required fields

- **WHEN** clip search returns a candidate result
- **THEN** the result includes `id`, `assetId`, `title`, `startMs`, `endMs`,
  `snippet`, `thumbnailPath`, `previewPath`, and `score`
- **AND** `startMs` is less than `endMs`
- **AND** `score` is numeric
- **AND** thumbnail and preview references are copied or derived from the
  generated media library

#### Scenario: Results do not expose arbitrary files

- **WHEN** the API returns thumbnail or preview references
- **THEN** those references resolve from configured devasset or thumbnail roots
- **AND** the API does not accept client-provided paths for clip search

### Requirement: Search Handles Non-Ready And Invalid States

The API service SHALL return clear responses when clip search cannot run
because devassets are unavailable or the request is invalid.

#### Scenario: Devassets are not ready

- **WHEN** a client searches while devasset status is missing, running, or error
- **THEN** the API does not return stale clip results
- **AND** the response includes the current devasset state and a useful message

#### Scenario: Query is invalid

- **WHEN** a client sends an empty, whitespace-only, or malformed search request
- **THEN** the API returns a validation error
- **AND** the API does not build or query the clip index for that request

### Requirement: Retrieval Does Not Depend On PostgreSQL

The clip retrieval API SHALL use generated local devasset files and in-memory
state rather than PostgreSQL for Phase 2 search behavior.

#### Scenario: Database is unavailable

- **WHEN** PostgreSQL is unavailable
- **AND** local devassets are ready
- **THEN** `POST /clips/search` can still return ranked clip candidates
- **AND** the Phase 2 acceptance checks do not depend on database health
