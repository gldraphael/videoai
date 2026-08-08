## Why

The current chat thread can become crowded because assistant responses render
video clip cards inline with conversational text. The next UI step should keep
chat readable while making clip results feel like durable output artifacts that
users can review, include in later prompts, and clear when they are no longer
useful.

## What Changes

- Make the ready-state chat thread text-only: user messages and assistant
  messages render conversational text, while video or asset outputs do not
  render inside the message flow.
- Introduce a right-side output pane that receives clip candidate outputs from
  chat responses and displays them as thumbnail-based cards grouped by request.
- Distinguish output items from included chat context: users can include or
  exclude output clips for the next chat request without treating the entire
  output pane as selected.
- Let users remove individual clips or result groups from the output pane so
  the workspace does not grow indefinitely during repeated searches.
- Keep the existing no-key local chat and clip-search contracts stable.
- Keep `vspec`, EditPlan generation, render submission, and video playback out
  of scope for this layout change. Thumbnails are acceptable for clip output
  cards until the later `vspec`/render phases own actual playback.

## Capabilities

### New Capabilities

- `chat-output-workspace`: Defines the text-only chat thread, right-pane
  thumbnail output workspace, include/exclude behavior for prompt context, and
  output removal behavior.

### Modified Capabilities

- None.

## Impact

- Affects `services/webapp` ready-state layout, assistant data handling, clip
  candidate rendering, selected/included clip state, session storage, and tests.
- Does not require API response shape changes; `/api/chat` can continue
  returning assistant text plus structured `clip-candidates` data.
- Does not require new backend routes, render-service behavior, model-provider
  integration, `vspec` generation, EditPlan generation, or video playback.
- Adds an ADR documenting the revised UI ownership boundary and its
  relationship to ADR 0004, ADR 0006, and ADR 0008.
