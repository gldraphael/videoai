## Why

Phase 2 gives the API a deterministic way to return ranked clip candidates, but
the prototype still lacks the user-facing chat loop that makes those candidates
useful. The next phase should prove that a user can describe a video in a chat
interface, see plausible clips as rich cards, and select the clips that should
feed later EditPlan generation without requiring any model-provider API key.

## What Changes

- Replace the ready-state web shell with an `assistant-ui` based chat experience
  once local devassets are ready.
- Add a no-key chat path that turns each user request into a deterministic clip
  search response using the existing in-memory retrieval service.
- Render clip search results as structured assistant content with custom,
  selectable clip cards instead of Markdown-only responses.
- Keep selected clips in browser session state and show them outside or
  alongside the chat thread so the user can review the working set.
- Add constrained browser-fetchable URLs for generated thumbnails and source
  media previews so clip cards can display real local media.
- Keep Phase 3 scoped to chat, clip cards, preview media, and selection state.
  Do not add LLM integration, EditPlan generation, vspec conversion, rendering,
  auth, uploads, embeddings, or durable conversation persistence.

## Capabilities

### New Capabilities

- `assistant-chat-clip-results`: Defines the no-key assistant chat experience,
  search-backed assistant responses, selectable clip cards, and browser-local
  selected clip state.
- `constrained-devasset-media-serving`: Defines constrained API serving of
  generated devasset and thumbnail files for browser previews.

### Modified Capabilities

- None.

## Impact

- Affects the React webapp by adding `assistant-ui`, replacing the ready-state
  shell with a real chat surface, adding custom clip-card rendering, and adding
  selected-clip state.
- Affects the TypeScript API by adding a thin chat endpoint or adapter over
  existing clip search and by adding constrained media-serving routes for
  generated thumbnails and preview videos.
- Affects local route behavior through the existing `/api` Traefik prefix so
  the webapp can call chat, clip search, and media URLs from the same host.
- Adds focused web and API tests for no-key chat behavior, media route safety,
  clip-card result shape, selection behavior, and non-ready devasset states.
- Adds documentation for running Phase 3 locally without OpenAI, Gemini, or any
  other model-provider key.
