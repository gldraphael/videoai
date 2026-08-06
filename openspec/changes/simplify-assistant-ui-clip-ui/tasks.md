## 1. Baseline And Constraints

- [x] 1.1 Review the current webapp chat, setup, clip-card, selected-clip, and CSS code paths before editing.
- [x] 1.2 Confirm the existing chat adapter, API response mapping, media URL formatting, and selected-clip storage tests still describe the contracts to preserve.
- [x] 1.3 Identify current CSS selectors that belong to generic assistant chat layout versus VideoAI-specific clip evaluation UI.

## 2. Assistant Thread Simplification

- [x] 2.1 Remove the bespoke ready-state workspace header and meta chrome so the assistant thread and composer become the primary ready-state surface.
- [x] 2.2 Refactor message rendering to use assistant-ui message primitives for normal text and running message states where practical.
- [x] 2.3 Register or route the `clip-candidates` data part through a focused renderer without manually reimplementing all message-part rendering.
- [x] 2.4 Keep the existing local runtime adapter and `/api/chat` request behavior unchanged.
- [x] 2.5 Preserve the existing empty-chat state with concise local-clip copy inside the simplified assistant chat surface.

## 3. Clip Evaluation UI

- [x] 3.1 Keep clip cards rendering title, timing, score, optional snippet, thumbnail or fallback media state, and select or deselect controls.
- [x] 3.2 Keep native preview video playback using existing browser media URLs and clip timing fragments.
- [x] 3.3 Preserve selected-state sync when the same clip appears in multiple assistant responses.
- [x] 3.4 Preserve selected-clip session storage parsing, serialization, dedupe, and removal behavior.
- [x] 3.5 Simplify the selected-clips review area while keeping it visible outside the assistant message body on desktop and mobile layouts.

## 4. CSS And Setup State Simplification

- [x] 4.1 Reduce generic page, thread, message, and composer CSS to a small assistant-style layout system.
- [x] 4.2 Keep only the clip-card and selected-clips CSS needed for stable media dimensions, readable metadata, responsive layout, and clear selected state.
- [x] 4.3 Restyle setup and setup-error screens to share the same restrained visual language as the simplified chat surface.
- [x] 4.4 Preserve setup polling, setup progress indication, setup error messaging, and chat gating behavior.
- [x] 4.5 Remove unused selectors and copy that belonged only to the old custom workspace shell.

## 5. Tests And Verification

- [x] 5.1 Update webapp render tests for the simplified ready-state chat surface and setup/error gating.
- [x] 5.2 Keep or update tests for clip preview URL fragments, clip selection, deselection, duplicate prevention, and session-storage compatibility.
- [x] 5.3 Add or update coverage proving structured clip candidates still render through the assistant message path after the refactor.
- [x] 5.4 Run `pnpm --filter @videoai/webapp test`.
- [x] 5.5 Run `pnpm --filter @videoai/webapp check`.
- [x] 5.6 Run `openspec validate simplify-assistant-ui-clip-ui --type change --strict`.
- [x] 5.7 Run `openspec status --change simplify-assistant-ui-clip-ui` and confirm the change is apply-ready.
