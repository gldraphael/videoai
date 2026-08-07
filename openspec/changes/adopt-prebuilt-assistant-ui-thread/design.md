## Context

See `proposal.md` for motivation. The current webapp already uses
`@assistant-ui/react` for runtime primitives and a local chat adapter, but it
still owns generic chat UI in `App.tsx`: composer state and keyboard handling,
message labels, message containers, text part rendering, running indicators,
and data-part switching.

The current assistant-ui ecosystem provides styled thread components through
the assistant-ui/shadcn registry. `@assistant-ui/react` remains the runtime and
primitive package; `@assistant-ui/react-ui` is a legacy pre-styled package and
should not be used for new work. The supported ownership boundary is:
assistant-ui registry components own chat UI, while VideoAI owns only
clip/video evaluation and selected-clip state.

## Goals / Non-Goals

**Goals:**

- Collapse the ready-state chat view to the assistant-ui registry `Thread`.
- Keep the existing local runtime adapter and `/api/chat` contract.
- Register a custom renderer only for the named `clip-candidates` data part.
- Remove local React components that exist only to recreate ordinary chat UI.
- Reduce CSS to page-level placement, setup/error screens, selected clips, and
  clip/video cards.
- Record the registry component decision in ADR 0008.

**Non-Goals:**

- Do not add the legacy `@assistant-ui/react-ui` package.
- Do not hand-author or fork custom generic chat components beyond minimal
  integration needed to mount the registry `Thread`.
- Do not convert the whole app into a broad shadcn design-system migration;
  add only the registry support required for the assistant thread.
- Do not change backend API routes, response shapes, media URLs, devasset
  polling, or selected-clip session storage.
- Do not add provider-backed streaming, EditPlan generation, vspec conversion,
  rendering, auth, uploads, embeddings, or durable conversation state.

## Decisions

### Use the current registry thread instead of legacy packages or local primitives

Use the assistant-ui CLI/shadcn registry to add the current `Thread` component
and its required support files to the webapp. Render the ready-state chat as
that local registry `Thread` inside the existing `AssistantRuntimeProvider`.
Do not add `@assistant-ui/react-ui`; it is a legacy package and not the
supported path for new styled assistant-ui surfaces.

This deletes local ownership of:

- `LocalComposer`
- `ChatMessage`
- `MessageTextPart`
- generic message labels and containers
- generic text/running part rendering
- manual text/data message-part switching

The alternative is to continue with `@assistant-ui/react` primitives and trim
the custom code. That keeps the dependency graph smaller, but it still leaves
the repo responsible for chat layout and state behavior. The user's desired
direction is minimum product code, so the registry thread is the better
supported trade-off.

The registry model copies component source into the repository. Treat that
source as upstream UI: keep it isolated under the assistant-ui component area,
avoid VideoAI-specific edits inside it, and integrate product behavior through
documented assistant-ui extension points.

### Register clip candidates as assistant data UI

Mount a small registration component under `AssistantRuntimeProvider` that calls
assistant-ui's data UI registration for `clip-candidates`. The registered
renderer receives the data part and renders VideoAI's clip cards.

This keeps the custom branch aligned with the product boundary:

```text
assistant-ui Thread
  text, composer, message layout, loading, scrolling
      |
      v
registered data UI: "clip-candidates"
  VideoAI clip cards, video preview, select/deselect
```

Using global data UI registration is preferred over overriding the entire
assistant message component because it lets the registry thread continue to own
ordinary assistant content and action surfaces.

### Keep selected clips outside the assistant message body

Keep a small selected-clips review component beside or near the prebuilt thread.
It remains product-specific because it represents the cross-search working set
for later EditPlan generation. It should not duplicate assistant message UI or
grow into a dashboard.

The review component may keep native buttons and thumbnails. Its state should
continue using the existing session storage key and selected-clip parser so
existing browser-session selections remain compatible.

### Let assistant messages surface chat request failures

Remove the bespoke ready-state chat notice banner unless implementation testing
shows a clear gap. The local adapter already returns assistant text plus empty
clip candidates for API and devasset-not-ready failures. In a minimal UI, those
recoverable failures should appear in the assistant thread rather than in a
second app-specific notification surface.

Setup and hard setup-error states remain outside the thread because the chat
composer must not be available until devassets are ready.

### Keep registry adoption narrow and explicit

Add only the assistant-ui registry component(s) needed for the single-thread
ready-state chat, plus the shadcn/Tailwind support the registry requires. Keep
configuration focused on compiling and styling those generated components; do
not introduce unrelated shadcn components or convert existing VideoAI UI into a
broader component-system migration.

The registry thread includes additional UI affordances such as action bars,
icons, and markdown handling. Accept those as part of using the out-of-box
thread, but do not add VideoAI-specific behavior to them during this change.

## Risks / Trade-offs

- Added local generated UI source and support dependencies -> Keep generated
  assistant-ui components isolated, pin package versions, run webapp
  install/check/test/build, and record the decision in ADR 0008.
- Prebuilt thread may show generic affordances not needed by the prototype ->
  Disable or configure obvious optional features where the registry supports it;
  otherwise accept generic chat affordances as the cost of minimal local code.
- Tailwind/shadcn styling may conflict with local styles -> Scope local CSS to
  the app shell and clip components, keep registry styles/configuration narrow,
  and avoid overriding registry internals unless required for layout.
- Data UI registration could silently fail if mounted outside the runtime
  provider -> Keep the registration component next to `Thread` inside
  `AssistantRuntimeProvider` and add rendering coverage for clip candidates.
- Removing the chat notice banner could reduce visibility for recoverable
  request errors -> Verify devasset-not-ready and API failure responses appear
  as assistant text with empty clip results.

## Migration Plan

1. Add the current assistant-ui registry `Thread` and required support
   dependencies/configuration to the webapp.
2. Replace the ready-state custom thread composition with the registry `Thread`.
3. Add a `clip-candidates` data UI registration component and keep clip-card
   rendering behind that boundary.
4. Remove local composer, message, text-part, notice-banner, and generic thread
   CSS that are replaced by the package.
5. Keep setup/error gating and selected-clip session state in local code.
6. Update tests to cover ready-state rendering, clip data rendering through the
   assistant data UI path, selected-clip compatibility, and recoverable error
   assistant text.
7. Add ADR 0008 for the prebuilt assistant-ui thread decision.

Rollback is removing the generated assistant-ui registry thread and support
configuration, restoring the current primitive-based thread components and CSS,
and leaving backend contracts unchanged.
