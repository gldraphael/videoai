## Purpose

Keeps the VideoAI clip-search chat experience close to a standard assistant
chat surface while preserving the prototype-specific clip evaluation and
selection workflow.

## ADDED Requirements

### Requirement: Ready state presents a minimal assistant chat surface
The webapp SHALL make the chat thread and composer the primary ready-state
experience without surrounding them with bespoke product chrome that competes
with the assistant interaction.

#### Scenario: Devassets are ready
- **WHEN** the webapp receives a ready devasset status from the API
- **THEN** the app displays a chat thread, message area, empty state, and
  composer as the main interaction
- **AND** setup, service-check, or large workspace-summary content is not shown
  as the primary ready-state experience

#### Scenario: User submits a local clip request
- **WHEN** the user enters a non-empty creative clip request in the composer
- **THEN** the app sends the request through the existing local chat path
- **AND** the resulting user and assistant messages appear in the same chat
  thread

### Requirement: Clip-specific UI remains limited to clip evaluation
The webapp SHALL keep custom UI for clip-candidate evaluation only where the
standard assistant message surface cannot represent the required video workflow.

#### Scenario: Clip candidates are returned
- **WHEN** an assistant response contains structured clip candidates
- **THEN** each candidate is rendered with title, timing, ranking signal or
  score, transcript snippet when present, media preview, and select or deselect
  control
- **AND** the response text remains part of the normal assistant message flow

#### Scenario: Candidate includes preview media
- **WHEN** a clip candidate includes a browser-fetchable preview URL
- **THEN** the user can play the preview from the candidate UI
- **AND** the preview starts and ends at the candidate's clip timing when the
  browser supports media fragment playback

#### Scenario: Candidate lacks preview media
- **WHEN** a clip candidate has no playable preview URL
- **THEN** the candidate remains selectable using its available metadata and
  thumbnail or fallback media state

### Requirement: Selected clips remain reviewable outside the message content
The webapp SHALL keep selected clips visible outside the assistant message body
so users can review the working set across multiple searches.

#### Scenario: User selects a clip
- **WHEN** the user selects a candidate clip
- **THEN** that clip appears in a selected-clips review area
- **AND** the selected item preserves its clip id, asset id, title, timing,
  score, and media references

#### Scenario: Same clip appears again
- **WHEN** a selected clip appears in a later assistant response
- **THEN** the candidate UI shows the clip as selected
- **AND** selecting it again does not create a duplicate selected item

#### Scenario: User removes a selected clip
- **WHEN** the user removes a selected clip from either the candidate UI or the
  selected-clips review area
- **THEN** the clip is removed from the selected set
- **AND** matching candidate UI reflects the deselected state

### Requirement: Setup and error states stay functional and visually consistent
The webapp SHALL preserve setup and error gating while presenting those states
with the same restrained visual language as the ready-state chat surface.

#### Scenario: Devassets are not ready
- **WHEN** the webapp receives a missing or running devasset status
- **THEN** the app displays the setup message and progress indication
- **AND** the chat composer is not available for submitting clip requests

#### Scenario: Devassets are in error
- **WHEN** the webapp receives an error devasset status
- **THEN** the app displays the error message
- **AND** the chat composer is not available for submitting clip requests

### Requirement: Simplification preserves existing local contracts
The simplification SHALL NOT change the no-key local chat, media URL, or
selected-clip storage contracts already used by the Phase 3 prototype.

#### Scenario: No model-provider key is configured
- **WHEN** devassets are ready and the user submits a valid request
- **THEN** the app can still return local clip-search-backed assistant results
  without OpenAI, Gemini, or other model-provider credentials

#### Scenario: Existing selected clips are in session storage
- **WHEN** the ready-state experience loads with valid selected clips in browser
  session storage
- **THEN** the selected-clips review area restores those clips
- **AND** the stored selected-clip data format remains compatible

#### Scenario: Existing media URLs are returned
- **WHEN** the API returns thumbnail and preview URLs for clip candidates
- **THEN** the webapp uses those URLs directly for candidate media
- **AND** no new API route or media response shape is required
