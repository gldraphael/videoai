# Development Assets

`devassets/catalog.yaml` is the tracked source manifest for sample media used by
the local prototype. The root README is the primary place for catalog fields,
validation rules, and first-run configuration:

- [`../README.md#configuration`](../README.md#configuration)

This directory should stay small and source-only. Generated files do not belong
under `devassets/`; the seed and render flows write runtime data under
gitignored paths:

- `var/devassets/` for seed status, source media, audio, transcripts, and
  `library.json`
- `var/thumbnails/` for generated poster frames and thumbnails
- `var/renders/` for generated `vspec` files and rendered videos

The seed identity hash is deterministic and uses only each asset's `id` and
`source.url`, canonicalized by asset id and URL. Changing a title updates
generated library metadata but does not force media download, thumbnail, audio,
or transcript regeneration. Changing an `id` or URL creates a new asset identity
and regenerates outputs for that identity.

To rerun only the devasset seed service through compose:

```bash
podman compose run --rm seed pnpm --filter @videoai/seed seed:devassets devassets/catalog.yaml
```

Use `--force` to regenerate current media artifacts even when the catalog
identity is unchanged. To manually clean all generated devasset output, delete
`var/devassets/` and `var/thumbnails/` and run the seed service again.
