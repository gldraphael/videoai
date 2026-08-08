## Context

See `proposal.md` for motivation and
`specs/chat-output-workspace/spec.md` for behavior. The current ready-state
webapp uses the assistant-ui registry `Thread` and registers a
`clip-candidates` data renderer inside `AssistantRuntimeProvider`. The local
chat adapter calls `/api/chat`, maps assistant text to normal message content,
and maps structured `clip-candidates` data to assistant-ui data parts. Those
data parts currently render clip cards inside the assistant message body.

The backend already returns trustworthy clip metadata, thumbnail URLs, preview
URLs, timing, snippets, and scores. The layout change can reuse that response
shape and avoid new render-service, `vspec`, EditPlan, or provider-backed model
work.

Current ready-state shape:

```text
Chat thread
  user text
  assistant text
  clip-candidates data part
    thumbnail/video clip cards

Selected clips panel
  cross-search selected working set
```

Target ready-state shape:

```text
Chat pane                         Output pane
  user text                         result group: request text
  assistant text                      thumbnail clip cards
  composer                            include/exclude/remove
  included-context chips
```

## Goals / Non-Goals

**Goals:**

- Keep the assistant-ui thread responsible for ordinary chat text, composer,
  scrolling, and message behavior.
- Move VideoAI clip output UI out of assistant message content and into a
  dedicated output workspace.
- Treat output clips and included chat context as related but separate state.
- Preserve v1 selected-clip session compatibility by restoring existing
  selected clips as included context.
- Use thumbnails or fallback media states only; do not render source video
  previews in this change.

**Non-Goals:**

- Do not add `vspec`, EditPlan, render-job, or final-video playback behavior.
- Do not require `/api/chat` response shape changes or new backend routes.
- Do not introduce durable conversation, output, or selection persistence.
- Do not build a timeline editor, custom video player, or asset-upload flow.

## Decisions

### Redirect structured clip outputs before assistant message rendering

The webapp should keep calling `/api/chat`, but the local chat adapter should
separate the response into two channels:

```text
/api/chat response
  text part ----------------------> assistant-ui message content
  clip-candidates data part ------> output workspace state
```

This can be implemented by extending the local adapter options with an output
callback and changing response-to-assistant-content mapping so assistant-ui only
receives text parts. The output callback should receive normalized result group
data: a stable group id, the query/request label, creation time or sequence,
and the returned candidates.

Alternative: Keep `clip-candidates` as assistant-ui data parts and render a
hidden/null data UI that mutates output state. That couples output state to
message rendering and risks side effects during React render. Moving the split
to the adapter boundary gives clearer ownership.

### Model output pane state as result groups plus included context

Output pane state should represent candidate results returned by chat requests,
not only clips the user has selected. Included context should represent the
subset the user wants to carry forward while composing later requests.

```text
outputGroups[]
  id
  query
  candidates[]

includedClips[]
  clip id
  asset id
  title
  timing
  score
  thumbnail/preview references
```

Cards in output groups read included state by deterministic clip id. Include
adds to `includedClips` with duplicate prevention. Exclude removes from
`includedClips` but leaves the output card visible. Removing an output card or
group updates output state and should also keep included state coherent. The
simplest coherent rule is: removing an output clip also removes that clip from
included context unless it exists in another output group.

Alternative: Keep the existing selected-clips list as the entire right pane.
That does not solve result clutter because users would still need to select a
clip before it becomes visible outside chat. The new workflow needs unselected
outputs to live outside the chat too.

### Preserve local session storage with a new versioned boundary

Use a new storage key for the combined output-workspace state, and continue
reading the existing `videoai:selected-clips:v1` payload as migration input.
On first ready-state load, valid v1 selected clips should populate
`includedClips`. Output groups can remain empty until new chat responses arrive.

The new state should remain browser-session scoped. That matches ADR 0006 and
ADR 0004's current decision to defer durable conversation and render-job
persistence.

Alternative: Reuse the old selected-clips storage key. That keeps less code,
but the meaning changes from "selected clips" to "outputs plus included
context", making compatibility and future migrations harder to reason about.

### Use thumbnail-only clip cards until the render path owns video playback

Output cards should display thumbnails, metadata, snippets, include/exclude
controls, and remove controls. They should not instantiate `<video>` playback
from source media or preview fragments in this change.

This preserves the future invariant that actual video playback in the product
should come through a `vspec`/render-backed path. Thumbnails are enough to prove
the layout and selection workflow without pulling Phase 5/6 rendering work into
this UI change.

Alternative: Keep existing preview playback in output cards. That would be a
small port of current behavior, but it works against the intended architecture
where visible videos should eventually be validated/rendered through `vspec`.

### Keep responsive layout explicit

Wide screens should use a two-pane layout where the chat remains primary and
the output workspace is a right-side pane. Narrow screens should keep the
composer reachable and make outputs available through a stacked section or
compact workspace region that does not cause horizontal page scrolling.

The output pane should support removing individual clips and whole groups so
the list remains manageable during repeated searches. Empty state copy should
be short and functional.

## Risks / Trade-offs

- The chat text and corresponding outputs can feel disconnected -> Group
  outputs by request label and keep the assistant text count aligned with the
  result group count.
- Local included context may look like backend-aware context before the API
  uses it -> Keep the UI wording focused on included context and avoid claiming
  model-aware behavior in this change.
- Removing inline data parts could hide structured outputs if the callback path
  fails -> Add tests for adapter splitting, output group creation, and text-only
  assistant rendering.
- Session storage migration could create duplicates when the same clip appears
  later -> Deduplicate included clips by deterministic clip id.
- Narrow layouts may bury the output workspace -> Validate mobile rendering and
  keep include/remove controls reachable without horizontal scrolling.

## Migration Plan

1. Refactor webapp state so ready-state chat owns output groups and included
   clips separately from assistant message content.
2. Change the local chat adapter mapping so assistant-ui receives text-only
   assistant content and structured clip candidates update output groups.
3. Replace inline clip-card rendering with output-pane thumbnail cards and
   include/exclude/remove controls.
4. Restore valid v1 selected clips as included context and write new
   output-workspace session state under a versioned key.
5. Update tests for text-only chat rendering, output group creation, included
   context behavior, output removal, session compatibility, and thumbnail-only
   cards.
6. Validate responsive layout manually or with existing webapp render tests.

Rollback is reverting the webapp component, model, and CSS changes. The backend
contract and generated media files do not need rollback.
