## Context

See `proposal.md` for motivation. The current Phase 3 webapp already uses
`@assistant-ui/react` for runtime, thread, and composer primitives, and the API
already returns assistant text plus structured `clip-candidates` data. Most of
the complexity to remove is in the ready-state shell, manual message rendering,
composer styling, and loading/setup visual treatment.

The installed assistant-ui package provides primitives and documents a copied
thread component approach. Pulling in the full registry thread would likely add
more code and dependencies than this prototype needs because the current app
does not use Tailwind, shadcn, attachment UI, action bars, markdown rendering,
voice input, or model-driven tool UI.

## Goals / Non-Goals

**Goals:**

- Make the existing thread composition resemble assistant-ui's standard thread
  anatomy with minimal local structure.
- Keep VideoAI-specific UI isolated to clip-candidate cards, preview playback,
  selection controls, and the selected-clips review area.
- Reduce CSS to basic page layout, assistant-style chat framing, clip-card
  media layout, selected-clips review, and setup/error states.
- Preserve current API contracts, selected-clip session storage, no-key runtime
  behavior, and tests for the Phase 3 workflow.

**Non-Goals:**

- Do not import the assistant-ui registry thread component or add shadcn,
  Tailwind, lucide icons, markdown rendering, attachment UI, voice input, or
  action bars as part of this simplification.
- Do not change `/api/chat`, media routes, devasset status polling, clip result
  shapes, or selected-clip serialization.
- Do not introduce EditPlan generation, vspec conversion, render submission, or
  provider-backed streaming.

## Decisions

### Use assistant-ui primitives in the documented thread shape

Keep `AssistantRuntimeProvider`, `ThreadPrimitive.Root`,
`ThreadPrimitive.Viewport`, `ThreadPrimitive.Messages`,
`ThreadPrimitive.ViewportFooter`, and `ComposerPrimitive` as the chat skeleton.
The ready-state page should stop presenting a separate large workspace header
and instead let the assistant thread own the screen.

The alternative is to install or copy the assistant-ui registry thread
component. That would provide a polished default, but it brings a larger styling
stack and feature surface that are not used by this prototype. Staying with
primitives keeps the local app small while still aligning the structure with
assistant-ui.

### Let assistant-ui render normal message parts

Replace manual text/data iteration for ordinary message rendering with
assistant-ui message primitives where practical. Text and running assistant
states should flow through the library's message-part rendering instead of a
bespoke `ChatMessage` loop.

The custom branch should be only the named `clip-candidates` data part. This can
be implemented by using assistant-ui data-part rendering support or by keeping a
thin inline data renderer inside the message primitive path. The important
boundary is that text rendering and message containers are not reimplemented
just to host clip cards.

### Keep clip cards as the intentional custom surface

Clip candidates need product-specific behavior: preview playback, thumbnail
fallbacks, timing, ranking signals, select/deselect state, and selected-state
sync across later responses. That custom UI should remain, but its styling
should be compact and neutral so it reads as assistant response content rather
than a separate dashboard.

The cards should continue to use existing preview URLs with media fragments,
native browser video controls, and existing select/deselect helpers. Avoid
adding a custom video player or timeline control in this change.

### Restyle setup as a chat-adjacent waiting state

Keep the current polling and error gating logic. Simplify the setup and error
screens so they share the same centered, restrained visual treatment as the
empty chat state. This preserves the local-dev guidance without making the
loading screen define a separate visual system.

### Keep selected clips outside message content

The selected-clips review area remains outside the assistant message body so it
can represent the user's cross-search working set. It can be a narrow aside on
wide screens and a compact section above or below the thread on small screens.
This should stay simpler than the current custom rail but remain visible enough
for later EditPlan submission work.

## Risks / Trade-offs

- The app may look less branded or distinctive -> Accept this for the prototype;
  the goal is to validate the workflow and keep assistant-ui integration simple.
- Assistant-ui's full registry component may diverge from our primitive-only
  structure -> Keep the local component anatomy close to the documented
  primitive structure so migration remains straightforward later.
- Reducing CSS too aggressively could make clip cards harder to scan -> Keep
  stable media dimensions, readable metadata hierarchy, and clear selected
  states as the minimum product-specific styling.
- Removing manual message rendering could accidentally hide structured data
  parts -> Cover clip-candidate rendering with tests or updated render
  assertions.

## Migration Plan

1. Refactor the ready-state chat component without changing chat adapter or API
   calls.
2. Replace manual message rendering with assistant-ui message primitives plus a
   focused clip-candidates renderer.
3. Simplify CSS in place, preserving responsive behavior and media dimensions.
4. Restyle setup/error screens using the same reduced visual system.
5. Update or add webapp tests for ready-state chat rendering, clip media URLs,
   selection persistence, and setup/error gating.

Rollback is reverting the webapp component/CSS changes. No data migration,
backend rollback, or generated asset migration is required.
