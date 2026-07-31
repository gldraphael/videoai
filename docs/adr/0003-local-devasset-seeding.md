# ADR 0003: Local Devasset Seeding

## Status

Proposed.

## Context

The prototype needs a rich local media library before chat, clip search, edit
planning, and rendering can be useful. The current `tools/seed` package is only
a placeholder, and `devassets/catalog.yaml` does not yet produce media,
thumbnails, transcripts, or an application-readable library.

Earlier architecture notes described seeding searchable records into
PostgreSQL. For the local prototype, that introduces unnecessary coupling:
developers should be able to generate local media artifacts as a one-time setup
step without requiring database writes as part of media preparation.

The local app also needs to handle first startup gracefully. If seeding runs as
part of `podman compose up --build`, the webapp should be able to show a setup
state while generated media is being prepared, and then switch to the normal
experience once the media library is ready.

## Decision

Use a generated JSON media library as the local devasset contract.

The tracked catalog remains intentionally small and URL-only:

```yaml
version: 1

assets:
  - id: launch-interview
    title: Launch Interview
    type: video
    source:
      url: https://example.com/media/launch-interview.mp4
```

The seed service will read `devassets/catalog.yaml`, download source videos,
probe media with ffprobe, create thumbnails with FFmpeg, extract normalized
audio, generate timestamped transcript files with `whisper.cpp`, and write a
compact `var/devassets/library.json` that references generated artifacts.

The seed implementation should stay lean. TypeScript is acceptable because the
repository already has a seed package, but Bash or another small
container-local script is also acceptable if it keeps the workflow easier to
maintain.

Generated runtime files will live under gitignored paths:

```text
var/devassets/
  library.json
  .seed/
    status.json
  assets/
    launch-interview/
      <asset-identity>/
        source.mp4
        audio.wav
        transcript.srt

var/thumbnails/
  launch-interview-<asset-identity>.jpg
```

`library.json` will reference transcript files instead of embedding full
transcript payloads:

```json
{
  "version": 1,
  "catalogIdentity": "sha256:...",
  "assets": [
    {
      "id": "launch-interview",
      "title": "Launch Interview",
      "type": "video",
      "sourceIdentity": "sha256:...",
      "source": {
        "url": "https://example.com/media/launch-interview.mp4",
        "path": "var/devassets/assets/launch-interview/<asset-identity>/source.mp4"
      },
      "audio": {
        "path": "var/devassets/assets/launch-interview/<asset-identity>/audio.wav",
        "format": "wav"
      },
      "thumbnail": {
        "path": "var/thumbnails/launch-interview-<asset-identity>.jpg",
        "format": "jpeg"
      },
      "transcript": {
        "format": "srt",
        "path": "var/devassets/assets/launch-interview/<asset-identity>/transcript.srt",
        "generator": "whisper.cpp"
      }
    }
  ]
}
```

Add a dedicated `Containerfile.seed` for the seed service. The image will
include the minimal runtime needed by the chosen script, FFmpeg/ffprobe,
`whisper.cpp`, `whisper-cli`, and a default Whisper model so the default local
workflow does not require host-level media or transcription setup.

Keep `seed` in `compose.yaml` as a first-class service. It should run during
local compose startup and exit successfully once setup is complete or skipped.
The webapp should not talk to the seed process directly. Instead, seed writes
progress to `var/devassets/.seed/status.json`, the API exposes that state
through a readiness endpoint, and the webapp polls the API to decide whether to
show "Setting things up", the normal app, or a setup error.

Seed idempotency is based on a deterministic catalog identity hash computed only
from each asset's `id` and `source.url`. Existing downloaded files and generated
artifacts for the current identity are reused. Consecutive runs are no-ops when
the identity hash matches and required outputs still exist. If an asset's `id`
or URL changes, the seed process treats that asset identity as changed and
regenerates the affected outputs.

The seed process should write output atomically, using temporary files and
renames for status and library writes so the API never serves a partial
`library.json`.

PostgreSQL import is explicitly deferred. A future change can read
`library.json` and import it into PostgreSQL full-text tables if that becomes
useful for retrieval.

## Consequences

Developers get a simple local workflow:

```bash
podman compose up --build
```

On first run, seed prepares the media library while the webapp shows setup
progress. On later runs, seed exits quickly when the catalog identity and
generated outputs are unchanged.

The local media library becomes inspectable and disposable. Developers can
remove `var/devassets/` and `var/thumbnails/` to regenerate everything without
touching tracked source files.

The seed image will be larger because it includes FFmpeg, `whisper.cpp`, and a
default model. Keeping this toolchain in `Containerfile.seed` prevents the API
image from inheriting transcription dependencies.

The seed identity hash deliberately ignores title, type, and remote file
content. Updating titles can refresh library metadata without forcing media
regeneration. If remote media changes at the same URL, the seed process will
not detect that by default; developers can use `--force`, delete generated
outputs, or change the asset URL/id to regenerate.
  
