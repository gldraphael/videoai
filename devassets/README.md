# Development Assets

`devassets/catalog.yaml` is the tracked source manifest for sample media used by
the prototype. The seed service will use the catalog to prepare local media and
derived artifacts for the rest of the app.

Generated files do not belong in this directory. The seed and render flows
write runtime data under gitignored paths:

- `var/devassets/` for prepared, copied, or downloaded sample media
- `var/thumbnails/` for generated poster frames and thumbnails
- `var/renders/` for generated `vspec` files and rendered videos

The skeleton includes only placeholder catalog entries. Real seeding behavior is
implemented by a later OpenSpec change.
