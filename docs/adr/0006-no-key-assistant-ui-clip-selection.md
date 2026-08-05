# ADR 0006: No-Key assistant-ui Clip Selection

## Status

Proposed.

Supports OpenSpec change `phase-3-assistant-ui-clip-results`.

## Context

ADR 0004 chose `assistant-ui` as the chat UI foundation and defined Phase 3 as
the milestone where a user asks in chat, sees matching clip cards, and selects
clips for later edit planning.

ADR 0005 completed the retrieval side of that loop. The API can now turn
prompt-like text into ranked clip candidates from generated local devasset
artifacts without PostgreSQL, embeddings, or external search services.

The next design question is whether Phase 3 should first integrate an LLM
provider such as Gemini, or first make the chat and clip-selection product loop
work without model-provider credentials.

## Decision

Implement Phase 3 as a no-key `assistant-ui` chat and clip-selection experience
before adding Gemini or any other LLM provider.

The webapp will use `assistant-ui` for the chat thread, composer, assistant
message rendering, and structured clip-candidate UI. It will use a local/custom
runtime path rather than an AI SDK/provider transport for this phase.

The API will expose a narrow chat facade over the existing clip search service.
For Phase 3, this endpoint will validate the latest user request, call local
clip search, and return an assistant response with:

- short deterministic assistant text
- structured clip-candidates data
- browser-fetchable thumbnail and preview URLs derived from trusted generated
  references

The model-provider boundary remains deferred. Gemini or another LLM can later
consume the user's prompt plus selected clip ids to produce validated EditPlan
JSON, but it should not be required for searching clips, rendering cards, or
selecting clips.

## Architecture

```text
User prompt
    |
    v
assistant-ui local/custom runtime
    |
    v
POST /api/chat
    |
    v
API chat facade
    |
    v
existing ClipSearchService
    |
    v
assistant response
  - text part
  - clip-candidates data part
    |
    v
custom clip-card renderer
    |
    v
browser-session selected clips
```

Generated media references remain trusted backend references:

```text
var/thumbnails/example.jpg
var/devassets/assets/example/<identity>/source.mp4
```

The API derives browser URLs from those references:

```text
/api/media/thumbnails/example.jpg
/api/media/devassets/assets/example/<identity>/source.mp4
```

Media routes must resolve only under configured generated roots, reject path
traversal, and serve only preview artifacts needed by clip cards.

## Alternatives Considered

### Gemini-first integration

Gemini integration would prove provider connectivity, prompt shaping, and
provider error handling, but it would not prove the Phase 3 product loop by
itself. It would also make the next milestone depend on credentials before the
app has selected clip state for the model to use.

### Frontend calls `/clips/search` directly

This is the smallest implementation, but it pushes chat orchestration into the
browser. A small API chat facade gives the later EditPlan/LLM phase a stable
server boundary without adding model behavior now.

### Persist selected clips in the API

Persisting selections would prepare for durable conversations, but ADR 0004
intentionally defers durable state. Browser-session selection state is enough to
validate the local demo loop.

### Serve the generated folders as broad static roots

Broad static serving is easy, but it risks exposing transcripts, seed status,
library metadata, audio artifacts, or unintended local files. Phase 3 should use
constrained media routes that serve only thumbnail and preview media.

## Consequences

The next milestone remains runnable with only the local stack and generated
devassets. Developers can validate the chat and clip-selection experience
without OpenAI, Gemini, or any other model-provider key.

`assistant-ui` becomes real product infrastructure rather than a deferred
dependency. The project can learn whether its thread, composer, and custom data
rendering model fit the VideoAI workflow before adding streaming LLM behavior.

The chat response will be deterministic and less creative than a model-backed
assistant. That is acceptable because Phase 3 is testing candidate discovery,
media cards, and selection state. Creative planning belongs in the EditPlan
phase once selected clips exist.

The media-serving surface becomes part of the API contract. It must stay narrow,
root-checked, and covered by route-safety tests.

## Deferred Decisions

- Whether Phase 4 uses Gemini, OpenAI, a local model endpoint, or a provider
  abstraction for EditPlan generation.
- Whether the Phase 3 chat endpoint should later evolve into an AI SDK
  streaming transport or stay as a custom backend adapter.
- Whether selected clips should become durable when conversation history or
  render jobs are introduced.
- Whether preview playback should automatically seek to clip start offsets or
  remain a source-preview control until the timeline/edit phases.
