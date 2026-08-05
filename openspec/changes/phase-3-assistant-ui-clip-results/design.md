## Context

Phase 2 added `POST /clips/search`, which returns deterministic ranked clip
candidates from `var/devassets/library.json` and transcript artifacts. The web
application still shows only the setup/ready shell after devassets are ready, so
the prototype has not yet exercised the central user loop from prompt to clip
selection.

ADR 0004 names `assistant-ui` as the chat UI foundation and defines Phase 3 as
the point where a user asks in chat, sees matching clip cards, and selects clips
for later edit planning. ADR 0005 leaves browser-fetchable thumbnail and preview
URLs as a deferred Phase 3 decision because Phase 2 returns generated `var/...`
path references that are useful to the API but not directly renderable by the
browser.

This phase should remain runnable without OpenAI, Gemini, or any other
model-provider API key. AI-assisted EditPlan generation is valuable, but it
depends on selected clip state and belongs in a later phase.

## Goals / Non-Goals

**Goals:**

- Build the first real chat surface with `assistant-ui`.
- Let a user submit a creative request and receive clip-card results backed by
  the existing in-memory retrieval service.
- Keep the Phase 3 chat path deterministic and model-provider-key free.
- Render thumbnails, snippets, timing, preview media, and select/deselect
  controls as structured UI.
- Keep selected clips visible outside or alongside the chat thread.
- Add constrained browser media URLs for generated thumbnails and video previews.
- Preserve the current setup/error behavior while devassets are missing,
  running, or failed.

**Non-Goals:**

- Do not integrate Gemini, OpenAI, AI SDK streaming, or any other LLM provider.
- Do not generate EditPlan JSON, convert EditPlan to `vspec`, call the render
  service, or display final rendered videos.
- Do not persist conversations, selected clips, render jobs, users, or sessions.
- Do not add uploads, production ingestion, embeddings, pgvector, or timeline
  editing.
- Do not expose arbitrary filesystem access through media-serving routes.

## Decisions

### Use `assistant-ui` with a local/custom runtime before adding AI SDK transport

The webapp should add `@assistant-ui/react` and use its thread/composer
primitives with a local/custom runtime adapter that calls the app's own API. The
runtime will create a user message from composer input, call the Phase 3 chat
endpoint, and append an assistant message containing text plus structured clip
candidate data.

Using `@assistant-ui/react-ai-sdk` and a provider-backed streaming endpoint was
considered, but it would require model-provider credentials and prompt/provider
failure handling before the UI selection loop has been proven. A hand-rolled
chat UI was also considered, but ADR 0004 already chose `assistant-ui`, and this
phase should validate that dependency while keeping backend behavior simple.

### Add a narrow no-key API chat facade over clip search

The API should expose a small chat endpoint for the webapp, such as:

```text
POST /chat
```

For Phase 3, the request only needs the latest user text and optional result
limit. The handler should validate the prompt, call the same `ClipSearchService`
used by `POST /clips/search`, and return an assistant-response shape with:

- a short text part, such as a count of matching clips
- a structured clip-candidates part containing the normalized query and results

The endpoint should not call an LLM or accept client-provided clip metadata.
Keeping a chat facade in the API gives Phase 4 a stable place to add Gemini or
another EditPlan generator later. Having the frontend call `/clips/search`
directly was considered, but that would push chat orchestration into browser
code and make the later AI boundary less explicit.

### Return browser media URLs derived from validated generated references

Phase 2 clip results include `thumbnailPath` and `previewPath` as generated
references such as `var/thumbnails/...` and `var/devassets/...`. Phase 3 should
derive browser-fetchable URLs from those validated references, for example:

```text
var/thumbnails/example.jpg
  -> /api/media/thumbnails/example.jpg

var/devassets/assets/example/<identity>/source.mp4
  -> /api/media/devassets/assets/example/<identity>/source.mp4
```

The original generated references should remain available for later trusted
backend validation. The webapp should use the URL fields for thumbnails and
previews.

### Serve only constrained generated media from configured roots

The API should add media routes that resolve URL suffixes against configured
`THUMBNAILS_DIR` and `DEVASSETS_DIR` roots. The resolver must reject absolute
paths, empty path segments, `.` or `..`, suffixes outside the configured root,
and unsupported file types.

For Phase 3, thumbnail routes should serve image formats produced by the seed
service, and devasset preview routes should serve generated source video files.
Transcript JSON, SRT files, audio extraction artifacts, seed status files, and
library metadata should not be exposed through these browser media routes.

The implementation may use a static-file helper only if it preserves these
constraints and browser video behavior. Otherwise, explicit Fastify handlers
should stream files and support byte-range requests for previews.

### Keep selected clips in browser session state

Selected clips should live in React state for this phase. Selection should be
keyed by deterministic clip id, not list index, so repeated searches can update
or reuse the same selected clip without duplicates. A selected-clip panel or
rail should remain visible outside or alongside the chat thread.

Persisting selections in the API was considered, but ADR 0004 defers durable
conversation and selection state until there is a real multi-session need. The
next phase can submit selected clip ids and the prompt to an EditPlan endpoint
without retrofitting a database into Phase 3.

### Keep setup and failure states explicit

The existing setup screen should remain the entry point while devassets are
missing, running, or failed. Once ready, the app should show the chat
experience. If a chat request receives a `devassets_not_ready` response because
seed state changed while the page was open, the UI should surface a clear
recoverable message rather than showing stale results.

## Risks / Trade-offs

- `assistant-ui` integration may take longer than a hand-built form -> Keep the
  runtime local/custom and implement only the thread, composer, assistant text,
  and structured clip-card renderer needed for Phase 3.
- No-key chat may feel less intelligent than a true LLM assistant -> Be honest
  in response copy and use this phase to validate the clip-selection workflow;
  add Gemini or another model in Phase 4 after selections exist.
- Browser media serving can accidentally widen filesystem access -> Use a
  shared resolver, configured roots, path-segment validation, extension
  allowlists, and tests for traversal and unsupported artifacts.
- Preview videos can be large -> Support byte-range requests where practical
  and keep the UI focused on short previews using clip start/end metadata.
- Selection state is lost on refresh -> Accept browser-session state for the
  prototype and revisit persistence when durable conversations or render jobs
  are introduced.
- Existing lexical retrieval can return sparse or surprising results -> Preserve
  empty-state UI and keep search quality improvements outside this phase unless
  they block the chat-card milestone.

## Migration Plan

This change has no durable data migration.

Implementation should:

1. Add the assistant chat and media-serving contracts to the API.
2. Add constrained media URL derivation for clip results consumed by chat.
3. Replace the ready-state shell with the assistant chat layout while preserving
   setup/error screens.
4. Add custom clip cards with selection controls and selected-clip summary UI.
5. Add API and webapp tests for request validation, non-ready states, media
   route safety, rendering, and selection behavior.
6. Update documentation with no-key local verification steps.

Rollback is removing the Phase 3 webapp UI, chat route, media-serving routes,
new dependencies, tests, and documentation. Generated devassets and thumbnails
do not require migration.

## Open Questions

- Should the Phase 3 chat endpoint accept only the latest user text or a full
  message history shape that more closely matches future LLM transport?
- Should preview playback seek to `startMs` automatically in Phase 3, or is a
  thumbnail plus source preview link enough for the first milestone?
- Should selected clips preserve the query that found them for later EditPlan
  prompting?
