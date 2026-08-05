## 1. API Chat Contract

- [x] 1.1 Define TypeScript request and response contracts for the Phase 3 no-key chat endpoint.
- [x] 1.2 Add validation for non-empty user chat text and optional clip result limit.
- [x] 1.3 Implement a chat service that calls the existing `ClipSearchService` with the validated user text.
- [x] 1.4 Shape successful chat responses as assistant text plus structured clip-candidates data.
- [x] 1.5 Preserve devassets-not-ready behavior from clip search and expose it through the chat endpoint.
- [x] 1.6 Register the chat route in the Fastify app without adding model-provider dependencies or environment variables.

## 2. Constrained Media Serving

- [x] 2.1 Add a shared media-reference mapper from generated `var/thumbnails/...` and `var/devassets/...` references to browser URLs.
- [x] 2.2 Add route-safe path resolution for media URL suffixes under configured thumbnail and devasset roots.
- [x] 2.3 Reject absolute paths, empty segments, `.`, `..`, unsupported prefixes, and paths outside configured roots.
- [x] 2.4 Restrict thumbnail serving to supported generated image formats.
- [x] 2.5 Restrict devasset preview serving to supported generated video source formats.
- [x] 2.6 Ensure transcript JSON, SRT, audio extraction, seed status, and library metadata files are not exposed through media routes.
- [x] 2.7 Support browser video preview requests, including valid byte-range requests when present.
- [x] 2.8 Return not-found responses for missing generated media without affecting health checks or clip search.

## 3. Assistant UI Foundation

- [x] 3.1 Add the `assistant-ui` webapp dependency needed for a local/custom runtime.
- [x] 3.2 Replace the ready-state shell with a production-facing chat layout while preserving setup and setup-error screens.
- [x] 3.3 Implement a local/custom assistant runtime adapter that sends user text to the Phase 3 chat endpoint.
- [x] 3.4 Render assistant text responses through the assistant-ui thread.
- [x] 3.5 Render structured clip-candidates data through a custom assistant content renderer instead of Markdown.
- [x] 3.6 Keep the UI copy honest that Phase 3 is searching local clips, not generating an edit plan yet.

## 4. Clip Cards And Selection State

- [x] 4.1 Add webapp TypeScript types for chat responses, clip candidates, media URLs, and selected clips.
- [x] 4.2 Build clip cards that show title, snippet when present, start/end timing, ranking signal, thumbnail, preview control, and selection control.
- [x] 4.3 Ensure fallback clips with empty snippets render without fabricated transcript text.
- [x] 4.4 Implement browser-session selected clip state keyed by deterministic clip id.
- [x] 4.5 Add select and deselect behavior from both clip cards and the selected-clips area.
- [x] 4.6 Prevent duplicate selected clips when the same clip appears in multiple assistant responses.
- [x] 4.7 Keep selected clips visible outside or alongside the chat thread on desktop and mobile layouts.

## 5. Error And Empty States

- [x] 5.1 Prevent empty or whitespace-only chat submissions in the webapp.
- [x] 5.2 Show a no-results assistant response when a valid search returns no clip candidates.
- [x] 5.3 Show recoverable chat error UI when the API is unavailable or returns an unexpected error.
- [x] 5.4 Show current devasset state and message if a chat request receives a devassets-not-ready response.
- [x] 5.5 Keep previously selected clips visible after a failed chat request.

## 6. Tests

- [x] 6.1 Add API tests for chat request validation and successful search-backed assistant responses.
- [x] 6.2 Add API tests proving the chat endpoint does not require PostgreSQL or model-provider credentials.
- [x] 6.3 Add API tests for devassets-not-ready chat responses.
- [x] 6.4 Add API tests for media URL derivation from generated references.
- [x] 6.5 Add API tests for media route root validation, path traversal rejection, unsupported artifact rejection, missing media, and byte-range behavior.
- [x] 6.6 Add webapp tests for setup gating and rendering the assistant chat once devassets are ready.
- [x] 6.7 Add webapp tests for clip-card rendering, fallback empty snippets, selection, deselection, duplicate prevention, and selected-clips visibility.
- [x] 6.8 Add webapp tests for empty prompt prevention, no-results responses, API errors, and devassets-not-ready chat responses.

## 7. Documentation And Verification

- [x] 7.1 Update `README.md` with the Phase 3 no-key chat flow and local usage notes.
- [x] 7.2 Document the chat endpoint response shape and structured clip-candidates part.
- [x] 7.3 Document the constrained media URL routes and the difference between trusted generated references and browser URLs.
- [x] 7.4 Run API tests with `pnpm --filter @videoai/api test`.
- [x] 7.5 Run webapp checks and tests with the appropriate `pnpm --filter @videoai/webapp ...` commands.
- [x] 7.6 Run workspace checks with `pnpm check`.
- [x] 7.7 Verify generated devassets exist by running the seed workflow or reusing existing `var/devassets/library.json`.
- [x] 7.8 Start the local stack with `podman compose up --build` and verify webapp, API, and render health endpoints still respond.
- [x] 7.9 Verify through `http://videoai.localhost:8080` that a user can submit a creative chat request, see selectable clip cards with media, select and deselect clips, and keep selected clips visible.
- [x] 7.10 Run `openspec status --change phase-3-assistant-ui-clip-results` and confirm the change is apply-ready.
