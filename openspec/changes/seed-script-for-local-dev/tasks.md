## 1. Contracts And Catalog

- [x] 1.1 Define the lightweight validation contract for `version: 1` URL-only devasset catalogs.
- [x] 1.2 Update `devassets/catalog.yaml` to use the agreed core schema with real video URL entries.
- [x] 1.3 Define generated JSON contracts for seed status, media library, media metadata, thumbnails, and transcript references.
- [x] 1.4 Add deterministic catalog identity hashing based only on asset `id` and `source.url` values.
- [x] 1.5 Document the generated file layout under `var/devassets/` and `var/thumbnails/`.

## 2. Seed Container And Compose

- [x] 2.1 Add `Containerfile.seed` with the chosen lightweight script runtime, FFmpeg, ffprobe, `whisper.cpp`, `whisper-cli`, and a default Whisper model.
- [x] 2.2 Update `compose.yaml` so `seed` builds from `Containerfile.seed` and runs as a normal service without a tools-only profile.
- [x] 2.3 Ensure seed, API, and webapp share the generated runtime paths needed for status and library readiness.
- [x] 2.4 Keep API and render images from inheriting seed-only transcription dependencies.

## 3. Seed CLI Pipeline

- [x] 3.1 Replace the seed placeholder with a minimal CLI/script entrypoint for catalog path and regeneration options such as `--force`.
- [x] 3.2 Implement catalog loading and validation with clear failure messages.
- [x] 3.3 Implement atomic seed status writes for missing, running, ready, and error states.
- [x] 3.4 Implement URL download handling that reuses the current identity's existing source file and avoids unnecessary downloads.
- [x] 3.5 Implement no-op detection when the catalog identity matches and all required generated outputs exist.
- [x] 3.6 Implement ffprobe metadata extraction for downloaded video assets.
- [x] 3.7 Implement FFmpeg audio extraction for transcription.
- [x] 3.8 Implement FFmpeg poster/thumbnail generation under `var/thumbnails/`.
- [x] 3.9 Implement `whisper-cli` transcript generation to timestamped transcript files.
- [x] 3.10 Implement `var/devassets/library.json` generation with transcript file references instead of embedded transcript payloads.
- [x] 3.11 Ensure status and library writes are atomic so API readers never observe partial JSON.

## 4. API Readiness Surface

- [x] 4.1 Add API configuration for devasset status and library paths.
- [x] 4.2 Add a devasset status reader that handles missing, running, ready, and error states.
- [x] 4.3 Add an API endpoint that exposes devasset readiness and setup messages to the webapp.
- [x] 4.4 Add focused API tests or smoke checks for missing, ready, and error status responses.

## 5. Webapp Setup Experience

- [x] 5.1 Add webapp API polling for devasset readiness.
- [x] 5.2 Show a "Setting things up" experience while devassets are missing or running.
- [x] 5.3 Show the normal app shell when devassets are ready.
- [x] 5.4 Show a setup error state when the API reports seed failure.
- [x] 5.5 Verify setup, ready, and error states fit cleanly at desktop and mobile widths.

## 6. Documentation

- [x] 6.1 Update `README.md` with the first-run compose workflow and expected seed behavior.
- [x] 6.2 Update `devassets/README.md` with the URL-only catalog schema and cache identity rules.
- [x] 6.3 Update `var/README.md` with generated library, status, media, thumbnail, and transcript paths.
- [x] 6.4 Document how to force regeneration and how to manually clean generated outputs.

## 7. Verification

- [x] 7.1 Run the relevant checks for changed workspace packages and seed scripts.
- [x] 7.2 Build the seed container and verify `whisper-cli`, FFmpeg, and ffprobe are available inside it.
- [x] 7.3 Run `podman compose up --build` and verify web, API, render, postgres, and seed services start as expected.
- [x] 7.4 Verify a first seed run downloads media, generates thumbnails, generates timestamped transcripts, writes status, and writes `library.json`.
- [x] 7.5 Verify a consecutive seed run is a no-op when the catalog identity and outputs are unchanged.
- [x] 7.6 Verify changing only an asset title updates library metadata without re-downloading or regenerating media artifacts.
- [x] 7.7 Verify changing an asset URL regenerates the affected asset outputs.
- [x] 7.8 Verify the webapp shows setup during seeding and transitions to the normal app when ready.
- [x] 7.9 Run `openspec status --change seed-script-for-local-dev` and confirm the change is apply-ready.
