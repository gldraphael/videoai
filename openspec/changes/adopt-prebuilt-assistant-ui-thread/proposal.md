## Why

The current webapp still owns too much generic chat UI: composer behavior,
message layout, text-part rendering, loading indicators, and thread styling.
Using a prebuilt assistant-ui thread lets the prototype keep local code focused
on the VideoAI-specific clip workflow before later phases add EditPlan,
vspec, and rendering UI.

## What Changes

- Add the current assistant-ui registry `Thread` component and use that
  out-of-the-box surface for the ready-state chat experience.
- Remove local React code that reimplements generic chat behavior, including
  the bespoke composer, message labels, text/running part rendering, and
  manual message-part switching.
- Register the `clip-candidates` assistant data part through assistant-ui's data
  UI mechanism so custom React is limited to clip/video rendering and
  select/deselect behavior.
- Keep selected clips reviewable outside the assistant message body, but keep
  that panel narrow and explicitly VideoAI-specific.
- Preserve setup/error gating, no-key local chat behavior, `/api/chat` request
  shape, media URL usage, and selected-clip session storage compatibility.
- Add an ADR recording the registry component and ownership decision.
- Do not add LLM integration, EditPlan generation, vspec conversion, rendering,
  auth, uploads, embeddings, durable conversations, or new backend APIs.

## Capabilities

### New Capabilities

- `prebuilt-assistant-ui-clip-experience`: Defines the ready-state chat
  experience built from the assistant-ui registry thread, with custom frontend
  behavior limited to clip candidates, preview media, selected clips, and setup
  gating.

### Modified Capabilities

- None.

## Impact

- Affects `services/webapp` React code by replacing custom thread, composer,
  message, and text-part components with prebuilt assistant-ui UI.
- Adds assistant-ui registry component source and its required shadcn/Tailwind
  support dependencies. It MUST NOT add the legacy `@assistant-ui/react-ui`
  package.
- Reduces local CSS to page shell, setup/error states, selected-clips review,
  and clip/video card styling.
- Does not change API contracts, media-serving routes, devasset status polling,
  selected-clip storage format, or generated devasset data.
- Adds `docs/adr/0008-adopt-prebuilt-assistant-ui-thread.md`.
