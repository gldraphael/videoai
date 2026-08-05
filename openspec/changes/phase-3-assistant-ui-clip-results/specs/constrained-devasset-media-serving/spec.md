## ADDED Requirements

### Requirement: API exposes browser-fetchable media URLs
The API SHALL provide browser-fetchable URLs for generated thumbnail and preview
media references used by clip cards.

#### Scenario: Chat response includes media URLs
- **WHEN** a chat response includes a clip candidate with generated thumbnail
  and preview references
- **THEN** the response includes browser-fetchable thumbnail and preview URL
  fields derived from those references
- **AND** the original generated references remain available for trusted
  backend validation

#### Scenario: Generated reference cannot be mapped
- **WHEN** a generated thumbnail or preview reference cannot be mapped to an
  allowed media route
- **THEN** the API omits or nulls that browser media URL
- **AND** the API does not return an arbitrary filesystem path as a URL

### Requirement: Media routes are constrained to generated roots
The API media routes SHALL resolve requested files only under the configured
`DEVASSETS_DIR` and `THUMBNAILS_DIR` roots.

#### Scenario: Valid thumbnail is requested
- **WHEN** the browser requests a thumbnail URL derived from a generated
  `var/thumbnails/...` reference
- **THEN** the API serves the corresponding file from the configured thumbnail
  root with an image content type

#### Scenario: Valid preview video is requested
- **WHEN** the browser requests a preview URL derived from a generated
  `var/devassets/...` source media reference
- **THEN** the API serves the corresponding file from the configured devasset
  root with a video content type

#### Scenario: Path traversal is requested
- **WHEN** a media URL contains an absolute path, empty path segment, `.`, `..`,
  or any suffix that resolves outside the configured root
- **THEN** the API rejects the request
- **AND** no file outside the configured generated roots is read

### Requirement: Media routes expose only supported preview artifacts
The API media routes SHALL serve only the generated file types needed for Phase
3 thumbnail display and video preview playback.

#### Scenario: Unsupported generated artifact is requested
- **WHEN** the browser requests a transcript JSON file, SRT file, seed status
  file, library metadata file, audio extraction artifact, or unsupported file
  extension through a media route
- **THEN** the API rejects the request
- **AND** the response does not expose the file contents

#### Scenario: Missing generated media is requested
- **WHEN** a media URL points to an allowed generated media path that does not
  exist on disk
- **THEN** the API returns a not-found response
- **AND** the API does not fail health checks or clip search because of that
  missing media request

### Requirement: Preview routes support browser video playback
The API SHALL support browser video preview requests for generated source media.

#### Scenario: Browser requests a byte range
- **WHEN** the browser requests a valid byte range for a generated preview video
- **THEN** the API returns a partial-content response for that byte range
- **AND** the response includes headers needed by browser video controls

#### Scenario: Browser requests the full preview file
- **WHEN** the browser requests a generated preview video without a byte range
- **THEN** the API returns the video content with the correct content type
- **AND** the response remains constrained to the configured devasset root
