# Runtime Data

This directory is for local generated files. The contents of these paths are
gitignored:

- `var/devassets/`
- `var/renders/`
- `var/thumbnails/`

The directories are created by local commands or Podman bind mounts as needed.

The devasset seed service writes this runtime layout:

```text
var/devassets/
  library.json
  .seed/
    status.json
  assets/
    <asset-id>/
      <asset-identity>/
        source.<ext>
        audio.wav
        transcript.srt

var/thumbnails/
  <asset-id>-<asset-identity>.jpg
```

`var/devassets/.seed/status.json` is the setup status consumed by the API. It
uses `state: "running"`, `"ready"`, or `"error"` and includes a human-readable
message. The API returns `state: "missing"` when status or required library
files do not exist.

`var/devassets/library.json` is the compact media-library index. Each asset
includes catalog metadata, source URL and generated source path, ffprobe media
metadata, a thumbnail reference, an audio reference, and a transcript reference.
Transcript payloads are stored in `transcript.srt`; they are not embedded in
`library.json`.

To force regeneration, run the seed command with `--force`. To manually clean
all generated devasset output, delete `var/devassets/` and `var/thumbnails/`
and run the seed service again.
