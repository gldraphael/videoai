# ADR 0010: Text-Only Chat With Output Workspace

## Status

Proposed.

Supports OpenSpec change `separate-chat-output-pane`.

## Context

[ADR 0004: Lean Chat-First Video AI Prototype Architecture](0004-lean-chat-first-video-ai-prototype-architecture.md)
chose `assistant-ui` as the chat foundation and framed the core prototype loop:
prompt, candidate clips, selected clips, validated `vspec`, and rendered video.
It also separated natural-language assistant text from structured clip data.

[ADR 0005: In-Memory Clip Retrieval API](0005-in-memory-clip-retrieval-api.md)
made prompt-like clip search local and deterministic over generated devasset
files. [ADR 0006: No-Key assistant-ui Clip Selection](0006-no-key-assistant-ui-clip-selection.md)
then added a no-key chat facade that returns assistant text plus structured
`clip-candidates` data. [ADR 0008: Adopt assistant-ui Registry Thread](0008-adopt-prebuilt-assistant-ui-thread.md)
adopted the registry `Thread` so VideoAI owns clip-specific UI rather than
generic chat behavior.

That flow works, but inline clip cards make the chat thread carry two jobs:
conversation history and media output review. As users run repeated searches,
the thread becomes a long mixed scroll of text and asset cards. The product
needs a clearer boundary before moving toward EditPlan and `vspec` work.

There is also an emerging media invariant: actual video displayed in the app
should eventually be backed by `vspec` or a rendered output. This layout change
should not pull `vspec`, EditPlan generation, or rendering into scope, so
thumbnail-only clip outputs are acceptable for now.

## Decision

Adopt a text-only chat thread paired with a separate output workspace.

The assistant-ui registry `Thread` remains the owner of ordinary chat behavior:
message list, text rendering, composer, send/running behavior, scrolling, and
generic assistant affordances. User and assistant messages in the chat thread
should render conversational text only.

VideoAI media outputs should render outside the assistant message body in a
right-side output pane on wide viewports. For this change, output pane clip
cards should use thumbnails or fallback thumbnail states, not source video
playback.

The webapp should split `/api/chat` responses at the local adapter boundary:

```text
/api/chat response
  text part ----------------------> assistant-ui thread
  clip-candidates data part ------> output workspace
```

The backend response shape remains stable. `/api/chat` can continue returning
assistant text plus structured `clip-candidates` data from trusted local
retrieval. No new backend route, render-service behavior, EditPlan generation,
`vspec` generation, or model-provider integration is required for this UI
workflow.

The output workspace owns two related state concepts:

```text
Output item
  A candidate/result/generated artifact shown in the output pane.

Included context
  A user-chosen subset of output clips shown near the composer or output pane
  as context while composing later chat turns.
```

Users can include or exclude clips as chat context without removing the output
item. Users can remove individual output clips or whole output groups so the
workspace does not grow indefinitely. Existing browser-session selected clips
from the previous Phase 3 UI should be restored as included context.

This ADR refines the inline clip-card portions of ADR 0004, ADR 0006, and ADR
0008. It does not change their decisions to use assistant-ui, keep the no-key
local chat path, trust API-provided clip metadata, defer durable persistence,
or preserve the validated EditPlan-to-`vspec` boundary.

## Architecture

```text
React ready-state app
    |
    v
AssistantRuntimeProvider
    |
    +-- local chat adapter
    |       POST /api/chat
    |       assistant text -> Thread message content
    |       clip candidates -> output workspace state
    |
    +-- assistant-ui registry Thread
    |       text-only user and assistant messages
    |       composer and included-context display
    |
    +-- Output workspace
            result groups by request
            thumbnail clip cards
            include/exclude/remove controls
```

The right pane becomes the place where media and later generated artifacts can
accumulate. In future phases, it can host validated plans, generated `vspec`,
render jobs, and rendered videos without turning the chat thread into the
primary artifact browser.

## Alternatives Considered

### Keep Clip Cards Inline In Assistant Messages

This preserves the current implementation and follows the original ADR 0004
sketch literally, but it makes every result set permanent chat scroll content.
That becomes awkward once the app needs search results, selected context,
generated plans, render status, and final videos in the same workflow.

### Use Only A Selected-Clips Sidebar

The current selected-clips panel is useful as a working set, but it only shows
clips after the user selects them. It does not solve the problem of unselected
search results crowding the chat thread.

### Add Vspec Or Rendered Preview Output Now

This would align media display with the final product invariant, but it expands
a layout change into EditPlan, `vspec`, render-service, and playback work.
Thumbnail cards are enough to validate the workflow boundary now.

### Persist Outputs In The API

Server-side persistence would prepare for durable conversations and render
history, but ADR 0004 and ADR 0009 intentionally defer persistence until there
is a concrete data model. Browser-session state remains sufficient for this
local prototype milestone.

## Consequences

The chat thread becomes easier to read and reason about. It records user intent
and assistant explanation, while the output workspace records media artifacts.

VideoAI-specific frontend code shifts from an assistant-ui data renderer inside
messages to an output workspace outside messages. That keeps ADR 0008's
ownership boundary intact: assistant-ui owns generic chat UI, VideoAI owns
media workflow UI.

The app needs a slightly richer local state model: output result groups,
included context, removal behavior, and session migration from selected clips.
That is acceptable because the complexity belongs to the product workflow, not
generic chat rendering.

Users may need help connecting an assistant text response with the output group
that appeared beside it. Grouping outputs by request label and count should make
the relationship explicit without putting media cards back into the thread.

Actual video preview is deferred. The UI will feel less media-rich in the short
term, but it avoids normalizing source-video playback before the project has a
validated `vspec`/render-backed video path.

## Validation

The implementation should validate this decision by:

- proving assistant messages render text only when `/api/chat` returns
  `clip-candidates`
- proving returned clip candidates appear in the output workspace as grouped
  thumbnail cards
- proving include, exclude, individual removal, and group removal behavior
- proving existing selected-clip session state restores as included context
- proving output cards do not render source `<video>` playback
- proving no API response-shape, render-service, EditPlan, or `vspec` behavior
  is required
- running webapp tests, typecheck, and build

## Deferred Decisions

- When included clip context becomes a backend/model input rather than local UI
  state.
- Whether output groups should become durable when conversations or render jobs
  are persisted.
- How rendered videos, generated `vspec`, and render status should appear in
  the output workspace once later phases implement them.
- Whether a future `vspec` preview path should represent source passthrough,
  clips, intermediate previews, final renders, or all visible video playback.
