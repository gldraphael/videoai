## Why

The Phase 3 webapp proves chat-backed clip discovery, but the assistant-ui
surface now carries more custom layout and styling than the prototype needs.
Simplifying it now keeps the core clip-selection loop easier to maintain before
later phases add EditPlan generation, vspec conversion, and rendering.

## What Changes

- Reshape the ready-state chat view to follow the standard assistant-ui thread
  anatomy more closely: runtime provider, thread viewport, message list,
  viewport footer, and composer.
- Remove or reduce bespoke workspace, message, composer, and loading-screen
  styling that makes the app feel separate from assistant-ui.
- Keep only the custom UI required for VideoAI-specific behavior: structured
  clip-candidate rendering, video preview playback, select/deselect controls,
  and selected-clip review state.
- Preserve setup/error gating while restyling those states to feel consistent
  with the simplified assistant-ui chat surface.
- Preserve existing no-key local chat behavior, media URLs, session selected
  clips, and error handling.
- Do not add LLM integration, EditPlan generation, vspec conversion, rendering,
  auth, uploads, embeddings, durable conversations, or new backend APIs.

## Capabilities

### New Capabilities

- `minimal-assistant-ui-clip-experience`: Defines the simplified assistant-ui
  chat surface, the small amount of VideoAI-specific clip UI that remains, and
  the setup/error behavior that must be preserved.

### Modified Capabilities

- None.

## Impact

- Affects the React webapp by simplifying `App.tsx` message/thread composition
  and reducing custom CSS in `styles.css`.
- Keeps `@assistant-ui/react` as the only chat UI dependency; no shadcn,
  Tailwind, icon, markdown, attachment, or action-bar dependencies are required
  for this change.
- Does not change API request/response contracts, media-serving routes,
  devasset status polling, selected-clip storage format, or generated runtime
  data.
- Requires focused webapp tests or updated assertions for setup gating,
  ready-state chat rendering, clip selection, and video-preview URL behavior.
