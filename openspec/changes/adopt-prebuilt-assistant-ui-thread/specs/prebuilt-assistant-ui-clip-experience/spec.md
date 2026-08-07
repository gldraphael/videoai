## Purpose

Keeps the ready-state webapp experience centered on an out-of-the-box assistant
chat surface while making clip evaluation and selection the only custom product
UI the browser owns.

## ADDED Requirements

### Requirement: Ready state uses a standard assistant chat surface
The webapp SHALL present devasset-ready users with a standard assistant chat
thread as the primary interaction, without bespoke workspace chrome or
repo-owned chat controls competing with the assistant experience.

#### Scenario: Devassets are ready
- **WHEN** the webapp receives a ready devasset status from the API
- **THEN** the app displays a chat thread with message history, empty state, and
  composer as the primary surface
- **AND** it does not display a separate workspace header, service summary, or
  custom chat form as the primary ready-state interaction

#### Scenario: User submits a local clip request
- **WHEN** the user enters a non-empty creative clip request in the composer
- **THEN** the app sends the request through the existing local chat path
- **AND** the user and assistant messages appear in the same assistant thread

### Requirement: Custom frontend UI is limited to video clip workflow
The webapp SHALL limit custom ready-state product UI to clip candidates,
preview media, selection controls, and selected-clip review.

#### Scenario: Assistant returns ordinary text
- **WHEN** an assistant response contains ordinary text
- **THEN** the text is shown as part of the standard assistant message flow
- **AND** the webapp does not render that text through a custom VideoAI message
  component

#### Scenario: Assistant returns clip candidates
- **WHEN** an assistant response contains structured clip candidates
- **THEN** each candidate is rendered with title, timing, ranking signal or
  score, transcript snippet when present, media preview, and select or deselect
  control
- **AND** this clip rendering is the custom UI inside the assistant message

#### Scenario: Candidate includes preview media
- **WHEN** a clip candidate includes a browser-fetchable preview URL
- **THEN** the user can play the preview from the candidate UI
- **AND** the preview uses the candidate's clip timing when the browser supports
  media fragment playback

#### Scenario: Candidate lacks preview media
- **WHEN** a clip candidate has no playable preview URL
- **THEN** the candidate remains selectable using its available metadata and
  thumbnail or fallback media state

### Requirement: Selected clips remain visible outside message content
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

### Requirement: Local prototype contracts remain unchanged
The webapp SHALL preserve the no-key local chat, media URL, setup gating, and
selected-clip storage contracts already used by the Phase 3 prototype.

#### Scenario: No model-provider key is configured
- **WHEN** devassets are ready and the user submits a valid request
- **THEN** the app can return local clip-search-backed assistant results without
  OpenAI, Gemini, or another model-provider credential

#### Scenario: Devassets are not ready
- **WHEN** the webapp receives a missing or running devasset status
- **THEN** the app displays setup status instead of the chat composer

#### Scenario: Devassets are in error
- **WHEN** the webapp receives an error devasset status
- **THEN** the app displays the error message instead of the chat composer

#### Scenario: Existing selected clips are in session storage
- **WHEN** the ready-state experience loads with valid selected clips in browser
  session storage
- **THEN** the selected-clips review area restores those clips
- **AND** the stored selected-clip data format remains compatible

#### Scenario: Existing media URLs are returned
- **WHEN** the API returns thumbnail and preview URLs for clip candidates
- **THEN** the webapp uses those URLs directly for candidate media
- **AND** no new API route or media response shape is required
