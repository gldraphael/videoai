# ADR 0008: Adopt assistant-ui Registry Thread

## Status

Proposed.

Supports OpenSpec change `adopt-prebuilt-assistant-ui-thread`.

## Context

ADR 0004 chose `assistant-ui` as the prototype chat UI foundation. ADR 0006
then established the no-key Phase 3 chat and clip-selection loop: user prompt,
local chat facade, assistant response text plus structured `clip-candidates`,
custom clip cards, and browser-session selected clips.

The current webapp proves that loop, but it still owns too much generic chat
interface code. The app has local React for composer behavior, message
containers, message labels, text part rendering, running indicators, manual
message-part routing, and corresponding CSS. That is the wrong ownership
boundary for the prototype. VideoAI should own the video and clip workflow, not
ordinary chat UI.

The project now needs to choose whether to keep trimming the primitive-based
implementation or adopt a prebuilt assistant-ui thread surface. The maintained
assistant-ui path for a styled thread is the assistant-ui/shadcn registry.
`@assistant-ui/react-ui` is a legacy package and should not be used for new
work.

## Decision

Adopt the assistant-ui registry `Thread` for the ready-state webapp chat
experience.

The webapp should use the registry-provided `Thread` component for ordinary
assistant chat behavior: message list, empty state, composer, send behavior,
text rendering, running state, scrolling, and generic chat layout. The registry
component source should be treated as upstream UI: isolated from product
logic, updated through assistant-ui/shadcn workflows, and not customized except
where integration requires it.

VideoAI-specific frontend code should be limited to:

- registering and rendering the `clip-candidates` data part
- rendering clip cards with preview video, thumbnails, timing, snippets, score,
  and select/deselect controls
- maintaining browser-session selected clips
- showing selected clips outside assistant message content
- gating setup and setup-error states before devassets are ready

The app should register the `clip-candidates` renderer through assistant-ui's
data UI mechanism rather than overriding the whole assistant message component.
That keeps ordinary assistant messages inside the prebuilt surface and makes the
custom boundary explicit.

The current no-key local runtime adapter and `/api/chat` contract remain in
place. This ADR changes the frontend UI ownership boundary, not the backend
chat, retrieval, media-serving, or selection storage contracts.

## Architecture

```text
React app
    |
    v
AssistantRuntimeProvider
    |
    +-- assistant-ui data UI registration
    |       name: clip-candidates
    |       render: VideoAI clip cards
    |
    +-- assistant-ui registry Thread
            composer
            message list
            text/running rendering
            scrolling/layout

Selected clips review
    |
    v
browser-session selected clips
```

The backend response shape remains:

```text
assistant response
  - text
  - clip-candidates data
```

The text part is rendered by the registry assistant thread. The data part is
rendered by VideoAI's clip renderer.

## Alternatives Considered

### Use legacy `@assistant-ui/react-ui`

This gives the lowest immediate local line count because it exposes a packaged
`Thread`, but the package is legacy and not the recommended path for new
assistant-ui styled components. Building around it would trade short-term code
reduction for avoidable maintenance risk.

### Continue with assistant-ui primitives

Keeping only `@assistant-ui/react` primitives preserves the smallest dependency
graph, but it leaves this repo responsible for thread layout, composer
behavior, message rendering, and CSS. That conflicts with the desired boundary:
custom frontend code should exist only where the UI is video/clip-specific.

### Build a hand-rolled minimal chat form

A hand-rolled form could be very small initially, but it would discard the
reason ADR 0004 selected `assistant-ui`: useful chat runtime, composer, message,
streaming, and rich data rendering affordances. It would also make later
provider-backed or streaming work harder to integrate.

## Consequences

The webapp gains generated registry component source and supporting
shadcn/Tailwind dependencies. This is more local code than a maintained package
would be, but it follows the current assistant-ui distribution model and keeps
VideoAI product code out of generic chat UI.

The app may show generic assistant affordances that are not essential for the
prototype. Where the registry component supports configuration, disable obvious
unused features. Otherwise, accept generic chat behavior as the cost of keeping
product code minimal.

Local CSS should shrink and become more explicitly product-specific. It should
cover page placement, setup/error states, selected clips, and clip/video cards,
not generic thread, message, composer, or text rendering.

The clip-card renderer becomes the main custom extension point in the webapp.
That is the right place for VideoAI-specific behavior because the assistant-ui
registry thread cannot know how to evaluate source video clips, preview media
fragments, or maintain a cross-search selected working set.

The existing backend and storage contracts remain stable. This avoids changing
retrieval, media serving, no-key chat behavior, or session selected-clip
compatibility while simplifying the frontend.

## Validation

The implementation should validate this decision by:

- proving the ready-state app renders through the registry thread
- proving ordinary assistant text is not rendered by a custom VideoAI message
  component
- proving `clip-candidates` data still renders as selectable clip cards
- proving selected clips remain compatible with the existing session storage
  format
- proving setup/error gating still hides the composer until devassets are ready
- running webapp tests, typecheck, and build
