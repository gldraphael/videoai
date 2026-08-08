## Purpose

Keeps the conversational assistant thread focused on text while presenting
video-related outputs in a separate workspace where users can review, include,
and clear thumbnail-based clip candidates across multiple chat requests.

## ADDED Requirements

### Requirement: Chat thread renders conversational text only
The ready-state chat experience SHALL keep user and assistant message content
limited to conversational text in the chat thread.

#### Scenario: Clip search returns matching candidates
- **WHEN** a user submits a valid chat request that returns assistant text and
  structured clip candidate data
- **THEN** the chat thread displays the user text and assistant text
- **AND** the chat thread does not display clip cards, video players,
  thumbnails, or other asset output UI inside the message flow

#### Scenario: Clip search returns no candidates
- **WHEN** a user submits a valid chat request that returns no clip candidates
- **THEN** the chat thread displays the explanatory assistant text
- **AND** no empty media card or asset placeholder is inserted into the chat
  thread

### Requirement: Output pane displays clip candidate outputs
The ready-state chat experience SHALL display structured clip candidate outputs
in an output pane outside the chat message body.

#### Scenario: Matching candidates are returned
- **WHEN** a user submits a valid chat request that returns one or more clip
  candidates
- **THEN** the output pane displays those candidates as a result group
  associated with the submitted request
- **AND** each candidate displays its title, timing, ranking signal or score,
  transcript snippet when present, and thumbnail or fallback thumbnail state
- **AND** the output pane does not require video playback to evaluate or select
  the candidate

#### Scenario: Multiple requests return candidates
- **WHEN** multiple chat requests return clip candidates during the same ready
  session
- **THEN** the output pane keeps the resulting groups visible until the user
  removes them or the session state is reset
- **AND** each group remains distinguishable by its request text or equivalent
  label

#### Scenario: Candidate lacks a thumbnail
- **WHEN** a returned clip candidate does not include a browser-fetchable
  thumbnail URL
- **THEN** the output pane still displays the candidate with title, timing,
  ranking signal or score, and selection controls
- **AND** the UI does not attempt to play source video as a fallback

### Requirement: Users can include output clips as chat context
The ready-state chat experience SHALL let users choose which output clips are
presented as included context while composing subsequent chat requests.

#### Scenario: User includes a clip
- **WHEN** the user marks an output clip for inclusion
- **THEN** the clip appears in an included-context area associated with the
  composer or output pane
- **AND** the included item preserves the clip id, asset id, title, timing,
  ranking signal or score, and media references returned by the API

#### Scenario: User excludes an included clip
- **WHEN** the user removes a clip from included context
- **THEN** that clip is no longer presented as included context for subsequent
  chat requests
- **AND** the original output item may remain visible in the output pane if it
  has not been removed from outputs

#### Scenario: Included clip appears in later output
- **WHEN** a clip already included as chat context appears in a later output
  group
- **THEN** the matching output item shows that it is included
- **AND** including it again does not create a duplicate included item

#### Scenario: Existing selected clips are restored
- **WHEN** the ready-state experience loads with valid selected clips from the
  previous browser-session storage format
- **THEN** those clips are restored as included context
- **AND** the restored clips do not need to appear in an output group unless
  they are returned by a later chat request

### Requirement: Users can remove output pane items
The ready-state chat experience SHALL let users remove clip outputs from the
output pane without changing past chat messages.

#### Scenario: User removes one output clip
- **WHEN** the user removes an individual clip from an output group
- **THEN** that clip is removed from the output pane
- **AND** existing chat messages remain unchanged

#### Scenario: User removes an output group
- **WHEN** the user removes a result group from the output pane
- **THEN** all clips in that group are removed from the output pane
- **AND** existing chat messages remain unchanged

#### Scenario: User removes an included output clip
- **WHEN** the user removes an output clip that is also included as chat context
- **THEN** the clip is removed from the output pane
- **AND** the UI makes the included-context state consistent by either removing
  that clip from included context or clearly showing it as included from prior
  context

### Requirement: Layout remains usable across viewport sizes
The ready-state chat experience SHALL preserve access to both chat input and
output management controls across supported viewport sizes.

#### Scenario: Wide viewport
- **WHEN** the ready-state experience is displayed on a wide viewport
- **THEN** the chat thread and composer appear in the primary pane
- **AND** the output workspace appears beside the chat as a separate pane

#### Scenario: Narrow viewport
- **WHEN** the ready-state experience is displayed on a narrow viewport
- **THEN** the user can still read chat text, submit new chat text, inspect
  output clips, include or exclude clips, and remove output items
- **AND** controls do not overlap or require horizontal page scrolling

### Requirement: Layout change preserves local prototype boundaries
The output-pane workflow SHALL preserve the existing local no-key prototype
contracts and defer video rendering concerns.

#### Scenario: No model-provider key is configured
- **WHEN** devassets are ready and the user submits a valid clip request
- **THEN** the app can still return local clip-search-backed assistant text and
  clip outputs without OpenAI, Gemini, or other model-provider credentials

#### Scenario: Clip output is displayed before vspec support
- **WHEN** a returned clip candidate is displayed in the output pane
- **THEN** the output pane uses a thumbnail or non-playing fallback for the
  candidate
- **AND** it does not require EditPlan generation, `vspec` generation, render
  submission, or video playback

#### Scenario: API response includes structured clip candidate data
- **WHEN** `/api/chat` returns assistant text plus structured clip candidate
  data
- **THEN** the webapp uses that data to update the output pane
- **AND** the app does not require a new backend route or response shape for
  this layout change
