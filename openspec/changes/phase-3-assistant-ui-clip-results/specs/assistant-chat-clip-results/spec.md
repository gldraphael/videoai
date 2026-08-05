## ADDED Requirements

### Requirement: Ready devassets show assistant chat
The webapp SHALL show an `assistant-ui` based chat experience after local
devassets are ready.

#### Scenario: Devassets are ready
- **WHEN** the webapp receives a ready devasset status from the API
- **THEN** the app displays a chat thread and composer for creative video
  requests
- **AND** the app does not display the ready-state service-check shell as the
  primary experience

#### Scenario: Devassets are not ready
- **WHEN** the webapp receives a missing, running, or error devasset status from
  the API
- **THEN** the app displays the setup or error experience instead of the chat
  experience

### Requirement: Chat works without model-provider credentials
The system SHALL let a user submit a chat request and receive a deterministic
clip-search-backed assistant response without requiring OpenAI, Gemini, or other
model-provider API keys.

#### Scenario: No model-provider key is configured
- **WHEN** devassets are ready and the user submits a non-empty creative request
- **THEN** the app sends the request to the local API
- **AND** the API returns an assistant response derived from local clip search
- **AND** the response does not require an external LLM provider call

#### Scenario: Empty request is submitted
- **WHEN** the user attempts to submit empty or whitespace-only chat text
- **THEN** the app prevents submission or shows a validation error
- **AND** the API does not run clip search for that empty request

### Requirement: Assistant response contains structured clip candidates
The assistant response SHALL separate natural-language assistant text from
structured clip candidate data.

#### Scenario: Matching clips are found
- **WHEN** the user submits a creative request that matches local clips
- **THEN** the assistant response includes short explanatory text
- **AND** the assistant response includes a structured clip-candidates part with
  the normalized query and ranked clip results

#### Scenario: No matching clips are found
- **WHEN** the user submits a valid creative request that returns no clip
  candidates
- **THEN** the assistant response explains that no matching clips were found
- **AND** the response does not fabricate clip ids, snippets, paths, or media
  URLs

### Requirement: Clip cards render candidate metadata and media
The webapp SHALL render each structured clip candidate as a selectable card with
the metadata and media needed to evaluate the candidate.

#### Scenario: Clip candidates are rendered
- **WHEN** the assistant response contains clip candidates
- **THEN** each card displays the clip title, transcript snippet when present,
  start time, end time, and score or ranking signal
- **AND** each card displays a thumbnail or preview control using
  browser-fetchable media URLs returned by the API
- **AND** each card provides a select or deselect control

#### Scenario: Fallback clip has no transcript snippet
- **WHEN** a candidate clip has an empty snippet because it came from fallback
  windowing
- **THEN** the card renders without inventing transcript text
- **AND** the card still shows title, timing, media, and selection controls

### Requirement: User can select and deselect clips
The webapp SHALL maintain browser-session selected clip state keyed by
deterministic clip id.

#### Scenario: User selects a clip
- **WHEN** the user selects a candidate clip card
- **THEN** the clip appears in a selected-clips area outside or alongside the
  chat thread
- **AND** the selected item preserves the clip id, asset id, title, timing, and
  media references returned by the API

#### Scenario: User deselects a clip
- **WHEN** the user deselects a selected clip from a card or selected-clips area
- **THEN** the clip is removed from the selected-clips area
- **AND** matching clip cards reflect the deselected state

#### Scenario: Same clip appears in multiple responses
- **WHEN** a clip that is already selected appears in a later assistant response
- **THEN** the app shows that clip as selected
- **AND** selecting it again does not create a duplicate selected item

### Requirement: Chat handles transient API states
The chat experience SHALL surface local API and devasset errors without showing
stale or fabricated clip results.

#### Scenario: API returns devassets not ready during chat
- **WHEN** a chat request receives a devassets-not-ready response from the API
- **THEN** the assistant response or surrounding UI shows the current devasset
  state and message
- **AND** no stale clip candidates are shown for that request

#### Scenario: API request fails
- **WHEN** a chat request fails because the API is unavailable or returns an
  unexpected error
- **THEN** the UI shows a recoverable error state
- **AND** previously selected clips remain visible in the selected-clips area
