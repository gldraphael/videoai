## 1. Dependency And Baseline

- [x] 1.1 Add the current assistant-ui registry `Thread` component to `services/webapp` and install the registry-declared dependencies. Do not add the legacy `@assistant-ui/react-ui` package.
- [x] 1.2 Add only the shadcn/Tailwind support files and stylesheet imports required to compile and style the registry `Thread`.
- [x] 1.3 Confirm the local chat adapter, `/api/chat` request body, media URLs, and selected-clip storage helpers remain unchanged before replacing UI code.
- [x] 1.4 Confirm ADR 0008 records the registry-thread ownership decision and the `@assistant-ui/react-ui` non-decision.

## 2. Ready-State React Simplification

- [x] 2.1 Replace the local ready-state thread composition with the assistant-ui registry `Thread`.
- [x] 2.2 Remove local React components that only recreate generic chat behavior, including the custom composer, message wrapper, text-part renderer, running indicator, and generic chat notice banner.
- [x] 2.3 Keep setup and setup-error gating outside the assistant thread so the composer is unavailable until devassets are ready.
- [x] 2.4 Keep selected-clip state and selected-clips review outside assistant message content.

## 3. Clip Data UI

- [x] 3.1 Register a `clip-candidates` assistant data renderer under `AssistantRuntimeProvider`.
- [x] 3.2 Keep clip card rendering limited to title, timing, score, optional snippet, preview video or thumbnail fallback, and select/deselect controls.
- [x] 3.3 Preserve preview media fragments using existing `clipPreviewUrl` behavior.
- [x] 3.4 Preserve selected-state sync, duplicate prevention, removal, and session-storage compatibility.
- [x] 3.5 Verify recoverable chat failures appear as assistant text with empty clip results rather than a separate custom ready-state notice.

## 4. CSS Cleanup

- [x] 4.1 Remove generic thread, message, text, running, and composer CSS replaced by the assistant-ui registry component.
- [x] 4.2 Keep local CSS scoped to app placement, setup/error states, selected clips, and clip/video cards.
- [x] 4.3 Add only minimal layout or theme overrides needed to make the prebuilt thread and selected-clips review work responsively.

## 5. Tests And Verification

- [x] 5.1 Update webapp render tests for the prebuilt ready-state thread and setup/error gating.
- [x] 5.2 Update clip-candidate rendering coverage to exercise the assistant data UI path.
- [x] 5.3 Keep tests for clip preview URL fragments, selection, deselection, duplicate prevention, and session-storage compatibility.
- [x] 5.4 Add or update coverage for API failure and devasset-not-ready responses appearing as assistant thread content.
- [x] 5.5 Run `pnpm --filter @videoai/webapp test`.
- [x] 5.6 Run `pnpm --filter @videoai/webapp check`.
- [x] 5.7 Run `pnpm --filter @videoai/webapp build`.
- [x] 5.8 Run `openspec validate adopt-prebuilt-assistant-ui-thread --type change --strict`.
- [x] 5.9 Run `openspec status --change adopt-prebuilt-assistant-ui-thread` and confirm the change is apply-ready.
