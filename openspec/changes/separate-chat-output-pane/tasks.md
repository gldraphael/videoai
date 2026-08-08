## 1. Output Workspace Model

- [x] 1.1 Add webapp types for output result groups, output clips, included clips, and versioned output-workspace session state.
- [x] 1.2 Add helper functions for creating result groups from `clip-candidates`, including clips, excluding clips, removing clips, removing groups, and deduplicating by deterministic clip id.
- [x] 1.3 Add parse and serialize helpers for the new output-workspace session key.
- [x] 1.4 Preserve compatibility by restoring valid `videoai:selected-clips:v1` records as included context when no newer workspace state exists.

## 2. Chat Adapter Split

- [x] 2.1 Extend the local clip chat adapter options with a structured output callback for clip candidate result groups.
- [x] 2.2 Update chat response mapping so assistant-ui receives assistant text parts only.
- [x] 2.3 Route non-empty `clip-candidates` response data into output workspace state through the callback.
- [x] 2.4 Keep no-result, devasset-not-ready, validation, and recoverable API error flows text-only without adding stale or fabricated output cards.

## 3. Ready-State UI

- [x] 3.1 Replace inline `clip-candidates` data UI rendering with an output workspace pane outside the assistant message body.
- [x] 3.2 Render output groups with request labels, counts, and thumbnail-only clip cards that show title, timing, score, and snippet when present.
- [x] 3.3 Add include and exclude controls that update included context without removing the original output item.
- [x] 3.4 Add remove controls for individual output clips and whole output groups, keeping included context state coherent.
- [x] 3.5 Show included context near the composer or output pane so users can see which clips are carried forward while composing.
- [x] 3.6 Remove source video preview playback from the ready-state clip card UI for this change.
- [x] 3.7 Update responsive layout so wide viewports show chat plus right output pane and narrow viewports keep chat, composer, output cards, and controls usable without horizontal scrolling.

## 4. Tests

- [x] 4.1 Update chat model tests for text-only assistant content and structured output callback behavior.
- [x] 4.2 Add tests for output group creation, clip include/exclude, duplicate prevention, clip removal, and group removal.
- [x] 4.3 Add tests for v1 selected-clip session migration into included context.
- [x] 4.4 Update render tests so clip cards appear in the output workspace and not inside assistant messages.
- [x] 4.5 Add or update assertions proving output cards render thumbnails or fallback states only and do not render `<video>` elements.
- [x] 4.6 Add or update responsive/layout coverage where practical for the chat/output-pane arrangement.

## 5. Validation

- [x] 5.1 Run `pnpm --filter @videoai/webapp test`.
- [x] 5.2 Run `pnpm --filter @videoai/webapp check`.
- [x] 5.3 Run `pnpm --filter @videoai/webapp build`.
- [x] 5.4 Confirm no API response-shape, render-service, `vspec`, EditPlan, or video playback behavior was added as part of the implementation.
