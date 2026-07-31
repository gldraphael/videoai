# Development Assets

`devassets/catalog.yaml` is the tracked source manifest for sample media used by
the prototype. The seed service will use the catalog to prepare local media and
derived artifacts for the rest of the app.

The catalog schema is intentionally small and URL-only:

```yaml
version: 1

assets:
  - id: sintel-trailer
    title: Sintel Trailer
    type: video
    source:
      url: https://media.w3.org/2010/05/sintel/trailer.mp4
```

Validation rules:

- `version` must be `1`.
- `assets` must contain at least one asset.
- `id` must be a unique lowercase slug using letters, numbers, and hyphens.
- `title` must be a non-empty string.
- `type` must be `video`.
- `source.url` must be an absolute `http` or `https` URL. Local file paths are
  not supported in this phase.
- Extra top-level, asset, or source fields are rejected so the authoring
  contract stays predictable.

The seed identity hash is deterministic and uses only each asset's `id` and
`source.url`, canonicalized by asset id and URL. Changing a title updates
generated library metadata but does not force media download, thumbnail, audio,
or transcript regeneration. Changing an `id` or URL creates a new asset
identity and regenerates outputs for that identity.

Generated files do not belong in this directory. The seed and render flows
write runtime data under gitignored paths:

- `var/devassets/` for seed status, source media, audio, transcripts, and
  `library.json`
- `var/thumbnails/` for generated poster frames and thumbnails
- `var/renders/` for generated `vspec` files and rendered videos
